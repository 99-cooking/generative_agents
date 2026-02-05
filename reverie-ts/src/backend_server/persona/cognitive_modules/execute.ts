/**
 * Execute module for generative agents.
 */

import type { ConceptNode, Persona, Maze } from '../../../types.js';
import { path_finder } from '../../path_finder.js';

const debug = false;
const collision_block_id = "32125";


/**
 * Given a plan (action's string address), we execute the plan (actually 
 * outputs the tile coordinate path and the next coordinate for the 
 * persona).
 * 
 * INPUT:
 *   persona: Current <Persona> instance.
 *   maze: An instance of current <Maze>.
 *   personas: A dictionary of all personas in the world.
 *   plan: This is a string address of the action we need to execute.
 *      It comes in the form of "{world}:{sector}:{arena}:{game_objects}".
 *      It is important that you access this without doing negative 
 *      indexing (e.g., [-1]) because the latter address elements may not be 
 *      present in some cases.
 *      e.g., "dolores double studio:double studio:bedroom 1:bed"
 * 
 * OUTPUT:
 *   execution: [next_tile, pronunciatio, description]
 */
export const execute = (
  persona: Persona,
  maze: Maze,
  personas: Record<string, Persona>,
  plan: string
): [[number, number], string, string] => {

  if (plan.includes('<random>') && persona.scratch.planned_path.length === 0) {
    persona.scratch.act_path_set = false;
  }

  // <act_path_set> is set to True if the path is set for the current action.
  // It is False otherwise, and means we need to construct a new path.
  if (!persona.scratch.act_path_set) {
    // <target_tiles> is a list of tile coordinates where the persona may go
    // to execute the current action. The goal is to pick one of them.
    let target_tiles: [number, number][] | null = null;

    console.log('aldhfoaf/????');
    console.log(plan);

    if (plan.includes('<persona>')) {
      // Executing persona-persona interaction.
      const targetPersonaName = plan.split('<persona>')[1].trim();
      const target_p_tile = personas[targetPersonaName].scratch.curr_tile;
      const potential_path = path_finder(
        maze.collision_maze,
        persona.scratch.curr_tile,
        target_p_tile,
        collision_block_id
      );

      if (potential_path.length <= 2) {
        target_tiles = [potential_path[0]];
      } else {
        const potential_1 = path_finder(
          maze.collision_maze,
          persona.scratch.curr_tile,
          potential_path[Math.floor(potential_path.length / 2)],
          collision_block_id
        );
        const potential_2 = path_finder(
          maze.collision_maze,
          persona.scratch.curr_tile,
          potential_path[Math.floor(potential_path.length / 2) + 1],
          collision_block_id
        );

        if (potential_1.length <= potential_2.length) {
          target_tiles = [potential_path[Math.floor(potential_path.length / 2)]];
        } else {
          target_tiles = [potential_path[Math.floor(potential_path.length / 2) + 1]];
        }
      }
    } else if (plan.includes('<waiting>')) {
      // Executing interaction where the persona has decided to wait before
      // executing their action.
      const parts = plan.split(' ');
      const x = parseInt(parts[1]);
      const y = parseInt(parts[2]);
      target_tiles = [[x, y]];
    } else if (plan.includes('<random>')) {
      // Executing a random location action.
      const planParts = plan.split(':');
      planParts.pop(); // Remove last element
      const basePlan = planParts.join(':');
      
      if (maze.address_tiles && maze.address_tiles[basePlan]) {
        const tilesSet = maze.address_tiles[basePlan];
        const tilesArray = Array.from(tilesSet) as [number, number][];
        // Random sample of 1
        const randomIndex = Math.floor(Math.random() * tilesArray.length);
        target_tiles = [tilesArray[randomIndex]];
      } else {
        // Fallback - use error handling from original Python code
        console.error(`Plan "${basePlan}" not found in maze.address_tiles`);
        // This mimics the Python error line: maze.address_tiles["Johnson Park:park:park garden"] #ERRORRRRRRR
        throw new Error(`Plan "${basePlan}" not found in maze.address_tiles`);
      }
    } else {
      // This is our default execution. We simply take the persona to the
      // location where the current action is taking place.
      // Retrieve the target addresses. Again, plan is an action address in its
      // string form. <maze.address_tiles> takes this and returns candidate
      // coordinates.
      if (!maze.address_tiles || !maze.address_tiles[plan]) {
        // This mimics the Python error handling
        console.error(`Plan "${plan}" not found in maze.address_tiles`);
        throw new Error(`Plan "${plan}" not found in maze.address_tiles`);
      } else {
        target_tiles = Array.from(maze.address_tiles[plan]);
      }
    }

    if (!target_tiles) {
      throw new Error('No target tiles found');
    }

    // There are sometimes more than one tile returned from this (e.g., a table
    // may stretch many coordinates). So, we sample a few here. And from that
    // random sample, we will take the closest ones.
    let sampledTiles: [number, number][];
    if (target_tiles.length < 4) {
      // Shuffle the array
      sampledTiles = [...target_tiles].sort(() => Math.random() - 0.5);
    } else {
      // Shuffle and take 4
      sampledTiles = [...target_tiles]
        .sort(() => Math.random() - 0.5)
        .slice(0, 4);
    }

    // If possible, we want personas to occupy different tiles when they are
    // headed to the same location on the maze. It is ok if they end up on the
    // same tile, but we try to lower that probability.
    // We take care of that overlap here.
    const personaNameSet = new Set(Object.keys(personas));
    const newTargetTiles: [number, number][] = [];
    
    for (const tile of sampledTiles) {
      const currEventSet = maze.access_tile(tile).events;
      let passCurrTile = false;
      
      for (const eventStr of currEventSet) {
        // Parse event string to get persona name (first element)
        const eventParts = eventStr.split(',');
        if (eventParts.length > 0 && personaNameSet.has(eventParts[0])) {
          passCurrTile = true;
          break;
        }
      }
      
      if (!passCurrTile) {
        newTargetTiles.push(tile);
      }
    }
    
    if (newTargetTiles.length === 0) {
      newTargetTiles.push(...sampledTiles);
    }
    target_tiles = newTargetTiles;

    // Now that we've identified the target tile, we find the shortest path to
    // one of the target tiles.
    const curr_tile = persona.scratch.curr_tile;
    let closestTargetTile: [number, number] | null = null;
    let path: [number, number][] | null = null;
    
    for (const tile of target_tiles) {
      // path_finder takes a collision_maze and the curr_tile coordinate as
      // an input, and returns a list of coordinate tuples that becomes the
      // path.
      // e.g., [(0, 1), (1, 1), (1, 2), (1, 3), (1, 4)...]
      const currPath = path_finder(
        maze.collision_maze,
        curr_tile,
        tile,
        collision_block_id
      );
      
      if (!closestTargetTile) {
        closestTargetTile = tile;
        path = currPath;
      } else if (currPath.length < path!.length) {
        closestTargetTile = tile;
        path = currPath;
      }
    }

    // Actually setting the <planned_path> and <act_path_set>. We cut the
    // first element in the planned_path because it includes the curr_tile.
    if (path && closestTargetTile) {
      persona.scratch.planned_path = path.slice(1);
      persona.scratch.act_path_set = true;
    }
  }

  // Setting up the next immediate step. We stay at our curr_tile if there is
  // no <planned_path> left, but otherwise, we go to the next tile in the path.
  let ret: [number, number] = persona.scratch.curr_tile;
  if (persona.scratch.planned_path && persona.scratch.planned_path.length > 0) {
    ret = persona.scratch.planned_path[0];
    persona.scratch.planned_path = persona.scratch.planned_path.slice(1);
  }

  const description = `${persona.scratch.act_description}`;
  const descriptionWithAddress = `${description} @ ${persona.scratch.act_address}`;

  const execution: [[number, number], string, string] = [ret, persona.scratch.act_pronunciatio || '', descriptionWithAddress];
  return execution;
};
