/**
 * Author: Joon Sung Park (joonspk@stanford.edu)
 * 
 * File: spatial_memory.ts
 * Description: Defines the MemoryTree class that serves as the agents' spatial
 * memory that aids in grounding their behavior in the game world.
 */

import * as fs from 'fs';
import * as path from 'path';
import { check_if_file_exists } from '../../global_methods.js';
import { MemoryTree as MemoryTreeInterface } from '../../../types.js';

export class MemoryTree implements MemoryTreeInterface {
  tree: Record<string, any>;

  constructor(f_saved?: string) {
    this.tree = {};
    if (f_saved && check_if_file_exists(f_saved)) {
      this.tree = JSON.parse(fs.readFileSync(f_saved, 'utf-8'));
    }
  }

  print_tree(): void {
    const _print_tree = (tree: any, depth: number): void => {
      const dash = ' >'.repeat(depth);
      if (Array.isArray(tree)) {
        if (tree.length > 0) {
          console.log(dash, tree);
        }
        return;
      }

      for (const [key, val] of Object.entries(tree)) {
        if (key) {
          console.log(dash, key);
        }
        _print_tree(val, depth + 1);
      }
    };

    _print_tree(this.tree, 0);
  }

  save(out_json: string): void {
    const folder = path.dirname(out_json);
    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder, { recursive: true });
    }
    fs.writeFileSync(out_json, JSON.stringify(this.tree, null, 2));
  }

  get_str_accessible_sectors(curr_world: string): string {
    return Object.keys(this.tree[curr_world] || {}).join(', ');
  }

  get_str_accessible_sector_arenas(sector: string): string {
    const [curr_world, curr_sector] = sector.split(':');
    if (!curr_sector) {
      return '';
    }
    return Object.keys(this.tree[curr_world]?.[curr_sector] || {}).join(', ');
  }

  get_str_accessible_arena_game_objects(arena: string): string {
    const [curr_world, curr_sector, curr_arena] = arena.split(':');

    if (!curr_arena) {
      return '';
    }

    try {
      return (this.tree[curr_world]?.[curr_sector]?.[curr_arena] || []).join(', ');
    } catch {
      return (this.tree[curr_world]?.[curr_sector]?.[curr_arena.toLowerCase()] || []).join(', ');
    }
  }
}
