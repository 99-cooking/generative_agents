/**
 * Author: Joon Sung Park (joonspk@stanford.edu)
 * 
 * File: reverie.ts
 * Description: This is the main program for running generative agent simulations
 * that defines the ReverieServer class.
 */

import * as fs from 'fs';
import * as path from 'path';
import { copyanything, check_if_file_exists } from './global_methods.js';
import { Maze } from './maze.js';
import { Persona } from './persona/persona.js';
import { ReverieMeta, Movement, Environment } from '../types.js';

// Environment variables
const fs_storage = process.env.FS_STORAGE || './storage';
const fs_temp_storage = process.env.FS_TEMP_STORAGE || './temp_storage';

export class ReverieServer {
  fork_sim_code: string;
  sim_code: string;
  start_time: Date;
  curr_time: Date;
  sec_per_step: number;
  maze: Maze;
  step: number;
  personas: Record<string, Persona>;
  personas_tile: Record<string, [number, number]>;
  server_sleep: number;

  constructor(fork_sim_code: string, sim_code: string) {
    // FORKING FROM A PRIOR SIMULATION:
    this.fork_sim_code = fork_sim_code;
    const fork_folder = path.join(fs_storage, this.fork_sim_code);

    // Copy everything from fork simulation
    this.sim_code = sim_code;
    const sim_folder = path.join(fs_storage, this.sim_code);
    copyanything(fork_folder, sim_folder);

    // Load and update meta information
    const reverie_meta_path = path.join(sim_folder, 'reverie', 'meta.json');
    const reverie_meta: ReverieMeta = JSON.parse(fs.readFileSync(reverie_meta_path, 'utf-8'));

    reverie_meta.fork_sim_code = fork_sim_code;
    fs.writeFileSync(reverie_meta_path, JSON.stringify(reverie_meta, null, 2));

    // LOADING REVERIE'S GLOBAL VARIABLES
    this.start_time = new Date(`${reverie_meta.start_date}, 00:00:00`);
    this.curr_time = new Date(reverie_meta.curr_time);
    this.sec_per_step = reverie_meta.sec_per_step;
    this.maze = new Maze(reverie_meta.maze_name);
    this.step = reverie_meta.step;

    // SETTING UP PERSONAS IN REVERIE
    this.personas = {};
    this.personas_tile = {};

    // Loading in all personas.
    const init_env_file = path.join(sim_folder, 'environment', `${this.step}.json`);
    const init_env: Environment = JSON.parse(fs.readFileSync(init_env_file, 'utf-8'));
    
    for (const persona_name of reverie_meta.persona_names) {
      const persona_folder = path.join(sim_folder, 'personas', persona_name);
      const p_x = init_env[persona_name].x;
      const p_y = init_env[persona_name].y;
      const curr_persona = new Persona(persona_name, persona_folder);

      this.personas[persona_name] = curr_persona;
      this.personas_tile[persona_name] = [p_x, p_y];
      
      const curr_event = curr_persona.scratch.get_curr_event_and_desc();
      const event_str = curr_event.join(',');
      this.maze.tiles[p_y][p_x].events.add(event_str);
    }

    // REVERIE SETTINGS PARAMETERS
    this.server_sleep = 0.1;

    // SIGNALING THE FRONTEND SERVER
    const curr_sim_code = { sim_code: this.sim_code };
    fs.writeFileSync(
      path.join(fs_temp_storage, 'curr_sim_code.json'),
      JSON.stringify(curr_sim_code, null, 2)
    );

    const curr_step = { step: this.step };
    fs.writeFileSync(
      path.join(fs_temp_storage, 'curr_step.json'),
      JSON.stringify(curr_step, null, 2)
    );
  }

  save(): void {
    /**
     * Save all Reverie progress -- this includes Reverie's global state as well
     * as all the personas.
     */
    const sim_folder = path.join(fs_storage, this.sim_code);

    // Save Reverie meta information.
    const reverie_meta: ReverieMeta = {
      fork_sim_code: this.fork_sim_code,
      start_date: this.start_time.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
      curr_time: this.curr_time.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      sec_per_step: this.sec_per_step,
      maze_name: this.maze.maze_name,
      persona_names: Object.keys(this.personas),
      step: this.step
    };

    const reverie_meta_f = path.join(sim_folder, 'reverie', 'meta.json');
    fs.writeFileSync(reverie_meta_f, JSON.stringify(reverie_meta, null, 2));

    // Save the personas.
    for (const [persona_name, persona] of Object.entries(this.personas)) {
      const save_folder = path.join(sim_folder, 'personas', persona_name, 'bootstrap_memory');
      persona.save(save_folder);
    }
  }

  async start_server(int_counter: number): Promise<void> {
    /**
     * The main backend server of Reverie.
     * This function retrieves the environment file from the frontend to 
     * understand the state of the world, calls on each personas to make 
     * decisions based on the world state, and saves their moves at certain step
     * intervals.
     */
    const sim_folder = path.join(fs_storage, this.sim_code);

    // When a persona arrives at a game object, we give a unique event to that object.
    const game_obj_cleanup: Record<string, [number, number]> = {};

    // The main while loop of Reverie.
    while (true) {
      // Done with this iteration if <int_counter> reaches 0.
      if (int_counter === 0) {
        break;
      }

      // Check for new environment file from frontend
      const curr_env_file = path.join(sim_folder, 'environment', `${this.step}.json`);
      if (check_if_file_exists(curr_env_file)) {
        let env_retrieved = false;
        let new_env: Environment = {};

        try {
          new_env = JSON.parse(fs.readFileSync(curr_env_file, 'utf-8'));
          env_retrieved = true;
        } catch (error) {
          console.error('Error reading environment file:', error);
        }

        if (env_retrieved) {
          // Clean up all object actions that were used in this cycle.
          for (const [key, val] of Object.entries(game_obj_cleanup)) {
            this.maze.turn_event_from_tile_idle(key, val);
          }
          
          // Initialize game_obj_cleanup for this cycle.
          Object.keys(game_obj_cleanup).forEach(key => delete game_obj_cleanup[key]);

          // Move personas in the backend environment to match the frontend environment.
          for (const [persona_name, persona] of Object.entries(this.personas)) {
            const curr_tile = this.personas_tile[persona_name];
            const new_tile: [number, number] = [new_env[persona_name].x, new_env[persona_name].y];

            // Move the persona on the backend tile map.
            this.personas_tile[persona_name] = new_tile;
            this.maze.remove_subject_events_from_tile(persona.name, curr_tile);
            
            const curr_event = persona.scratch.get_curr_event_and_desc();
            const event_str = curr_event.join(',');
            this.maze.add_event_from_tile(curr_event, new_tile);

            // Activate object action when persona arrives at destination.
            if (persona.scratch.planned_path.length === 0) {
              const obj_event = persona.scratch.get_curr_obj_event_and_desc();
              game_obj_cleanup[obj_event.join(',')] = new_tile;
              this.maze.add_event_from_tile(obj_event, new_tile);
              
              // Remove the temporary blank action for the object.
              const blank: [string, string, string, string] = [obj_event[0], 'is', 'idle', 'idle'];
              this.maze.remove_event_from_tile(blank, new_tile);
            }
          }

          // Have each persona perceive and move.
          const movements: Movement = {
            persona: {},
            meta: {
              curr_time: this.curr_time.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })
            }
          };

          for (const [persona_name, persona] of Object.entries(this.personas)) {
            // Note: We need to import and call the actual move function
            // For now, we'll use a placeholder
            const next_tile: [number, number] = this.personas_tile[persona_name];
            const pronunciatio = '😐'; // Neutral face emoji as placeholder
            const description = 'waiting'; // Placeholder
            
            movements.persona[persona_name] = {
              movement: next_tile,
              pronunciatio,
              description,
              chat: JSON.stringify(persona.scratch.chat || '')
            };
          }

          // Write movements to file for frontend
          const curr_move_file = path.join(sim_folder, 'movement', `${this.step}.json`);
          fs.writeFileSync(curr_move_file, JSON.stringify(movements, null, 2));

          // Advance time
          this.step += 1;
          this.curr_time = new Date(this.curr_time.getTime() + this.sec_per_step * 1000);
          int_counter -= 1;
        }
      }

      // Sleep to prevent CPU overuse
      await new Promise(resolve => setTimeout(resolve, this.server_sleep * 1000));
    }
  }

  open_server(): void {
    /**
     * Open up an interactive terminal prompt that lets you run the simulation 
     * step by step and probe agent state.
     */
    console.log("Note: The agents in this simulation package are computational");
    console.log("constructs powered by generative agents architecture and LLM. We");
    console.log("clarify that these agents lack human-like agency, consciousness,");
    console.log("and independent decision-making.\n---");

    const sim_folder = path.join(fs_storage, this.sim_code);

    // Simple REPL for demonstration
    console.log("Type 'help' for available commands");
    console.log(`Simulation: ${this.sim_code}`);
    console.log(`Current step: ${this.step}`);
    console.log(`Current time: ${this.curr_time}`);
    console.log(`Personas: ${Object.keys(this.personas).join(', ')}`);
  }
}