/**
 * Conversation module for generative agents.
 */

import type { ConceptNode, Persona, Maze } from '../../../types.js';
import {
  ChatGPT_safe_generate_response,
  get_embedding
} from '../prompt_template/gpt_structure.js';
import {
  run_gpt_prompt_event_triple,
  run_gpt_prompt_event_poignancy,
  run_gpt_prompt_chat_poignancy
} from '../prompt_template/run_gpt_prompt.js';
import { new_retrieve } from './retrieve.js';


export const generate_agent_chat_summarize_ideas = async (
  init_persona: Persona,
  target_persona: Persona,
  retrieved: Record<string, ConceptNode[]>,
  curr_context: string
): Promise<string> => {
  const all_embedding_keys: string[] = [];
  
  for (const [key, val] of Object.entries(retrieved)) {
    for (const i of val) {
      all_embedding_keys.push(i.embedding_key);
    }
  }
  
  let all_embedding_key_str = "";
  for (const i of all_embedding_keys) {
    all_embedding_key_str += `${i}\n`;
  }

  try {
    const summarized_idea = await run_gpt_prompt_agent_chat_summarize_ideas(
      init_persona,
      target_persona,
      all_embedding_key_str,
      curr_context
    );
    return summarized_idea[0];
  } catch {
    return "";
  }
};

export const generate_summarize_agent_relationship = async (
  init_persona: Persona,
  target_persona: Persona,
  retrieved: Record<string, ConceptNode[]>
): Promise<string> => {
  const all_embedding_keys: string[] = [];
  
  for (const [key, val] of Object.entries(retrieved)) {
    for (const i of val) {
      all_embedding_keys.push(i.embedding_key);
    }
  }
  
  let all_embedding_key_str = "";
  for (const i of all_embedding_keys) {
    all_embedding_key_str += `${i}\n`;
  }

  const summarized_relationship = await run_gpt_prompt_agent_chat_summarize_relationship(
    init_persona,
    target_persona,
    all_embedding_key_str
  );
  return summarized_relationship[0];
};

export const generate_agent_chat = async (
  maze: Maze,
  init_persona: Persona,
  target_persona: Persona,
  curr_context: string,
  init_summ_idea: string,
  target_summ_idea: string
): Promise<string[]> => {
  const summarized_idea = await run_gpt_prompt_agent_chat(
    maze,
    init_persona,
    target_persona,
    curr_context,
    init_summ_idea,
    target_summ_idea
  );
  
  for (const i of summarized_idea[0]) {
    console.log(i);
  }
  
  return summarized_idea[0];
};

export const agent_chat_v1 = async (
  maze: Maze,
  init_persona: Persona,
  target_persona: Persona
): Promise<string[]> => {
  // Chat version optimized for speed via batch generation
  let curr_context = `${init_persona.scratch.name} ` +
    `was ${init_persona.scratch.act_description} ` +
    `when ${init_persona.scratch.name} ` +
    `saw ${target_persona.scratch.name} ` +
    `in the middle of ${target_persona.scratch.act_description}.\n`;
  
  curr_context += `${init_persona.scratch.name} ` +
    `is thinking of initating a conversation with ` +
    `${target_persona.scratch.name}.`;

  const summarized_ideas: string[] = [];
  const part_pairs = [[init_persona, target_persona], [target_persona, init_persona]];
  
  for (const [p_1, p_2] of part_pairs) {
    const focal_points = [`${p_2.scratch.name}`];
    const retrieved = await new_retrieve(p_1, focal_points, 50);
    const relationship = await generate_summarize_agent_relationship(p_1, p_2, retrieved);
    
    const focal_points2 = [
      `${relationship}`,
      `${p_2.scratch.name} is ${p_2.scratch.act_description}`
    ];
    const retrieved2 = await new_retrieve(p_1, focal_points2, 25);
    const summarized_idea = await generate_agent_chat_summarize_ideas(p_1, p_2, retrieved2, curr_context);
    summarized_ideas.push(summarized_idea);
  }

  return await generate_agent_chat(
    maze,
    init_persona,
    target_persona,
    curr_context,
    summarized_ideas[0],
    summarized_ideas[1]
  );
};

export const generate_one_utterance = async (
  maze: Maze,
  init_persona: Persona,
  target_persona: Persona,
  retrieved: Record<string, ConceptNode[]>,
  curr_chat: [string, string][]
): Promise<{ utterance: string; end: boolean }> => {
  // Chat version optimized for speed via batch generation
  let curr_context = `${init_persona.scratch.name} ` +
    `was ${init_persona.scratch.act_description} ` +
    `when ${init_persona.scratch.name} ` +
    `saw ${target_persona.scratch.name} ` +
    `in the middle of ${target_persona.scratch.act_description}.\n`;
  
  curr_context += `${init_persona.scratch.name} ` +
    `is initiating a conversation with ` +
    `${target_persona.scratch.name}.`;

  console.log("July 23 5");
  const x = await run_gpt_generate_iterative_chat_utt(
    maze,
    init_persona,
    target_persona,
    retrieved,
    curr_context,
    curr_chat
  );

  console.log("July 23 6");
  console.log("adshfoa;khdf;fajslkfjald;sdfa HERE", x);

  return { utterance: (x as any)[0]?.utterance || "", end: (x as any)[0]?.end || false };
};

export const agent_chat_v2 = async (
  maze: Maze,
  init_persona: Persona,
  target_persona: Persona
): Promise<[string, string][]> => {
  const curr_chat: [string, string][] = [];
  console.log("July 23");

  for (let i = 0; i < 8; i++) {
    const focal_points = [`${target_persona.scratch.name}`];
    const retrieved = await new_retrieve(init_persona, focal_points, 50);
    const relationship = await generate_summarize_agent_relationship(init_persona, target_persona, retrieved);
    
    console.log("-------- relationshopadsjfhkalsdjf", relationship);
    let last_chat = "";
    
    for (const chat_item of curr_chat.slice(-4)) {
      last_chat += `${chat_item[0]}: ${chat_item[1]}\n`;
    }
    
    const focal_points2 = last_chat
      ? [
          `${relationship}`,
          `${target_persona.scratch.name} is ${target_persona.scratch.act_description}`,
          last_chat
        ]
      : [
          `${relationship}`,
          `${target_persona.scratch.name} is ${target_persona.scratch.act_description}`
        ];
    
    const retrieved2 = await new_retrieve(init_persona, focal_points2, 15);
    const { utterance: utt, end } = await generate_one_utterance(
      maze,
      init_persona,
      target_persona,
      retrieved2,
      curr_chat
    );

    curr_chat.push([init_persona.scratch.name, utt]);
    
    if (end) {
      break;
    }

    // Now for target persona's turn
    const focal_points3 = [`${init_persona.scratch.name}`];
    const retrieved3 = await new_retrieve(target_persona, focal_points3, 50);
    const relationship2 = await generate_summarize_agent_relationship(target_persona, init_persona, retrieved3);
    
    console.log("-------- relationshopadsjfhkalsdjf", relationship2);
    let last_chat2 = "";
    
    for (const chat_item of curr_chat.slice(-4)) {
      last_chat2 += `${chat_item[0]}: ${chat_item[1]}\n`;
    }
    
    const focal_points4 = last_chat2
      ? [
          `${relationship2}`,
          `${init_persona.scratch.name} is ${init_persona.scratch.act_description}`,
          last_chat2
        ]
      : [
          `${relationship2}`,
          `${init_persona.scratch.name} is ${init_persona.scratch.act_description}`
        ];
    
    const retrieved4 = await new_retrieve(target_persona, focal_points4, 15);
    const { utterance: utt2, end: end2 } = await generate_one_utterance(
      maze,
      target_persona,
      init_persona,
      retrieved4,
      curr_chat
    );

    curr_chat.push([target_persona.scratch.name, utt2]);
    
    if (end2) {
      break;
    }
  }

  console.log("July 23 PU");
  for (const row of curr_chat) {
    console.log(row);
  }
  console.log("July 23 FIN");

  return curr_chat;
};

export const generate_summarize_ideas = async (
  persona: Persona,
  nodes: ConceptNode[],
  question: string
): Promise<string> => {
  let statements = "";
  for (const n of nodes) {
    statements += `${n.embedding_key}\n`;
  }
  
  const summarized_idea = await run_gpt_prompt_summarize_ideas(persona, statements, question);
  return summarized_idea[0];
};

export const generate_next_line = async (
  persona: Persona,
  interlocutor_desc: string,
  curr_convo: [string, string][],
  summarized_idea: string
): Promise<string> => {
  // Original chat -- line by line generation 
  let prev_convo = "";
  for (const row of curr_convo) {
    prev_convo += `${row[0]}: ${row[1]}\n`;
  }

  const next_line = await run_gpt_prompt_generate_next_convo_line(
    persona,
    interlocutor_desc,
    prev_convo,
    summarized_idea
  );
  
  return next_line[0];
};

export const generate_inner_thought = async (
  persona: Persona,
  whisper: string
): Promise<string> => {
  const inner_thought = await run_gpt_prompt_generate_whisper_inner_thought(persona, whisper);
  return inner_thought[0];
};

export const generate_action_event_triple = async (
  act_desp: string,
  persona: Persona
): Promise<[string, string, string]> => {
  /** TODO
   * INPUT: 
   *   act_desp: the description of the action (e.g., "sleeping")
   *   persona: The Persona class instance
   * OUTPUT: 
   *   a string of emoji that translates action description.
   * EXAMPLE OUTPUT: 
   *   "🧈🍞"
   */
  const debug = false; // Assuming debug is false by default
  if (debug) console.log("GNS FUNCTION: <generate_action_event_triple>");
  
  const result = await run_gpt_prompt_event_triple(act_desp, persona);
  return result[0];
};

export const generate_poig_score = async (
  persona: Persona,
  event_type: string,
  description: string
): Promise<number> => {
  const debug = false; // Assuming debug is false by default
  
  if (debug) console.log("GNS FUNCTION: <generate_poig_score>");

  if (description.includes("is idle")) {
    return 1;
  }

  if (event_type === "event" || event_type === "thought") {
    const result = await run_gpt_prompt_event_poignancy(persona, description);
    return result[0];
  } else if (event_type === "chat") {
    const result = await run_gpt_prompt_chat_poignancy(persona, persona.scratch.act_description);
    return result[0];
  }
  
  return 1; // Default score
};

export const load_history_via_whisper = async (
  personas: Record<string, Persona>,
  whispers: [string, string][]
): Promise<void> => {
  for (const [count, row] of whispers.entries()) {
    const persona = personas[row[0]];
    const whisper = row[1];

    const thought = await generate_inner_thought(persona, whisper);

    const created = persona.scratch.curr_time;
    const expiration = new Date(created.getTime() + 30 * 24 * 60 * 60 * 1000); // +30 days
    const [s, p, o] = await generate_action_event_triple(thought, persona);
    const keywords = new Set([s, p, o]);
    const thought_poignancy = await generate_poig_score(persona, "event", whisper);
    
    // Note: get_embedding function needs to be imported/implemented
    // const thought_embedding_pair: [string, number[]] = [thought, await get_embedding(thought)];
    
    // For now, using placeholder for embedding
    const thought_embedding_pair: [string, number[]] = [thought, []];
    
    persona.a_mem.add_thought(
      created,
      expiration,
      s,
      p,
      o,
      thought,
      keywords,
      thought_poignancy,
      thought_embedding_pair,
      null
    );
  }
};

export const open_convo_session = async (
  persona: Persona,
  convo_mode: string
): Promise<void> => {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const question = (query: string): Promise<string> => {
    return new Promise(resolve => {
      rl.question(query, resolve);
    });
  };

  if (convo_mode === "analysis") {
    const curr_convo: [string, string][] = [];
    const interlocutor_desc = "Interviewer";

    while (true) {
      const line = await question("Enter Input: ");
      if (line === "end_convo") {
        break;
      }

      const safety_score = await run_gpt_generate_safety_score(persona, line);
      if (parseInt(safety_score[0]) >= 8) {
        console.log(`${persona.scratch.name} is a computational agent, and as such, it may be inappropriate to attribute human agency to the agent in your communication.`);
      } else {
        const retrieved = (await new_retrieve(persona, [line], 50))[line];
        const summarized_idea = await generate_summarize_ideas(persona, retrieved, line);
        curr_convo.push([interlocutor_desc, line]);

        const next_line = await generate_next_line(persona, interlocutor_desc, curr_convo, summarized_idea);
        curr_convo.push([persona.scratch.name, next_line]);
      }
    }
  } else if (convo_mode === "whisper") {
    const whisper = await question("Enter Input: ");
    const thought = await generate_inner_thought(persona, whisper);

    const created = persona.scratch.curr_time;
    const expiration = new Date(created.getTime() + 30 * 24 * 60 * 60 * 1000); // +30 days
    const [s, p, o] = await generate_action_event_triple(thought, persona);
    const keywords = new Set([s, p, o]);
    const thought_poignancy = await generate_poig_score(persona, "event", whisper);
    
    // Note: get_embedding function needs to be imported/implemented
    // const thought_embedding_pair: [string, number[]] = [thought, await get_embedding(thought)];
    
    // For now, using placeholder for embedding
    const thought_embedding_pair: [string, number[]] = [thought, []];
    
    persona.a_mem.add_thought(
      created,
      expiration,
      s,
      p,
      o,
      thought,
      keywords,
      thought_poignancy,
      thought_embedding_pair,
      null
    );
  }

  rl.close();
};

// Helper functions for missing LLM prompts (these should be moved to run_gpt_prompt.ts eventually)
export const run_gpt_prompt_agent_chat_summarize_ideas = async (
  init_persona: Persona,
  target_persona: Persona,
  statements: string,
  curr_context: string
): Promise<[string, string, any, any, any, any]> => {
  // Placeholder implementation
  const prompt = `Summarize ideas for ${init_persona.name} talking to ${target_persona.name}.\nContext: ${curr_context}\nStatements: ${statements}`;
  
  const result = await ChatGPT_safe_generate_response(
    prompt,
    "The conversation will be about shared interests and recent events.",
    "Provide a brief summary of conversation ideas.",
    3,
    "They will discuss daily activities and common interests."
  );

  const summary = typeof result === 'string' ? result : "They will discuss daily activities and common interests.";
  return [summary, "", {}, {}, {}, {}];
};

export const run_gpt_prompt_agent_chat_summarize_relationship = async (
  init_persona: Persona,
  target_persona: Persona,
  statements: string
): Promise<[string, string, any, any, any, any]> => {
  // Placeholder implementation
  const prompt = `Summarize relationship between ${init_persona.name} and ${target_persona.name}.\nStatements: ${statements}`;
  
  const result = await ChatGPT_safe_generate_response(
    prompt,
    "They are acquaintances who see each other regularly.",
    "Provide a brief summary of their relationship.",
    3,
    "They are acquaintances who see each other regularly."
  );

  const summary = typeof result === 'string' ? result : "They are acquaintances who see each other regularly.";
  return [summary, "", {}, {}, {}, {}];
};

export const run_gpt_prompt_agent_chat = async (
  maze: Maze,
  init_persona: Persona,
  target_persona: Persona,
  curr_context: string,
  init_summ_idea: string,
  target_summ_idea: string
): Promise<[string[], string, any, any, any, any]> => {
  // Placeholder implementation
  const prompt = `Generate conversation between ${init_persona.name} and ${target_persona.name}.\nContext: ${curr_context}\nInit ideas: ${init_summ_idea}\nTarget ideas: ${target_summ_idea}`;
  
  const result = await ChatGPT_safe_generate_response(
    prompt,
    "Hello! How are you doing today?",
    "Generate a conversation starter.",
    3,
    "Hello! How are you doing today?"
  );

  const conversation = typeof result === 'string' ? [result] : ["Hello! How are you doing today?"];
  return [conversation, "", {}, {}, {}, {}];
};

export const run_gpt_generate_iterative_chat_utt = async (
  maze: Maze,
  init_persona: Persona,
  target_persona: Persona,
  retrieved: Record<string, ConceptNode[]>,
  curr_context: string,
  curr_chat: [string, string][]
): Promise<[{ utterance: string; end: boolean }[], string, any, any, any, any]> => {
  // Placeholder implementation
  const prompt = `Generate next utterance in conversation between ${init_persona.name} and ${target_persona.name}.\nContext: ${curr_context}\nCurrent chat: ${JSON.stringify(curr_chat)}`;
  
  const result = await ChatGPT_safe_generate_response(
    prompt,
    "I'm doing well, thank you for asking.",
    "Generate a natural response.",
    3,
    "I'm doing well, thank you for asking."
  );

  const response = typeof result === 'string' ? result : "I'm doing well, thank you for asking.";
  const shouldEnd = Math.random() > 0.7; // Random end condition
  
  return [[{ utterance: response, end: shouldEnd }], "", {}, {}, {}, {}];
};

export const run_gpt_prompt_summarize_ideas = async (
  persona: Persona,
  statements: string,
  question: string
): Promise<[string, string, any, any, any, any]> => {
  // Placeholder implementation
  const prompt = `Summarize ideas for ${persona.name} based on: ${statements}\nQuestion: ${question}`;
  
  const result = await ChatGPT_safe_generate_response(
    prompt,
    "The key ideas are about daily routine and personal interests.",
    "Provide a brief summary.",
    3,
    "The key ideas are about daily routine and personal interests."
  );

  const summary = typeof result === 'string' ? result : "The key ideas are about daily routine and personal interests.";
  return [summary, "", {}, {}, {}, {}];
};

export const run_gpt_prompt_generate_next_convo_line = async (
  persona: Persona,
  interlocutor_desc: string,
  prev_convo: string,
  retrieved_summary: string
): Promise<[string, string, any, any, any, any]> => {
  // Placeholder implementation
  const prompt = `Generate next conversation line for ${persona.name} talking to ${interlocutor_desc}.\nPrevious: ${prev_convo}\nSummary: ${retrieved_summary}`;
  
  const result = await ChatGPT_safe_generate_response(
    prompt,
    "That's interesting. Tell me more about that.",
    "Generate a natural follow-up question or response.",
    3,
    "That's interesting. Tell me more about that."
  );

  const response = typeof result === 'string' ? result : "That's interesting. Tell me more about that.";
  return [response, "", {}, {}, {}, {}];
};

export const run_gpt_prompt_generate_whisper_inner_thought = async (
  persona: Persona,
  whisper: string
): Promise<[string, string, any, any, any, any]> => {
  // Placeholder implementation
  const prompt = `Generate inner thought for ${persona.name} about: ${whisper}`;
  
  const result = await ChatGPT_safe_generate_response(
    prompt,
    "I wonder what that means for me.",
    "Generate an internal thought.",
    3,
    "I wonder what that means for me."
  );

  const thought = typeof result === 'string' ? result : "I wonder what that means for me.";
  return [thought, "", {}, {}, {}, {}];
};

export const run_gpt_generate_safety_score = async (
  persona: Persona,
  comment: string
): Promise<[string, string, any, any, any, any]> => {
  // Placeholder implementation
  const prompt = `Rate safety of comment for ${persona.name}: ${comment}`;
  
  const result = await ChatGPT_safe_generate_response(
    prompt,
    "5",
    "Output only a number between 1 and 10",
    3,
    "5"
  );

  const score = typeof result === 'string' ? result : "5";
  return [score, "", {}, {}, {}, {}];
};