/**
 * Author: Joon Sung Park (joonspk@stanford.edu)
 * 
 * File: persona.ts
 * Description: Defines the Persona class that powers the agents in Reverie.
 */

import * as path from 'path';
import { Persona as PersonaInterface, Maze } from '../../types.js';
import { check_if_file_exists } from '../global_methods.js';
import { MemoryTree } from './memory_structures/spatial_memory.js';
import { AssociativeMemory } from './memory_structures/associative_memory.js';
import { Scratch } from './memory_structures/scratch.js';

export class Persona implements PersonaInterface {
  name: string;
  s_mem: MemoryTree;
  a_mem: AssociativeMemory;
  scratch: Scratch;

  constructor(name: string, folder_mem_saved: string | false = false) {
    // PERSONA BASE STATE
    this.name = name;

    // PERSONA MEMORY
    // If there is already memory in folder_mem_saved, we load that. Otherwise,
    // we create new memory instances.
    if (folder_mem_saved) {
      const f_s_mem_saved = path.join(folder_mem_saved, 'bootstrap_memory', 'spatial_memory.json');
      this.s_mem = new MemoryTree(f_s_mem_saved);
      
      const f_a_mem_saved = path.join(folder_mem_saved, 'bootstrap_memory', 'associative_memory');
      this.a_mem = new AssociativeMemory(f_a_mem_saved);
      
      const scratch_saved = path.join(folder_mem_saved, 'bootstrap_memory', 'scratch.json');
      this.scratch = new Scratch(scratch_saved);
    } else {
      // Create new memory instances
      this.s_mem = new MemoryTree();
      this.a_mem = new AssociativeMemory();
      this.scratch = new Scratch();
      this.scratch.name = name;
    }
  }

  save(save_folder: string): void {
    /**
     * Save persona's current state (i.e., memory).
     */
    // Spatial memory contains a tree in a json format.
    const f_s_mem = path.join(save_folder, 'spatial_memory.json');
    this.s_mem.save(f_s_mem);
    
    // Associative memory contains a csv with the following rows:
    // [event.type, event.created, event.expiration, s, p, o]
    const f_a_mem = path.join(save_folder, 'associative_memory');
    this.a_mem.save(f_a_mem);

    // Scratch contains non-permanent data associated with the persona.
    const f_scratch = path.join(save_folder, 'scratch.json');
    this.scratch.save(f_scratch);
  }

  async perceive(maze: Maze): Promise<any[]> {
    /**
     * Perceives events around the persona and saves it to the memory.
     * This is a placeholder - the actual implementation would be in perceive.ts
     */
    // Import dynamically to avoid circular dependencies
    const { perceive } = await import('./cognitive_modules/perceive.js');
    return perceive(this, maze);
  }

  async move(
    maze: Maze,
    personas: Record<string, Persona>,
    curr_tile: [number, number],
    curr_time: Date
  ): Promise<[[number, number], string, string]> {
    /**
     * Moves the persona based on perception and planning.
     * This is a placeholder - the actual implementation would be in execute.ts
     */
    // Import dynamically to avoid circular dependencies
    const { move } = await import('./cognitive_modules/execute.js');
    return move(this, maze, personas, curr_tile, curr_time);
  }

  open_convo_session(mode: string): void {
    /**
     * Opens a conversation session.
     * This is a placeholder - the actual implementation would be in converse.ts
     */
    console.log(`Opening conversation session in ${mode} mode for ${this.name}`);
    // Implementation would go here
  }
}