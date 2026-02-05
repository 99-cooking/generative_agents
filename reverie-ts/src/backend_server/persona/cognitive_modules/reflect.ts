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
  
  // Get nodes from both events and thoughts, excluding idle ones
  const nodes: [Date, any][] = [];
  for (const node of persona.a_mem.seq_event.concat(persona.a_mem.seq_thought)) {
    if (!node.embedding_key.includes("idle")) {
      nodes.push([node.last_accessed, node]);
    }
  }

  // Sort by last_accessed
  nodes.sort((a, b) => a[0].getTime() - b[0].getTime());
  const sortedNodes = nodes.map(([, node]) => node);
  
  let statements = ""
  for (const node of sortedNodes.slice(-1 * persona.scratch.importance_ele_n)) {
    statements += node.embedding_key + "\n";
  }
  
  const [result] = await run_gpt_prompt_focal_pt(persona, statements, n);
  return result;
}

export async function generate_insights_and_evidence(
  persona: any,
  nodes: any[],
  n: number = 5
): Promise<Record<string, string[]>> {
  if (debug) console.log("GNS FUNCTION: <generate_insights_and_evidence>");
  
  let statements = ""
  for (let count = 0; count < nodes.length; count++) {
    statements += `${count}. ${nodes[count].embedding_key}\n`;
  }
  
  const [ret] = await run_gpt_prompt_insight_and_guidance(persona, statements, n);
  
  console.log(ret);
  try {
    const result: Record<string, string[]> = {};
    for (const [thought, evi_raw] of Object.entries(ret)) {
      const evidence_node_id = ((evi_raw as unknown) as number[]).map((i: number) => nodes[i].node_id);
      result[thought] = evidence_node_id;
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
   * 
   * INPUT: 
   *   persona: Current Persona object
   * Output: 
   *   None
   */
  if (debug) console.log("GNS FUNCTION: <run_reflect>");
  
  // Reflection requires certain focal points. Generate that first. 
  const focal_points = await generate_focal_points(persona, 3);
  
  // Retrieve the relevant Nodes object for each of the focal points. 
  // <retrieved> has keys of focal points, and values of the associated Nodes. 
  const retrieved = await new_retrieve(persona, focal_points);

  // For each of the focal points, generate thoughts and save it in the 
  // agent's memory. 
  for (const [focal_pt, nodes] of Object.entries(retrieved)) {
    const xx = nodes.map((i: any) => i.embedding_key);
    for (const xxx of xx) console.log(xxx);

    const thoughts = await generate_insights_and_evidence(persona, nodes as any[], 5);
    
    for (const [thought, evidence] of Object.entries(thoughts)) {
      const created = persona.scratch.curr_time;
      const expiration = new Date(created.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days
      const [s, p, o] = await generate_action_event_triple(thought, persona);
      const keywords = new Set([s, p, o].filter(Boolean));
      const thought_poignancy = await generate_poig_score(persona, "thought", thought);
      const thought_embedding = await get_embedding(thought);
      const thought_embedding_pair: [string, number[]] = [thought, thought_embedding];

      persona.a_mem.add_thought(
        created,
        expiration,
        s, p, o,
        thought,
        keywords,
        thought_poignancy,
        thought_embedding_pair,
        evidence as string[]
      );
    }
  }
}

export function reflection_trigger(persona: any): boolean {
  /**
   * Given the current persona, determine whether the persona should run a 
   * reflection. 
   *  
   * Our current implementation checks for whether the sum of the new importance
   * measure has reached the set (hyper-parameter) threshold.
   * 
   * INPUT: 
   *   persona: Current Persona object
   * Output: 
   *   True if we are running a new reflection. 
   *   False otherwise. 
   */
  console.log(persona.scratch.name, "persona.scratch.importance_trigger_curr::", persona.scratch.importance_trigger_curr);
  console.log(persona.scratch.importance_trigger_max);

  if (
    persona.scratch.importance_trigger_curr <= 0 && 
    (persona.a_mem.seq_event.length + persona.a_mem.seq_thought.length) > 0
  ) {
    return true;
  }
  return false;
}

export function reset_reflection_counter(persona: any): void {
  /**
   * We reset the counters used for the reflection trigger. 
   * 
   * INPUT: 
   *   persona: Current Persona object
   * Output: 
   *   None
   */
  const persona_imt_max = persona.scratch.importance_trigger_max;
  persona.scratch.importance_trigger_curr = persona_imt_max;
  persona.scratch.importance_ele_n = 0;
}

export async function reflect(persona: any): Promise<void> {
  /**
   * The main reflection module for the persona. We first check if the trigger 
   * conditions are met, and if so, run the reflection and reset any of the 
   * relevant counters. 
   * 
   * INPUT: 
   *   persona: Current Persona object
   * Output: 
   *   None
   */
  if (reflection_trigger(persona)) {
    await run_reflect(persona);
    reset_reflection_counter(persona);
  }

  // Post-conversation reflection
  if (persona.scratch.chatting_end_time) {
    // Check if we're at the conversation end time (within 10 seconds)
    const curr_time_plus_10s = new Date(persona.scratch.curr_time.getTime() + 10 * 1000);
    if (
      curr_time_plus_10s.getTime() === persona.scratch.chatting_end_time.getTime() ||
      (persona.scratch.curr_time <= persona.scratch.chatting_end_time && 
       curr_time_plus_10s >= persona.scratch.chatting_end_time)
    ) {
      let all_utt = "";
      if (persona.scratch.chat) {
        for (const row of persona.scratch.chat) {
          all_utt += `${row[0]}: ${row[1]}\n`;
        }
      }

      // Get evidence from last chat
      const last_chat = persona.a_mem.get_last_chat(persona.scratch.chatting_with);
      const evidence = last_chat ? [last_chat.node_id] : [];

      // Generate and add planning thought
      let planning_thought = await generate_planning_thought_on_convo(persona, all_utt);
      planning_thought = `For ${persona.scratch.name}'s planning: ${planning_thought}`;

      const created = persona.scratch.curr_time;
      const expiration = new Date(created.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days
      const [s, p, o] = await generate_action_event_triple(planning_thought, persona);
      const keywords = new Set([s, p, o].filter(Boolean));
      const thought_poignancy = await generate_poig_score(persona, "thought", planning_thought);
      const thought_embedding = await get_embedding(planning_thought);
      const thought_embedding_pair: [string, number[]] = [planning_thought, thought_embedding];

      persona.a_mem.add_thought(
        created,
        expiration,
        s, p, o,
        planning_thought,
        keywords,
        thought_poignancy,
        thought_embedding_pair,
        evidence
      );

      // Generate and add memo thought
      let memo_thought = await generate_memo_on_convo(persona, all_utt);
      memo_thought = `${persona.scratch.name} ${memo_thought}`;

      const memo_created = persona.scratch.curr_time;
      const memo_expiration = new Date(memo_created.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days
      const [ms, mp, mo] = await generate_action_event_triple(memo_thought, persona);
      const memo_keywords = new Set([ms, mp, mo].filter(Boolean));
      const memo_poignancy = await generate_poig_score(persona, "thought", memo_thought);
      const memo_embedding = await get_embedding(memo_thought);
      const memo_embedding_pair: [string, number[]] = [memo_thought, memo_embedding];

      persona.a_mem.add_thought(
        memo_created,
        memo_expiration,
        ms, mp, mo,
        memo_thought,
        memo_keywords,
        memo_poignancy,
        memo_embedding_pair,
        evidence
      );
    }
  }
}
