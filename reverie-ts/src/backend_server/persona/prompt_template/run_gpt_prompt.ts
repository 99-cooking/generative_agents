/**
 * Prompt generation and LLM interaction functions.
 * 
 * This module reads prompt templates from .txt files (same as Python version)
 * and calls the LLM via gpt_structure.ts
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  ChatGPT_safe_generate_response,
  GPT4_safe_generate_response,
  safe_generate_response,
  get_embedding,
  generate_prompt,
  GPTParameters
} from './gpt_structure.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Template directories
const V3_TEMPLATE_DIR = path.join(__dirname, 'v3_ChatGPT');
const V2_TEMPLATE_DIR = path.join(__dirname, 'v2');

/**
 * Read a prompt template file
 */
function readTemplate(templatePath: string): string {
  const fullPath = path.join(V3_TEMPLATE_DIR, templatePath);
  if (fs.existsSync(fullPath)) {
    return fs.readFileSync(fullPath, 'utf-8');
  }
  // Fallback to v2
  const v2Path = path.join(V2_TEMPLATE_DIR, templatePath);
  if (fs.existsSync(v2Path)) {
    return fs.readFileSync(v2Path, 'utf-8');
  }
  throw new Error(`Template not found: ${templatePath}`);
}

// ============================================================================
// WAKE UP AND DAILY PLANNING
// ============================================================================

export async function run_gpt_prompt_wake_up_hour(
  persona: any,
  test_input: string | null = null,
  verbose: boolean = false
): Promise<[number, any]> {
  const template = readTemplate('wake_up_hour_v1.txt');
  const prompt = generate_prompt([
    persona.scratch.get_str_iss(),
    persona.scratch.get_str_lifestyle(),
    persona.scratch.get_str_firstname()
  ], template);

  const funcValidate = (response: string): boolean => {
    try {
      const hour = parseInt(response.trim());
      return hour >= 0 && hour <= 23;
    } catch {
      return false;
    }
  };

  const funcCleanUp = (response: string): number => {
    return parseInt(response.trim());
  };

  const failSafe = 8; // Default 8 AM
  
  const output = await ChatGPT_safe_generate_response(
    prompt,
    "8",
    "Output only an integer between 0 and 23.",
    3,
    String(failSafe),
    funcValidate,
    funcCleanUp,
    verbose
  );

  return [typeof output === 'number' ? output : failSafe, null];
}

export async function run_gpt_prompt_daily_plan(
  persona: any,
  wake_up_hour: number,
  test_input: string | null = null,
  verbose: boolean = false
): Promise<[string[], any]> {
  const template = readTemplate('daily_planning_v5.txt');
  const prompt = generate_prompt([
    persona.scratch.get_str_iss(),
    persona.scratch.get_str_lifestyle(),
    persona.scratch.get_str_curr_date_str(),
    persona.scratch.get_str_firstname(),
    String(wake_up_hour)
  ], template);

  const funcValidate = (response: string): boolean => {
    return response.includes(')');
  };

  const funcCleanUp = (response: string): string[] => {
    // Parse numbered list like "1) wake up 2) eat breakfast..."
    const lines = response.split(/\d+\)/).filter(s => s.trim());
    return lines.map(s => s.trim());
  };

  const failSafe = [
    'wake up and complete morning routine',
    'have breakfast',
    'work on daily tasks',
    'have lunch',
    'continue working',
    'have dinner',
    'relax and wind down',
    'go to sleep'
  ];

  const output = await ChatGPT_safe_generate_response(
    prompt,
    "1) wake up 2) eat breakfast",
    "Output a numbered list of daily activities.",
    3,
    failSafe.join(', '),
    funcValidate,
    funcCleanUp,
    verbose
  );

  return [Array.isArray(output) ? output : failSafe, null];
}

export async function run_gpt_prompt_generate_hourly_schedule(
  persona: any,
  curr_hour_str: string,
  p_f_ds_hourly_org_or_activity: any = [],
  hour_str: string[] = [],
  n_m1_activity: string[] = [],
  test_input: string | null = null,
  verbose: boolean = false
): Promise<[string, any]> {
  const template = readTemplate('hourly_schedule_v2.txt');
  const scheduleStr = p_f_ds_hourly_org_or_activity.map(([act, dur]) => `${act} (${dur} min)`).join(', ');
  
  const prompt = generate_prompt([
    persona.scratch.get_str_iss(),
    persona.scratch.get_str_lifestyle(),
    persona.scratch.get_str_curr_date_str(),
    scheduleStr,
    curr_hour_str,
    persona.scratch.get_str_firstname()
  ], template);

  const funcValidate = (response: string): boolean => response.length > 0;
  const funcCleanUp = (response: string): string => response.trim();
  const failSafe = 'doing regular activities';

  const output = await ChatGPT_safe_generate_response(
    prompt,
    "working on tasks",
    "Output a brief activity description.",
    3,
    failSafe,
    funcValidate,
    funcCleanUp,
    verbose
  );

  return [typeof output === 'string' ? output : failSafe, null];
}

export async function run_gpt_prompt_task_decomp(
  persona: any,
  task: string,
  duration: number,
  test_input: string | null = null,
  verbose: boolean = false
): Promise<[[string, number][], any]> {
  const template = readTemplate('task_decomp_v2.txt');
  const prompt = generate_prompt([
    persona.scratch.get_str_iss(),
    persona.scratch.get_str_curr_date_str(),
    persona.scratch.get_str_firstname(),
    task,
    String(duration)
  ], template);

  const funcValidate = (response: string): boolean => {
    return response.includes('(') && response.includes(')');
  };

  const funcCleanUp = (response: string): [string, number][] => {
    // Parse format like "task1 (10 min), task2 (5 min)"
    const parts = response.split(',');
    return parts.map(part => {
      const match = part.match(/(.+?)\s*\((\d+)/);
      if (match) {
        return [match[1].trim(), parseInt(match[2])];
      }
      return [part.trim(), Math.floor(duration / parts.length)];
    });
  };

  const failSafe: [string, number][] = [[task, duration]];

  const output = await ChatGPT_safe_generate_response(
    prompt,
    "subtask1 (5 min), subtask2 (10 min)",
    "Output subtasks with durations in parentheses.",
    3,
    JSON.stringify(failSafe),
    funcValidate,
    funcCleanUp,
    verbose
  );

  return [Array.isArray(output) ? output as [string, number][] : failSafe, null];
}

// ============================================================================
// LOCATION SELECTION
// ============================================================================

export async function run_gpt_prompt_action_sector(
  act_desp: string,
  persona: any,
  maze: any,
  test_input: string | null = null,
  verbose: boolean = false
): Promise<[string, any]> {
  const template = readTemplate('action_location_v1.txt');
  const accessibleSectors = persona.s_mem.get_str_accessible_sectors(
    persona.scratch.curr_tile ? maze.access_tile(persona.scratch.curr_tile).world : ''
  );

  const prompt = generate_prompt([
    persona.scratch.get_str_iss(),
    accessibleSectors,
    act_desp,
    persona.scratch.get_str_firstname()
  ], template);

  const sectorList = accessibleSectors.split(',').map((s: string) => s.trim());
  
  const funcValidate = (response: string): boolean => {
    return sectorList.some((s: string) => response.toLowerCase().includes(s.toLowerCase()));
  };

  const funcCleanUp = (response: string): string => {
    for (const sector of sectorList) {
      if (response.toLowerCase().includes(sector.toLowerCase())) {
        return sector;
      }
    }
    return sectorList[0] || response.trim();
  };

  const failSafe = persona.scratch.living_area || sectorList[0] || 'home';

  const output = await ChatGPT_safe_generate_response(
    prompt,
    sectorList[0] || "home",
    "Output only the location name.",
    3,
    failSafe,
    funcValidate,
    funcCleanUp,
    verbose
  );

  return [typeof output === 'string' ? output : failSafe, null];
}

export async function run_gpt_prompt_action_arena(
  act_desp: string,
  persona: any,
  maze: any,
  act_world: string,
  act_sector: string,
  test_input: string | null = null,
  verbose: boolean = false
): Promise<[string, any]> {
  const accessibleArenas = persona.s_mem.get_str_accessible_sector_arenas(
    `${act_world}:${act_sector}`
  );
  const arenaList = accessibleArenas.split(',').map((s: string) => s.trim());
  
  const failSafe = arenaList[0] || 'main area';

  // Simple selection for now
  const funcValidate = (response: string): boolean => {
    return arenaList.some((a: string) => response.toLowerCase().includes(a.toLowerCase()));
  };

  const funcCleanUp = (response: string): string => {
    for (const arena of arenaList) {
      if (response.toLowerCase().includes(arena.toLowerCase())) {
        return arena;
      }
    }
    return arenaList[0] || response.trim();
  };

  const prompt = `Given the task "${act_desp}", which area should ${persona.scratch.get_str_firstname()} go to? Options: ${accessibleArenas}`;

  const output = await ChatGPT_safe_generate_response(
    prompt,
    arenaList[0] || "room",
    "Output only the area name.",
    3,
    failSafe,
    funcValidate,
    funcCleanUp,
    verbose
  );

  return [typeof output === 'string' ? output : failSafe, null];
}

export async function run_gpt_prompt_action_game_object(
  act_desp: string,
  persona: any,
  maze: any,
  act_address: string,
  test_input: string | null = null,
  verbose: boolean = false
): Promise<[string, any]> {
  const accessibleObjects = persona.s_mem.get_str_accessible_arena_game_objects(act_address);
  const objectList = accessibleObjects.split(',').map((s: string) => s.trim());
  
  const failSafe = objectList[0] || 'object';

  const funcValidate = (response: string): boolean => {
    return objectList.some((o: string) => response.toLowerCase().includes(o.toLowerCase()));
  };

  const funcCleanUp = (response: string): string => {
    for (const obj of objectList) {
      if (response.toLowerCase().includes(obj.toLowerCase())) {
        return obj;
      }
    }
    return objectList[0] || response.trim();
  };

  const prompt = `For the task "${act_desp}", which object should ${persona.scratch.get_str_firstname()} use? Options: ${accessibleObjects}`;

  const output = await ChatGPT_safe_generate_response(
    prompt,
    objectList[0] || "desk",
    "Output only the object name.",
    3,
    failSafe,
    funcValidate,
    funcCleanUp,
    verbose
  );

  return [typeof output === 'string' ? output : failSafe, null];
}

// ============================================================================
// EVENT AND ACTION GENERATION
// ============================================================================

export async function run_gpt_prompt_pronunciatio(
  act_desp: string,
  persona: any,
  test_input: string | null = null,
  verbose: boolean = false
): Promise<[string, any]> {
  const template = readTemplate('generate_pronunciatio_v1.txt');
  const prompt = generate_prompt([act_desp], template);

  const funcValidate = (response: string): boolean => response.length > 0;
  const funcCleanUp = (response: string): string => {
    // Extract emoji from response
    const emojiMatch = response.match(/[\p{Emoji}]/gu);
    return emojiMatch ? emojiMatch.slice(0, 3).join('') : '😐';
  };

  const output = await ChatGPT_safe_generate_response(
    prompt,
    "😊",
    "Output 1-3 emojis representing the action.",
    3,
    "😐",
    funcValidate,
    funcCleanUp,
    verbose
  );

  return [typeof output === 'string' ? output : '😐', null];
}

export async function run_gpt_prompt_event_triple(
  act_desp: string,
  persona: any,
  test_input: string | null = null,
  verbose: boolean = false
): Promise<[[string, string, string], any]> {
  const template = readTemplate('generate_event_v1.txt');
  const prompt = generate_prompt([
    persona.scratch.get_str_firstname(),
    act_desp
  ], template);

  const funcValidate = (response: string): boolean => {
    return response.includes('(') && response.includes(')');
  };

  const funcCleanUp = (response: string): [string, string, string] => {
    // Parse format like "(subject, predicate, object)"
    const match = response.match(/\(([^,]+),\s*([^,]+),\s*([^)]+)\)/);
    if (match) {
      return [match[1].trim(), match[2].trim(), match[3].trim()];
    }
    return [persona.name, 'is', act_desp];
  };

  const failSafe: [string, string, string] = [persona.name, 'is', act_desp];

  const output = await ChatGPT_safe_generate_response(
    prompt,
    "(John, is, working)",
    "Output a triple in format (subject, predicate, object).",
    3,
    `(${failSafe.join(', ')})`,
    funcValidate,
    funcCleanUp,
    verbose
  );

  return [Array.isArray(output) ? output as [string, string, string] : failSafe, null];
}

export async function run_gpt_prompt_act_obj_desc(
  act_game_object: string,
  act_desp: string,
  persona: any,
  test_input: string | null = null,
  verbose: boolean = false
): Promise<[string, any]> {
  const prompt = `What state is the ${act_game_object} in when ${persona.scratch.get_str_firstname()} is ${act_desp}?`;

  const funcValidate = (response: string): boolean => response.length > 0;
  const funcCleanUp = (response: string): string => response.trim();
  const failSafe = 'in use';

  const output = await ChatGPT_safe_generate_response(
    prompt,
    "being used",
    "Output a brief state description.",
    3,
    failSafe,
    funcValidate,
    funcCleanUp,
    verbose
  );

  return [typeof output === 'string' ? output : failSafe, null];
}

export async function run_gpt_prompt_act_obj_event_triple(
  act_game_object: string,
  act_obj_desc: string,
  persona: any,
  test_input: string | null = null,
  verbose: boolean = false
): Promise<[[string, string, string], any]> {
  const prompt = `Express "${act_game_object} is ${act_obj_desc}" as a triple (subject, predicate, object).`;

  const failSafe: [string, string, string] = [act_game_object, 'is', act_obj_desc];

  const funcValidate = (response: string): boolean => {
    return response.includes('(') && response.includes(')');
  };

  const funcCleanUp = (response: string): [string, string, string] => {
    const match = response.match(/\(([^,]+),\s*([^,]+),\s*([^)]+)\)/);
    if (match) {
      return [match[1].trim(), match[2].trim(), match[3].trim()];
    }
    return failSafe;
  };

  const output = await ChatGPT_safe_generate_response(
    prompt,
    "(desk, is, occupied)",
    "Output a triple in format (subject, predicate, object).",
    3,
    `(${failSafe.join(', ')})`,
    funcValidate,
    funcCleanUp,
    verbose
  );

  return [Array.isArray(output) ? output as [string, string, string] : failSafe, null];
}

// ============================================================================
// CONVERSATION AND SOCIAL
// ============================================================================

export async function run_gpt_prompt_decide_to_talk(
  persona: any,
  target_persona: any,
  retrieved: any,
  test_input: string | null = null,
  verbose: boolean = false
): Promise<[boolean, any]> {
  const prompt = `Should ${persona.scratch.get_str_firstname()} initiate a conversation with ${target_persona.scratch.get_str_firstname()}? Answer yes or no.`;

  const funcValidate = (response: string): boolean => {
    const lower = response.toLowerCase();
    return lower.includes('yes') || lower.includes('no');
  };

  const funcCleanUp = (response: string): boolean => {
    return response.toLowerCase().includes('yes');
  };

  const output = await ChatGPT_safe_generate_response(
    prompt,
    "no",
    "Answer yes or no.",
    3,
    "no",
    funcValidate,
    funcCleanUp,
    verbose
  );

  return [typeof output === 'boolean' ? output : false, null];
}

export async function run_gpt_prompt_decide_to_react(
  persona: any,
  target_persona: any,
  retrieved: any,
  test_input: string | null = null,
  verbose: boolean = false
): Promise<[boolean, any]> {
  const prompt = `Should ${persona.scratch.get_str_firstname()} react to ${target_persona.scratch.get_str_firstname()}'s presence? Answer yes or no.`;

  const funcValidate = (response: string): boolean => {
    const lower = response.toLowerCase();
    return lower.includes('yes') || lower.includes('no');
  };

  const funcCleanUp = (response: string): boolean => {
    return response.toLowerCase().includes('yes');
  };

  const output = await ChatGPT_safe_generate_response(
    prompt,
    "no",
    "Answer yes or no.",
    3,
    "no",
    funcValidate,
    funcCleanUp,
    verbose
  );

  return [typeof output === 'boolean' ? output : false, null];
}

export async function run_gpt_prompt_create_conversation(
  persona: any,
  target_persona: any,
  curr_loc: string,
  test_input: string | null = null,
  verbose: boolean = false
): Promise<[[string, string][], any]> {
  const prompt = `Create a brief conversation between ${persona.scratch.get_str_firstname()} and ${target_persona.scratch.get_str_firstname()} at ${curr_loc}.`;

  const failSafe: [string, string][] = [
    [persona.name, 'Hello!'],
    [target_persona.name, 'Hi there!']
  ];

  const funcValidate = (response: string): boolean => response.length > 10;
  
  const funcCleanUp = (response: string): [string, string][] => {
    // Try to parse conversation format
    const lines = response.split('\n').filter(l => l.trim());
    const result: [string, string][] = [];
    for (const line of lines) {
      const match = line.match(/^([^:]+):\s*(.+)$/);
      if (match) {
        result.push([match[1].trim(), match[2].trim()]);
      }
    }
    return result.length > 0 ? result : failSafe;
  };

  const output = await ChatGPT_safe_generate_response(
    prompt,
    "Person1: Hello!\nPerson2: Hi!",
    "Output a conversation with format 'Name: dialogue'.",
    3,
    JSON.stringify(failSafe),
    funcValidate,
    funcCleanUp,
    verbose
  );

  return [Array.isArray(output) ? output as [string, string][] : failSafe, null];
}

export async function run_gpt_prompt_summarize_conversation(
  persona: any,
  conversation: [string, string][],
  test_input: string | null = null,
  verbose: boolean = false
): Promise<[string, any]> {
  const convoStr = conversation.map(([name, text]) => `${name}: ${text}`).join('\n');
  const prompt = `Summarize this conversation:\n${convoStr}`;

  const funcValidate = (response: string): boolean => response.length > 5;
  const funcCleanUp = (response: string): string => response.trim();
  const failSafe = 'Had a brief conversation.';

  const output = await ChatGPT_safe_generate_response(
    prompt,
    "They discussed their day.",
    "Output a brief summary.",
    3,
    failSafe,
    funcValidate,
    funcCleanUp,
    verbose
  );

  return [typeof output === 'string' ? output : failSafe, null];
}

// ============================================================================
// REFLECTION AND POIGNANCY
// ============================================================================

export async function run_gpt_prompt_event_poignancy(
  persona: any,
  event_description: string,
  test_input: string | null = null,
  verbose: boolean = false
): Promise<[number, any]> {
  const template = readTemplate('poignancy_event_v1.txt');
  const prompt = generate_prompt([
    persona.scratch.get_str_iss(),
    persona.scratch.get_str_firstname(),
    event_description
  ], template);

  const funcValidate = (response: string): boolean => {
    const num = parseInt(response.trim());
    return !isNaN(num) && num >= 1 && num <= 10;
  };

  const funcCleanUp = (response: string): number => {
    return parseInt(response.trim());
  };

  const failSafe = 5;

  const output = await ChatGPT_safe_generate_response(
    prompt,
    "5",
    "Output a number between 1 and 10.",
    3,
    String(failSafe),
    funcValidate,
    funcCleanUp,
    verbose
  );

  return [typeof output === 'number' ? output : failSafe, null];
}

export async function run_gpt_prompt_thought_poignancy(
  persona: any,
  thought_description: string,
  test_input: string | null = null,
  verbose: boolean = false
): Promise<[number, any]> {
  const template = readTemplate('poignancy_thought_v1.txt');
  const prompt = generate_prompt([
    persona.scratch.get_str_iss(),
    persona.scratch.get_str_firstname(),
    thought_description
  ], template);

  const funcValidate = (response: string): boolean => {
    const num = parseInt(response.trim());
    return !isNaN(num) && num >= 1 && num <= 10;
  };

  const funcCleanUp = (response: string): number => {
    return parseInt(response.trim());
  };

  const failSafe = 5;

  const output = await ChatGPT_safe_generate_response(
    prompt,
    "5",
    "Output a number between 1 and 10.",
    3,
    String(failSafe),
    funcValidate,
    funcCleanUp,
    verbose
  );

  return [typeof output === 'number' ? output : failSafe, null];
}

export async function run_gpt_prompt_chat_poignancy(
  persona: any,
  chat_description: string,
  test_input: string | null = null,
  verbose: boolean = false
): Promise<[number, any]> {
  return run_gpt_prompt_event_poignancy(persona, chat_description, test_input, verbose);
}

export async function run_gpt_prompt_focal_pt(
  persona: any,
  statements: string,
  n: number,
  test_input: string | null = null,
  verbose: boolean = false
): Promise<[string[], any]> {
  const template = readTemplate('generate_focal_pt_v1.txt');
  const prompt = generate_prompt([statements, String(n)], template);

  const funcValidate = (response: string): boolean => response.length > 0;
  
  const funcCleanUp = (response: string): string[] => {
    return response.split('\n').filter(s => s.trim()).slice(0, n);
  };

  const failSafe = ['daily activities'];

  const output = await ChatGPT_safe_generate_response(
    prompt,
    "1. topic one\n2. topic two",
    `Output ${n} focal points.`,
    3,
    failSafe.join('\n'),
    funcValidate,
    funcCleanUp,
    verbose
  );

  return [Array.isArray(output) ? output : failSafe, null];
}

export async function run_gpt_prompt_insight_and_guidance(
  persona: any,
  statements: string,
  n: number,
  test_input: string | null = null,
  verbose: boolean = false
): Promise<[string[], any]> {
  const prompt = `Based on: ${statements}\n\nGenerate ${n} insights for ${persona.scratch.get_str_firstname()}.`;

  const funcValidate = (response: string): boolean => response.length > 0;
  
  const funcCleanUp = (response: string): string[] => {
    return response.split('\n').filter(s => s.trim()).slice(0, n);
  };

  const failSafe = ['Continue with daily routine.'];

  const output = await ChatGPT_safe_generate_response(
    prompt,
    "1. insight one",
    `Output ${n} insights.`,
    3,
    failSafe.join('\n'),
    funcValidate,
    funcCleanUp,
    verbose
  );

  return [Array.isArray(output) ? output : failSafe, null];
}

export async function run_gpt_prompt_new_decomp_schedule(
  persona: any,
  main_act_dur: [string, number][],
  truncated_act_dur: [string, number][],
  start_time_hour: number,
  end_time_hour: number,
  inserted_act: string,
  inserted_act_dur: number,
  test_input: string | null = null,
  verbose: boolean = false
): Promise<[[string, number][], any]> {
  // Return original schedule as default - complex rescheduling would need more logic
  return [main_act_dur, null];
}

// ============================================================================
// KEYWORD AND MEMORY FUNCTIONS
// ============================================================================

export async function run_gpt_prompt_extract_keywords(
  persona: any,
  description: string,
  test_input: string | null = null,
  verbose: boolean = false
): Promise<[string[], any]> {
  const prompt = `Extract key words from: "${description}"`;

  const funcValidate = (response: string): boolean => response.length > 0;
  const funcCleanUp = (response: string): string[] => {
    return response.split(',').map(s => s.trim().toLowerCase());
  };

  const failSafe = [description.split(' ')[0] || 'activity'];

  const output = await ChatGPT_safe_generate_response(
    prompt,
    "word1, word2, word3",
    "Output comma-separated keywords.",
    3,
    failSafe.join(', '),
    funcValidate,
    funcCleanUp,
    verbose
  );

  return [Array.isArray(output) ? output : failSafe, null];
}

export async function run_gpt_prompt_keyword_to_thoughts(
  persona: any,
  keyword: string,
  concept_summary: string,
  test_input: string | null = null,
  verbose: boolean = false
): Promise<[string, any]> {
  const prompt = `What might ${persona.scratch.get_str_firstname()} think about "${keyword}" given: ${concept_summary}`;

  const funcValidate = (response: string): boolean => response.length > 0;
  const funcCleanUp = (response: string): string => response.trim();
  const failSafe = `Thinking about ${keyword}.`;

  const output = await ChatGPT_safe_generate_response(
    prompt,
    "I should consider...",
    "Output a thought.",
    3,
    failSafe,
    funcValidate,
    funcCleanUp,
    verbose
  );

  return [typeof output === 'string' ? output : failSafe, null];
}

export async function run_gpt_prompt_convo_to_thoughts(
  persona: any,
  convo_str: string,
  fin_target: string,
  test_input: string | null = null,
  verbose: boolean = false
): Promise<[string, any]> {
  const prompt = `After this conversation with ${fin_target}:\n${convo_str}\n\nWhat might ${persona.scratch.get_str_firstname()} think?`;

  const funcValidate = (response: string): boolean => response.length > 0;
  const funcCleanUp = (response: string): string => response.trim();
  const failSafe = `Reflecting on the conversation with ${fin_target}.`;

  const output = await ChatGPT_safe_generate_response(
    prompt,
    "That was an interesting conversation.",
    "Output a reflection thought.",
    3,
    failSafe,
    funcValidate,
    funcCleanUp,
    verbose
  );

  return [typeof output === 'string' ? output : failSafe, null];
}

// Additional prompt functions that may be referenced
export async function run_gpt_prompt_planning_thought_on_convo(
  persona: any,
  conversation: any,
  test_input: string | null = null,
  verbose: boolean = false
): Promise<[string, any]> {
  return ['Reflecting on the conversation.', null];
}

export async function run_gpt_prompt_memo_on_convo(
  persona: any,
  conversation: any,
  test_input: string | null = null,
  verbose: boolean = false
): Promise<[string, any]> {
  return ['Noted the conversation.', null];
}
