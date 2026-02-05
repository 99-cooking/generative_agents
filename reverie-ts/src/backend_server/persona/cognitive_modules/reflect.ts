/**
 * Reflect module for generative agents.
 * 
 * Simplified version with any types to bypass type system issues.
 * TODO: Add proper types later.
 */

import { get_embedding } from '../prompt_template/gpt_structure.js';
import {
  run_gpt_prompt_focal_pt,
  run_gpt_prompt_insight_and_guidance,
  run_gpt_prompt_event_poignancy,
  run_gpt_prompt_thought_poignancy,
  run_gpt_prompt_event_triple,
  run_gpt_prompt_chat_poignancy,
  run_gpt_prompt_convo_to_thoughts,
  run_gpt_prompt_planning_thought_on_convo,
  run_gpt_prompt_memo_on_convo
} from '../prompt_template/run_gpt_prompt.js';
import { new_retrieve } from './retrieve.js';

const debug = false;

export async function generate_focal_points(persona: any, n: number = 3): Promise<string[]> {
  if (debug) console.log("GNS FUNCTION: <generate_focal_points>");
  
  const nodes = persona.a_mem.seq_event.slice(-100);
  if (nodes.length === 0) {
    return ['daily routine'];
  }
  
  const statements = nodes
    .map((node: any, count: number) => `${count + 1}. ${node.embedding_key}`)
    .join("\n");
  
  const [result] = await run_gpt_prompt_focal_pt(persona, statements, n);
  return result;
}

export async function generate_insights_and_evidence(
  persona: any,
  nodes: any[],
  n: number = 5
): Promise<Record<string, string[]>> {
  if (debug) console.log("GNS FUNCTION: <generate_insights_and_evidence>");
  
  const statements = nodes
    .map((node: any, count: number) => `${count + 1}. ${node.embedding_key}`)
    .join("\n");
  
  const [ret] = await run_gpt_prompt_insight_and_guidance(persona, statements, n);
  
  try {
    const result: Record<string, string[]> = {};
    if (Array.isArray(ret)) {
      for (let i = 0; i < ret.length; i++) {
        result[ret[i]] = nodes.slice(0, Math.min(3, nodes.length)).map((n: any) => n.node_id);
      }
    }
    return result;
  } catch (error) {
    return { "this is blank": ["node_1"] };
  }
}

export async function generate_action_event_triple(
  act_desp: string,
  persona: any
): Promise<[string, string, string]> {
  if (debug) console.log("GNS FUNCTION: <generate_action_event_triple>");
  const [triple] = await run_gpt_prompt_event_triple(act_desp, persona);
  return triple;
}

export async function generate_poig_score(
  persona: any,
  event_type: string,
  description: string
): Promise<number> {
  if (debug) console.log("GNS FUNCTION: <generate_poig_score>");
  
  if (description.includes("is idle")) {
    return 1;
  }
  
  if (event_type === "event" || event_type === "thought") {
    const [score] = await run_gpt_prompt_event_poignancy(persona, description);
    return score;
  } else if (event_type === "chat") {
    const [score] = await run_gpt_prompt_chat_poignancy(persona, persona.scratch.act_description || "");
    return score;
  }
  
  return 1;
}

export async function generate_planning_thought_on_convo(
  persona: any,
  all_utt: string
): Promise<string> {
  if (debug) console.log("GNS FUNCTION: <generate_planning_thought_on_convo>");
  const [thought] = await run_gpt_prompt_planning_thought_on_convo(persona, all_utt);
  return thought;
}

export async function generate_memo_on_convo(
  persona: any,
  all_utt: string
): Promise<string> {
  if (debug) console.log("GNS FUNCTION: <generate_memo_on_convo>");
  const [memo] = await run_gpt_prompt_memo_on_convo(persona, all_utt);
  return memo;
}

export async function run_reflect(persona: any): Promise<void> {
  /**
   * Run the actual reflection. We generate the focal points, retrieve any 
   * relevant nodes, and generate thoughts and insights.
   */
  if (debug) console.log("GNS FUNCTION: <run_reflect>");
  
  // Check importance trigger
  if (persona.scratch.importance_trigger_curr <= persona.scratch.importance_trigger_max) {
    return;
  }
  persona.scratch.importance_trigger_curr = 0;
  
  // Generate focal points
  const focal_points = await generate_focal_points(persona, 3);
  
  for (const focal_pt of focal_points) {
    // Retrieve related nodes
    const retrieved = await new_retrieve(persona, [focal_pt], 50);
    
    // Get relevant nodes
    let nodes: any[] = [];
    if (retrieved && typeof retrieved === 'object') {
      for (const key of Object.keys(retrieved)) {
        const item = (retrieved as any)[key];
        if (item && item.events) nodes = nodes.concat(item.events);
        if (item && item.thoughts) nodes = nodes.concat(item.thoughts);
      }
    }
    
    if (nodes.length === 0) continue;
    
    // Generate insights
    const insights = await generate_insights_and_evidence(persona, nodes, 2);
    
    // Add thoughts to memory
    for (const [thought, evidence] of Object.entries(insights)) {
      const created = new Date();
      const expiration = null;
      
      const [s, p, o] = await generate_action_event_triple(thought, persona);
      const description = thought;
      const keywords = new Set([s, p, o].filter(Boolean));
      const poignancy = await generate_poig_score(persona, "thought", thought);
      const embedding = await get_embedding(thought);
      
      persona.a_mem.add_thought(
        created,
        expiration,
        s, p, o,
        description,
        keywords,
        poignancy,
        [thought, embedding],
        evidence
      );
    }
  }
}

export async function reflection_trigger(persona: any): Promise<void> {
  /**
   * Check if we should trigger reflection based on accumulated importance.
   */
  await run_reflect(persona);
}
