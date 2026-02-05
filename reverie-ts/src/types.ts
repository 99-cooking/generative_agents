/**
 * Type definitions for Reverie TypeScript port
 * 
 * This file contains simple data interfaces.
 * Complex class types are defined in their respective implementation files.
 */

// ============================================================================
// BASIC TILE AND COORDINATE TYPES
// ============================================================================

export interface Tile {
  x?: number;
  y?: number;
  world: string;
  sector: string;
  arena: string;
  game_object: string;
  spawning_location: string;
  collision: boolean;
  events: Set<string>;
}

// ============================================================================
// MEMORY NODE TYPES
// ============================================================================

export interface ConceptNode {
  node_id: string;
  node_count: number;
  type_count: number;
  type: 'event' | 'thought' | 'chat';
  depth: number;
  created: Date;
  expiration: Date | null;
  last_accessed: Date;
  subject: string;
  predicate: string;
  object: string;
  description: string;
  embedding_key: string;
  poignancy: number;
  keywords: Set<string>;
  filling: string[] | null;
}

// ============================================================================
// SIMULATION META TYPES
// ============================================================================

export interface ReverieMeta {
  fork_sim_code: string;
  start_date: string;
  curr_time: string;
  sec_per_step: number;
  maze_name: string;
  persona_names: string[];
  step: number;
}

export interface Movement {
  persona: Record<string, {
    movement: [number, number];
    pronunciatio: string;
    description: string;
    chat: string;
  }>;
  meta: {
    curr_time: string;
  };
}

export interface Environment {
  [persona_name: string]: {
    x: number;
    y: number;
  };
}

// ============================================================================
// RETRIEVAL TYPES
// ============================================================================

export interface RetrievedContext {
  curr_event: any;
  events: ConceptNode[];
  thoughts: ConceptNode[];
}

export interface RetrievedMemory {
  [key: string]: RetrievedContext;
}

// ============================================================================
// GPT PARAMETER TYPES
// ============================================================================

export interface GPTParameters {
  engine?: string;
  model?: string;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop?: string[];
  stream?: boolean;
}

// ============================================================================
// CLASS TYPE ALIASES (for use in function signatures)
// These are placeholder types - the actual implementations are in their files
// ============================================================================

export type Persona = any;
export type Maze = any;
export type AssociativeMemory = any;
export type Scratch = any;
export type MemoryTree = any;

