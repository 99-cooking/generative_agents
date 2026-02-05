# Reverie TypeScript Port

TypeScript port of the Reverie generative agents backend using Bun runtime and OpenRouter API.

## Overview

This project ports the Python backend of the Reverie generative agents simulation to TypeScript, using Bun as the runtime and OpenRouter API for LLM interactions instead of OpenAI.

## Key Changes from Python Version

1. **Runtime**: Bun instead of Python
2. **LLM API**: OpenRouter API instead of direct OpenAI
3. **Models**: 
   - Chat: `deepseek/deepseek-v3.2`
   - Embeddings: `openai/text-embedding-ada-002`
4. **Environment Variable**: `OPENROUTER_API_KEY` required

## Project Structure

```
reverie-ts/
├── src/
│   ├── types.ts                      # TypeScript interfaces
│   ├── index.ts                      # Main entry point
│   └── backend_server/
│       ├── reverie.ts               # Main simulation server
│       ├── maze.ts                  # World/map handling
│       ├── path_finder.ts           # Pathfinding algorithms
│       ├── global_methods.ts        # Utility functions
│       └── persona/
│           ├── persona.ts           # Agent class
│           ├── memory_structures/
│           │   ├── scratch.ts      # Short-term memory
│           │   ├── spatial_memory.ts
│           │   └── associative_memory.ts
│           ├── cognitive_modules/
│           │   ├── perceive.ts
│           │   ├── retrieve.ts
│           │   ├── plan.ts
│           │   ├── execute.ts
│           │   ├── reflect.ts
│           │   └── converse.ts
│           └── prompt_template/
│               ├── gpt_structure.ts # OpenRouter API wrapper
│               └── run_gpt_prompt.ts
├── package.json
├── tsconfig.json
└── .env.example
```

## Setup

1. Install Bun (if not installed):
   ```bash
   curl -fsSL https://bun.sh/install | bash
   ```

2. Install dependencies:
   ```bash
   bun install
   ```

3. Copy environment variables:
   ```bash
   cp .env.example .env
   ```

4. Edit `.env` and add your OpenRouter API key

5. Build the project:
   ```bash
   bun run build
   ```

6. Run the server:
   ```bash
   bun start
   ```

## OpenRouter API Integration

The `gpt_structure.ts` file contains the main API integration:

```typescript
// Example API call
const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'deepseek/deepseek-v3.2',
    messages: [{ role: 'user', content: prompt }]
  })
});
```

## Compatibility

- The TypeScript backend maintains the same HTTP endpoint structure as the Python version
- Uses the same file formats for simulation state
- Can interoperate with the existing Django frontend
- Same folder structure for simulation storage

## Development

- Use `bun run dev` for development with hot reload
- Use `bun run build` to compile TypeScript
- Use `bun test` to run tests (when implemented)

## Notes

This is a direct port of the Python functionality. Some Python-specific patterns have been adapted to TypeScript/JavaScript conventions while maintaining the same overall architecture and behavior.