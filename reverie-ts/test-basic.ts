#!/usr/bin/env bun

/**
 * Basic test to verify TypeScript compilation and module structure
 */

// Set test environment variables
process.env.OPENROUTER_API_KEY = 'test_key';
process.env.ENV_MATRIX = './test_env/matrix';
process.env.FS_STORAGE = './test_storage';
process.env.FS_TEMP_STORAGE = './test_temp_storage';

import fs from 'fs';
import path from 'path';

// Create test directories
const testDirs = [
  './test_env/matrix',
  './test_env/matrix/special_blocks',
  './test_env/matrix/maze',
  './test_storage',
  './test_storage/reverie',
  './test_storage/environment',
  './test_storage/movement',
  './test_storage/personas',
  './test_temp_storage'
];

for (const dir of testDirs) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Create minimal test maze configuration
const mazeMeta = {
  maze_width: 10,
  maze_height: 10,
  sq_tile_size: 32,
  special_constraint: "test constraint"
};

fs.writeFileSync(
  path.join('./test_env/matrix', 'maze_meta_info.json'),
  JSON.stringify(mazeMeta, null, 2)
);

// Create empty CSV files for maze
const emptyRow = Array(100).fill('0').join(',');
const csvFiles = [
  'collision_maze.csv',
  'sector_maze.csv', 
  'arena_maze.csv',
  'game_object_maze.csv',
  'spawning_location_maze.csv'
];

for (const file of csvFiles) {
  fs.writeFileSync(
    path.join('./test_env/matrix/maze', file),
    emptyRow
  );
}

// Create empty block files
const blockFiles = [
  'world_blocks.csv',
  'sector_blocks.csv',
  'arena_blocks.csv',
  'game_object_blocks.csv',
  'spawning_location_blocks.csv'
];

for (const file of blockFiles) {
  fs.writeFileSync(
    path.join('./test_env/matrix/special_blocks', file),
    '0,World'
  );
}

console.log("Test environment created successfully!");
console.log("\nTesting module imports...");

try {
  // Test importing modules
  const { ChatGPT_single_request } = await import('./src/backend_server/persona/prompt_template/gpt_structure.js');
  console.log("✓ gpt_structure.ts imports successfully");
  
  const { Maze } = await import('./src/backend_server/maze.js');
  console.log("✓ maze.ts imports successfully");
  
  const { Persona } = await import('./src/backend_server/persona/persona.js');
  console.log("✓ persona.ts imports successfully");
  
  const { ReverieServer } = await import('./src/backend_server/reverie.js');
  console.log("✓ reverie.ts imports successfully");
  
  console.log("\nAll modules import successfully!");
  console.log("\nTypeScript port structure is complete.");
  console.log("\nNext steps:");
  console.log("1. Set OPENROUTER_API_KEY in .env file");
  console.log("2. Use actual maze data in environment/matrix/");
  console.log("3. Run with: bun start <origin_sim> <target_sim>");
  
  // Cleanup
  fs.rmSync('./test_env', { recursive: true, force: true });
  fs.rmSync('./test_storage', { recursive: true, force: true });
  fs.rmSync('./test_temp_storage', { recursive: true, force: true });
  
} catch (error) {
  console.error("Error during test:", error);
  
  // Cleanup on error
  try {
    fs.rmSync('./test_env', { recursive: true, force: true });
    fs.rmSync('./test_storage', { recursive: true, force: true });
    fs.rmSync('./test_temp_storage', { recursive: true, force: true });
  } catch (cleanupError) {
    // Ignore cleanup errors
  }
  
  process.exit(1);
}