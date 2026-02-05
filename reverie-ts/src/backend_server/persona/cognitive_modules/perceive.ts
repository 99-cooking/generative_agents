/**
 * Perceive module for generative agents.
 */

import type { ConceptNode, Persona, Maze } from '../../../types.js';
import { run_gpt_prompt_event_poignancy, run_gpt_prompt_chat_poignancy } from '../prompt_template/run_gpt_prompt.js';

const debug = false;


export const generate_poig_score = async (
  persona: Persona,
  event_type: string,
  description: string
): Promise<number> => {
  if (description.includes('is idle')) {
    return 1;
  }

  if (event_type === 'event') {
    const result = await run_gpt_prompt_event_poignancy(persona, description);
    return result[0];
  } else if (event_type === 'chat') {
    const result = await run_gpt_prompt_chat_poignancy(persona, persona.scratch.act_description);
    return result[0];
  }
  
  return 1;
};

export const perceive = async (
  persona: Persona,
  maze: Maze
): Promise<any[]> => {
  /**
   * Perceives events around the persona and saves it to the memory, both events 
   * and spaces. 
   *
   * We first perceive the events nearby the persona, as determined by its 
   * <vision_r>. If there are a lot of events happening within that radius, we 
   * take the <att_bandwidth> of the closest events. Finally, we check whether
   * any of them are new, as determined by <retention>. If they are new, then we
   * save those and return the <ConceptNode> instances for those events. 
   */

  // PERCEIVE SPACE
  // We get the nearby tiles given our current tile and the persona's vision radius.
  const nearby_tiles = maze.get_nearby_tiles(persona.scratch.curr_tile, persona.scratch.vision_r);

  // We then store the perceived space.
  for (const tile_coord of nearby_tiles) {
    const tile = maze.access_tile(tile_coord);
    if (tile.world) {
      if (!(tile.world in persona.s_mem.tree)) {
        persona.s_mem.tree[tile.world] = {};
      }
    }
    if (tile.sector) {
      if (!(tile.sector in persona.s_mem.tree[tile.world])) {
        persona.s_mem.tree[tile.world][tile.sector] = {};
      }
    }
    if (tile.arena) {
      if (!(tile.arena in persona.s_mem.tree[tile.world][tile.sector])) {
        persona.s_mem.tree[tile.world][tile.sector][tile.arena] = [];
      }
    }
    if (tile.game_object) {
      if (!persona.s_mem.tree[tile.world][tile.sector][tile.arena].includes(tile.game_object)) {
        persona.s_mem.tree[tile.world][tile.sector][tile.arena].push(tile.game_object);
      }
    }
  }

  // PERCEIVE EVENTS.
  // We will perceive events that take place in the same arena as the persona's current arena.
  const curr_arena_path = maze.get_tile_path(persona.scratch.curr_tile, 'arena');
  
  // We do not perceive the same event twice (this can happen if an object is extended across multiple tiles).
  const percept_events_set = new Set<string>();
  
  // We will order our percept based on the distance, with the closest ones getting priorities.
  const percept_events_list: [number, string][] = [];
  
  // First, we put all events that are occurring in the nearby tiles into the percept_events_list
  for (const tile_coord of nearby_tiles) {
    const tile_details = maze.access_tile(tile_coord);
    if (tile_details.events && tile_details.events.size > 0) {
      if (maze.get_tile_path(tile_coord, 'arena') === curr_arena_path) {
        // Calculate the distance between the persona's current tile, and the target tile.
        const dist = Math.sqrt(
          Math.pow(tile_coord[0] - persona.scratch.curr_tile[0], 2) +
          Math.pow(tile_coord[1] - persona.scratch.curr_tile[1], 2)
        );
        
        // Add any relevant events to our temp set/list with the distance info.
        for (const event_str of tile_details.events) {
          if (!percept_events_set.has(event_str)) {
            percept_events_list.push([dist, event_str]);
            percept_events_set.add(event_str);
          }
        }
      }
    }
  }

  // We sort, and perceive only persona.scratch.att_bandwidth of the closest events.
  percept_events_list.sort((a, b) => a[0] - b[0]);
  const perceived_events = percept_events_list.slice(0, persona.scratch.att_bandwidth);

  const ret_events: any[] = [];
  
  // Process each perceived event
  for (const [distance, event_str] of perceived_events) {
    const [event_description, subject, predicate, object] = event_str.split(',').map(s => s.trim());
    
    // Check if this event is already in memory within retention period
    const now = new Date();
    const retention_time = new Date(now.getTime() - persona.scratch.retention * 60000); // retention in minutes
    
    const is_new_event = !persona.a_mem.events.some(event => {
      if (event.s === subject && event.p === predicate && event.o === object) {
        return event.created > retention_time;
      }
      return false;
    });

    if (is_new_event) {
      // Calculate poignancy score
      const poignancy = await generate_poig_score(persona, 'event', event_description);
      
      // Create event node
      const event_node = {
        type: 'event',
        description: event_description,
        subject,
        predicate,
        object,
        poignancy,
        distance,
        created: new Date()
      };
      
      // Add to associative memory
      persona.a_mem.add_event(subject, predicate, object);
      
      ret_events.push(event_node);
    }
  }

  return ret_events;
};