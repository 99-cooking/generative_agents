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
import { perceive } from './cognitive_modules/perceive.js';
import { retrieve } from './cognitive_modules/retrieve.js';
import { plan } from './cognitive_modules/plan.js';
import { reflect } from './cognitive_modules/reflect.js';
import { execute } from './cognitive_modules/execute.js';

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
     */
    return perceive(this, maze);
  }

  async retrieve(perceived: any[]): Promise<Record<string, any>> {
    /**
     * Retrieves relevant memories based on perceived events.
     */
    return retrieve(this, perceived);
  }

  async plan(
    maze: Maze, 
    personas: Record<string, Persona>, 
    new_day: false | string, 
    retrieved: Record<string, any>
  ): Promise<string> {
    /**
     * Creates plans for the persona.
     */
    return plan(this, maze, personas, new_day, retrieved);
  }

  async execute(
    maze: Maze, 
    personas: Record<string, Persona>, 
    plan: string
  ): Promise<[[number, number], string, string]> {
    /**
     * Executes the plan to determine the next tile and action.
     */
    return execute(this, maze, personas, plan);
  }

  async reflect(): Promise<void> {
    /**
     * Runs reflection on the persona's memory.
     */
    await reflect(this);
  }

  async move(
    maze: Maze,
    personas: Record<string, Persona>,
    curr_tile: [number, number],
    curr_time: Date
  ): Promise<[[number, number], string, string]> {
    /**
     * This is the main cognitive function where our main sequence is called. 
     * 
     * INPUT: 
     *   maze: The Maze class of the current world. 
     *   personas: A dictionary that contains all persona names as keys, and the 
     *             Persona instance as values. 
     *   curr_tile: A tuple that designates the persona's current tile location 
     *              in (row, col) form. e.g., (58, 39)
     *   curr_time: Date instance that indicates the game's current time. 
     * OUTPUT: 
     *   execution: A triple set that contains the following components: 
     *     <next_tile> is a x,y coordinate. e.g., (58, 9)
     *     <pronunciatio> is an emoji.
     *     <description> is a string description of the movement. e.g., 
     *       writing her next novel (editing her novel) 
     *       @ double studio:double studio:common room:sofa
     */
    // Updating persona's scratch memory with <curr_tile>. 
    this.scratch.curr_tile = curr_tile;

    // We figure out whether the persona started a new day, and if it is a new
    // day, whether it is the very first day of the simulation. This is 
    // important because we set up the persona's long term plan at the start of
    // a new day. 
    let new_day: false | string = false;
    if (!this.scratch.curr_time) {
      new_day = "First day";
    } else if (
      this.scratch.curr_time.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) !==
      curr_time.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    ) {
      new_day = "New day";
    }
    this.scratch.curr_time = curr_time;

    // Main cognitive sequence begins here. 
    const perceived = await this.perceive(maze);
    const retrieved = await this.retrieve(perceived);
    const plan_result = await this.plan(maze, personas, new_day, retrieved);
    await this.reflect();

    // <execution> is a triple set that contains the following components: 
    // <next_tile> is a x,y coordinate. e.g., (58, 9)
    // <pronunciatio> is an emoji. e.g., "\ud83d\udca4"
    // <description> is a string description of the movement. e.g., 
    //   writing her next novel (editing her novel) 
    //   @ double studio:double studio:common room:sofa
    return this.execute(maze, personas, plan_result);
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
