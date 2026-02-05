#!/usr/bin/env bun

/**
 * Main entry point for Reverie TypeScript backend
 */

import { ReverieServer } from './backend_server/reverie.js';
import * as fs from 'fs';
import * as path from 'path';

console.log("========================================");
console.log("Reverie TypeScript Backend");
console.log("Using OpenRouter API with deepseek/deepseek-v3.2");
console.log("Embedding model: openai/text-embedding-ada-002");
console.log("========================================\n");

// Check for API key
if (!process.env.OPENROUTER_API_KEY) {
  console.error("ERROR: OPENROUTER_API_KEY environment variable is not set");
  console.error("Please set it in your .env file or export it:");
  console.error("  export OPENROUTER_API_KEY=your_key_here");
  process.exit(1);
}

// Check for required environment variables
const requiredEnvVars = ['ENV_MATRIX', 'FS_STORAGE', 'FS_TEMP_STORAGE'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  console.error("Missing required environment variables:");
  missingEnvVars.forEach(varName => {
    console.error(`  - ${varName}`);
  });
  console.error("\nPlease set these in your .env file.");
  process.exit(1);
}

// Create necessary directories if they don't exist
const directories = [
  process.env.FS_STORAGE!,
  process.env.FS_TEMP_STORAGE!,
  path.join(process.env.FS_STORAGE!, 'reverie'),
  path.join(process.env.FS_STORAGE!, 'environment'),
  path.join(process.env.FS_STORAGE!, 'movement'),
  path.join(process.env.FS_TEMP_STORAGE!)
];

for (const dir of directories) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`Created directory: ${dir}`);
  }
}

// Main function
async function main() {
  console.log("Server starting...\n");
  
  // Check if we have command line arguments for simulation codes
  const args = process.argv.slice(2);
  
  if (args.length >= 2) {
    // Start with provided simulation codes
    const origin = args[0];
    const target = args[1];
    
    console.log(`Forking from: ${origin}`);
    console.log(`Creating new simulation: ${target}`);
    
    try {
      const rs = new ReverieServer(origin, target);
      rs.open_server();
    } catch (error) {
      console.error("Error starting Reverie server:", error);
      process.exit(1);
    }
  } else {
    // Interactive mode
    console.log("Interactive mode");
    console.log("To start a simulation, run:");
    console.log("  bun start <origin_simulation> <target_simulation>");
    console.log("\nExample:");
    console.log("  bun start base_the_ville_isabella_maria_klaus July1_the_ville_isabella_maria_klaus-step-3-1");
    
    // Could add interactive prompts here
    console.log("\nServer ready. Use Ctrl+C to exit.");
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log("\nShutting down Reverie server...");
  process.exit(0);
});

main().catch(error => {
  console.error("Fatal error:", error);
  process.exit(1);
});