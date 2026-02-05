/**
 * Author: Joon Sung Park (joonspk@stanford.edu)
 * 
 * File: maze.ts
 * Description: Defines the Maze class, which represents the map of the simulated
 * world in a 2-dimensional matrix.
 */

import * as fs from 'fs';
import * as path from 'path';
import { Tile, Maze as MazeInterface } from '../types.js';
import { read_file_to_list_sync } from './global_methods.js';

// Environment paths - these would need to be configured
const env_matrix = process.env.ENV_MATRIX || './environment/matrix';
const fs_storage = process.env.FS_STORAGE || './storage';

export class Maze implements MazeInterface {
  maze_name: string;
  maze_width: number;
  maze_height: number;
  sq_tile_size: number;
  special_constraint: string;
  tiles: Tile[][];
  collision_maze: number[][];
  sector_maze: string[][];
  arena_maze: string[][];
  game_object_maze: string[][];
  spawning_location_maze: string[][];
  address_tiles: Record<string, Set<[number, number]>>;

  constructor(maze_name: string) {
    // READING IN THE BASIC META INFORMATION ABOUT THE MAP
    this.maze_name = maze_name;
    
    // Reading in the meta information about the world
    const meta_info_path = path.join(env_matrix, 'maze_meta_info.json');
    const meta_info = JSON.parse(fs.readFileSync(meta_info_path, 'utf-8'));
    
    this.maze_width = parseInt(meta_info.maze_width);
    this.maze_height = parseInt(meta_info.maze_height);
    this.sq_tile_size = parseInt(meta_info.sq_tile_size);
    this.special_constraint = meta_info.special_constraint;

    // READING IN SPECIAL BLOCKS
    const blocks_folder = path.join(env_matrix, 'special_blocks');

    // Read world blocks
    const wb_path = path.join(blocks_folder, 'world_blocks.csv');
    const wb_rows = read_file_to_list_sync(wb_path, false) as string[][];
    const wb = wb_rows[0][wb_rows[0].length - 1]; // Last column

    // Read sector blocks
    const sb_path = path.join(blocks_folder, 'sector_blocks.csv');
    const sb_rows = read_file_to_list_sync(sb_path, false) as string[][];
    const sb_dict: Record<string, string> = {};
    sb_rows.forEach(row => {
      sb_dict[row[0]] = row[row.length - 1];
    });

    // Read arena blocks
    const ab_path = path.join(blocks_folder, 'arena_blocks.csv');
    const ab_rows = read_file_to_list_sync(ab_path, false) as string[][];
    const ab_dict: Record<string, string> = {};
    ab_rows.forEach(row => {
      ab_dict[row[0]] = row[row.length - 1];
    });

    // Read game object blocks
    const gob_path = path.join(blocks_folder, 'game_object_blocks.csv');
    const gob_rows = read_file_to_list_sync(gob_path, false) as string[][];
    const gob_dict: Record<string, string> = {};
    gob_rows.forEach(row => {
      gob_dict[row[0]] = row[row.length - 1];
    });

    // Read spawning location blocks
    const slb_path = path.join(blocks_folder, 'spawning_location_blocks.csv');
    const slb_rows = read_file_to_list_sync(slb_path, false) as string[][];
    const slb_dict: Record<string, string> = {};
    slb_rows.forEach(row => {
      slb_dict[row[0]] = row[row.length - 1];
    });

    // Reading in the matrices
    const maze_folder = path.join(env_matrix, 'maze');

    const cm_path = path.join(maze_folder, 'collision_maze.csv');
    const collision_maze_raw = (read_file_to_list_sync(cm_path, false) as string[][])[0];
    
    const sm_path = path.join(maze_folder, 'sector_maze.csv');
    const sector_maze_raw = (read_file_to_list_sync(sm_path, false) as string[][])[0];
    
    const am_path = path.join(maze_folder, 'arena_maze.csv');
    const arena_maze_raw = (read_file_to_list_sync(am_path, false) as string[][])[0];
    
    const gom_path = path.join(maze_folder, 'game_object_maze.csv');
    const game_object_maze_raw = (read_file_to_list_sync(gom_path, false) as string[][])[0];
    
    const slm_path = path.join(maze_folder, 'spawning_location_maze.csv');
    const spawning_location_maze_raw = (read_file_to_list_sync(slm_path, false) as string[][])[0];

    // Convert raw maze data to 2D arrays
    this.collision_maze = this._convert_to_matrix(collision_maze_raw, this.maze_width, this.maze_height);
    this.sector_maze = this._convert_to_matrix(sector_maze_raw, this.maze_width, this.maze_height);
    this.arena_maze = this._convert_to_matrix(arena_maze_raw, this.maze_width, this.maze_height);
    this.game_object_maze = this._convert_to_matrix(game_object_maze_raw, this.maze_width, this.maze_height);
    this.spawning_location_maze = this._convert_to_matrix(spawning_location_maze_raw, this.maze_width, this.maze_height);

    // Initialize tiles matrix
    this.tiles = [];
    for (let y = 0; y < this.maze_height; y++) {
      this.tiles[y] = [];
      for (let x = 0; x < this.maze_width; x++) {
        const collision_val = this.collision_maze[y][x];
        const sector_val = this.sector_maze[y][x];
        const arena_val = this.arena_maze[y][x];
        const game_object_val = this.game_object_maze[y][x];
        const spawning_val = this.spawning_location_maze[y][x];

        this.tiles[y][x] = {
          x,
          y,
          world: wb,
          sector: sector_val in sb_dict ? sb_dict[sector_val] : '',
          arena: arena_val in ab_dict ? ab_dict[arena_val] : '',
          game_object: game_object_val in gob_dict ? gob_dict[game_object_val] : '',
          spawning_location: spawning_val in slb_dict ? slb_dict[spawning_val] : '',
          collision: collision_val !== 0,
          events: new Set<string>()
        };
      }
    }

    // Build address_tiles dictionary
    this.address_tiles = {};
    
    for (let y = 0; y < this.maze_height; y++) {
      for (let x = 0; x < this.maze_width; x++) {
        const tile = this.tiles[y][x];
        const addresses: string[] = [];
        
        if (tile.sector) {
          const add = `${tile.world}:${tile.sector}`;
          addresses.push(add);
        }
        
        if (tile.arena) {
          const add = `${tile.world}:${tile.sector}:${tile.arena}`;
          addresses.push(add);
        }
        
        if (tile.game_object) {
          const add = `${tile.world}:${tile.sector}:${tile.arena}:${tile.game_object}`;
          addresses.push(add);
        }
        
        if (tile.spawning_location) {
          const add = `<spawn_loc>${tile.spawning_location}`;
          addresses.push(add);
        }
        
        for (const add of addresses) {
          if (!this.address_tiles[add]) {
            this.address_tiles[add] = new Set<[number, number]>();
          }
          this.address_tiles[add].add([x, y]);
        }
      }
    }
  }

  private _convert_to_matrix(raw: string[], width: number, height: number): any[][] {
    const matrix: any[][] = [];
    let index = 0;
    
    for (let y = 0; y < height; y++) {
      matrix[y] = [];
      for (let x = 0; x < width; x++) {
        matrix[y][x] = raw[index];
        index++;
      }
    }
    
    return matrix;
  }

  access_tile(coordinate: [number, number]): Tile {
    const [x, y] = coordinate;
    if (y >= 0 && y < this.maze_height && x >= 0 && x < this.maze_width) {
      return this.tiles[y][x];
    }
    throw new Error(`Tile coordinate out of bounds: ${x}, ${y}`);
  }

  get_nearby_tiles(center: [number, number], radius: number): [number, number][] {
    const [center_x, center_y] = center;
    const nearby_tiles: [number, number][] = [];
    
    for (let y = Math.max(0, center_y - radius); y <= Math.min(this.maze_height - 1, center_y + radius); y++) {
      for (let x = Math.max(0, center_x - radius); x <= Math.min(this.maze_width - 1, center_x + radius); x++) {
        if (Math.sqrt(Math.pow(x - center_x, 2) + Math.pow(y - center_y, 2)) <= radius) {
          nearby_tiles.push([x, y]);
        }
      }
    }
    
    return nearby_tiles;
  }

  get_tile_path(tile: [number, number], level: string): string {
    const tile_details = this.access_tile(tile);
    
    switch (level) {
      case 'world':
        return tile_details.world;
      case 'sector':
        return `${tile_details.world}:${tile_details.sector}`;
      case 'arena':
        return `${tile_details.world}:${tile_details.sector}:${tile_details.arena}`;
      case 'game_object':
        return `${tile_details.world}:${tile_details.sector}:${tile_details.arena}:${tile_details.game_object}`;
      default:
        return '';
    }
  }

  remove_subject_events_from_tile(subject: string, tile: [number, number]): void {
    const tile_details = this.access_tile(tile);
    const events_to_remove: string[] = [];
    
    tile_details.events.forEach(event_str => {
      if (event_str.includes(subject)) {
        events_to_remove.push(event_str);
      }
    });
    
    events_to_remove.forEach(event => {
      tile_details.events.delete(event);
    });
  }

  add_event_from_tile(event: [string, string, string, string], tile: [number, number]): void {
    const tile_details = this.access_tile(tile);
    const event_str = event.join(',');
    tile_details.events.add(event_str);
  }

  remove_event_from_tile(event: [string, string, string, string], tile: [number, number]): void {
    const tile_details = this.access_tile(tile);
    const event_str = event.join(',');
    tile_details.events.delete(event_str);
  }

  turn_event_from_tile_idle(event_key: string, tile: [number, number]): void {
    const tile_details = this.access_tile(tile);
    const events_to_update: string[] = [];
    
    tile_details.events.forEach(event_str => {
      if (event_str.startsWith(event_key)) {
        events_to_update.push(event_str);
      }
    });
    
    events_to_update.forEach(event => {
      tile_details.events.delete(event);
      const parts = event.split(',');
      if (parts.length >= 4) {
        const idle_event: [string, string, string, string] = [parts[0], 'is', 'idle', 'idle'];
        tile_details.events.add(idle_event.join(','));
      }
    });
  }
}