/**
 * Perceive module for generative agents.
 */

import type { ConceptNode, Persona, Maze } from '../../../types.js';
import { run_gpt_prompt_event_poignancy, run_gpt_prompt_chat_poignancy } from '../prompt_template/run_gpt_prompt.js';
import { get_embedding } from '../prompt_template/gpt_structure.js';

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
   * 
   * INPUT: 
   *   persona: An instance of <Persona> that represents the current persona. 
   *   maze: An instance of <Maze> that represents the current maze in which the 
   *         persona is acting in. 
   * OUTPUT: 
   *   ret_events: a list of <ConceptNode> that are perceived and new. 
   */

  // PERCEIVE SPACE
  // We get the nearby tiles given our current tile and the persona's vision
  // radius. 
  const nearby_tiles = maze.get_nearby_tiles(persona.scratch.curr_tile, persona.scratch.vision_r);

  // We then store the perceived space. Note that the s_mem of the persona is
  // in the form of a tree constructed using dictionaries. 
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
  // We will perceive events that take place in the same arena as the
  // persona's current arena. 
  const curr_arena_path = maze.get_tile_path(persona.scratch.curr_tile, 'arena');
  
  // We do not perceive the same event twice (this can happen if an object is
  // extended across multiple tiles).
  const percept_events_set = new Set<string>();
  
  // We will order our percept based on the distance, with the closest ones
  // getting priorities. 
  const percept_events_list: [number, string][] = [];
  
  // First, we put all events that are occuring in the nearby tiles into the
  // percept_events_list
  for (const tile_coord of nearby_tiles) {
    const tile_details = maze.access_tile(tile_coord);
    if (tile_details.events && tile_details.events.size > 0) {
      if (maze.get_tile_path(tile_coord, 'arena') === curr_arena_path) {
        // This calculates the distance between the persona's current tile, 
        // and the target tile.
        const dist = Math.sqrt(
          Math.pow(tile_coord[0] - persona.scratch.curr_tile[0], 2) +
          Math.pow(tile_coord[1] - persona.scratch.curr_tile[1], 2)
        );
        
        // Add any relevant events to our temp set/list with the distant info. 
        for (const event_str of tile_details.events) {
          if (!percept_events_set.has(event_str)) {
            percept_events_list.push([dist, event_str]);
            percept_events_set.add(event_str);
          }
        }
      }
    }
  }

  // We sort, and perceive only persona.scratch.att_bandwidth of the closest
  // events. If the bandwidth is larger, then it means the persona can perceive
  // more elements within a small area. 
  percept_events_list.sort((a, b) => a[0] - b[0]);
  const perceived_events: string[] = [];
  for (const [dist, event] of percept_events_list.slice(0, persona.scratch.att_bandwidth)) {
    perceived_events.push(event);
  }

  // Storing events. 
  // <ret_events> is a list of <ConceptNode> instances from the persona's 
  // associative memory. 
  const ret_events: any[] = [];
  
  for (const p_event of perceived_events) {
    // Parse event string: s, p, o, desc
    let [s, p, o, desc] = p_event.split(',').map((x: string) => x.trim());
    
    if (!p) {
      // If the object is not present, then we default the event to "idle".
      p = "is";
      o = "idle";
      desc = "idle";
    }
    
    desc = `${s.split(':').pop()} is ${desc}`;
    
    // We retrieve the latest persona.scratch.retention events. If there is  
    // something new that is happening (that is, p_event not in latest_events),
    // then we add that event to the a_mem and return it. 
    const latest_events = persona.a_mem.get_summarized_latest_events(persona.scratch.retention);
    const p_event_tuple: [string, string, string] = [s, p, o];
    
    if (!Array.from(latest_events).some(e => e[0] === s && e[1] === p && e[2] === o)) {
      // We start by managing keywords. 
      const keywords = new Set<string>();
      let sub = s;
      let obj = o;
      if (s.includes(':')) {
        sub = s.split(':').pop()!;
      }
      if (o.includes(':')) {
        obj = o.split(':').pop()!;
      }
      keywords.add(sub);
      keywords.add(obj);

      // Get event embedding
      let desc_embedding_in = desc;
      if (desc.includes('(')) {
        desc_embedding_in = desc.split('(')[1].split(')')[0].trim();
      }
      
      let event_embedding: number[];
      if (persona.a_mem.embeddings.has(desc_embedding_in)) {
        event_embedding = persona.a_mem.embeddings.get(desc_embedding_in)!;
      } else {
        event_embedding = await get_embedding(desc_embedding_in);
      }
      const event_embedding_pair: [string, number[]] = [desc_embedding_in, event_embedding];
      
      // Get event poignancy. 
      const event_poignancy = await generate_poig_score(persona, 'event', desc_embedding_in);

      // If we observe the persona's self chat, we include that in the memory
      // of the persona here. 
      let chat_node_ids: string[] = [];
      if (s === `${persona.name}` && p === 'chat with') {
        const curr_event = persona.scratch.act_event;
        
        let chat_embedding: number[];
        if (persona.a_mem.embeddings.has(persona.scratch.act_description)) {
          chat_embedding = persona.a_mem.embeddings.get(persona.scratch.act_description)!;
        } else {
          chat_embedding = await get_embedding(persona.scratch.act_description);
        }
        const chat_embedding_pair: [string, number[]] = [persona.scratch.act_description, chat_embedding];
        
        const chat_poignancy = await generate_poig_score(persona, 'chat', persona.scratch.act_description);
        
        const chat_node = persona.a_mem.add_chat(
          persona.scratch.curr_time,
          null,
          curr_event[0],
          curr_event[1] || '',
          curr_event[2] || '',
          persona.scratch.act_description,
          keywords,
          chat_poignancy,
          chat_embedding_pair,
          persona.scratch.chat
        );
        chat_node_ids = [chat_node.node_id];
      }

      // Finally, we add the current event to the agent's memory. 
      const event_node = persona.a_mem.add_event(
        persona.scratch.curr_time,
        null,
        s,
        p,
        o,
        desc,
        keywords,
        event_poignancy,
        event_embedding_pair,
        chat_node_ids
      );
      
      ret_events.push(event_node);
      
      // Update importance counters for reflection triggering
      persona.scratch.importance_trigger_curr -= event_poignancy;
      persona.scratch.importance_ele_n += 1;
    }
  }

  return ret_events;
};
