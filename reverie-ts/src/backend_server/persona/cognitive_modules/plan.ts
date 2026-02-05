/**
 * Plan module for generative agents.
 */

// Type imports
import type { ConceptNode, Persona, Maze, RetrievedMemory } from '../../../types.js';

import {
  ChatGPT_safe_generate_response, ChatGPT_single_request,
  get_embedding
} from '../prompt_template/gpt_structure.js';

import {
  run_gpt_prompt_wake_up_hour,
  run_gpt_prompt_daily_plan,
  run_gpt_prompt_generate_hourly_schedule,
  run_gpt_prompt_task_decomp,
  run_gpt_prompt_action_sector,
  run_gpt_prompt_action_arena,
  run_gpt_prompt_action_game_object,
  run_gpt_prompt_pronunciatio,
  run_gpt_prompt_event_triple,
  run_gpt_prompt_act_obj_desc,
  run_gpt_prompt_act_obj_event_triple,
  run_gpt_prompt_new_decomp_schedule,
  run_gpt_prompt_decide_to_talk,
  run_gpt_prompt_decide_to_react,
  run_gpt_prompt_create_conversation,
  run_gpt_prompt_summarize_conversation
} from '../prompt_template/run_gpt_prompt.js';

import { new_retrieve } from './retrieve.js';
import { agent_chat_v2 } from './converse.js';

const debug = false;



/**
 * CHAPTER 2: Generate
 */

/**
 * Generates the time when the persona wakes up. This becomes an integral part
 * of our process for generating the persona's daily plan.
 * 
 * Persona state: identity stable set, lifestyle, first_name
 * 
 * INPUT: 
 *   persona: The Persona class instance 
 * OUTPUT: 
 *   an integer signifying the persona's wake up hour
 * EXAMPLE OUTPUT: 
 *   8
 */
export async function generate_wake_up_hour(persona: Persona): Promise<number> {
  if (debug) console.log("GNS FUNCTION: <generate_wake_up_hour>");
  const result = await run_gpt_prompt_wake_up_hour(persona);
  return Number(result[0]);
}

/**
 * Generates the daily plan for the persona. 
 * Basically the long term planning that spans a day. Returns a list of actions
 * that the persona will take today. Usually comes in the following form: 
 * 'wake up and complete the morning routine at 6:00 am', 
 * 'eat breakfast at 7:00 am',.. 
 * Note that the actions come without a period. 
 * 
 * Persona state: identity stable set, lifestyle, cur_data_str, first_name
 * 
 * INPUT: 
 *   persona: The Persona class instance 
 *   wake_up_hour: an integer that indicates when the hour the persona wakes up 
 *                 (e.g., 8)
 * OUTPUT: 
 *   a list of daily actions in broad strokes.
 * EXAMPLE OUTPUT: 
 *   ['wake up and complete the morning routine at 6:00 am', 
 *    'have breakfast and brush teeth at 6:30 am',
 *    'work on painting project from 8:00 am to 12:00 pm', 
 *    'have lunch at 12:00 pm', 
 *    'take a break and watch TV from 2:00 pm to 4:00 pm', 
 *    'work on painting project from 4:00 pm to 6:00 pm', 
 *    'have dinner at 6:00 pm', 'watch TV from 7:00 pm to 8:00 pm']
 */
export async function generate_first_daily_plan(persona: Persona, wake_up_hour: number): Promise<string[]> {
  if (debug) console.log("GNS FUNCTION: <generate_first_daily_plan>");
  const result = await run_gpt_prompt_daily_plan(persona, wake_up_hour);
  return result[0];
}

/**
 * Based on the daily req, creates an hourly schedule -- one hour at a time. 
 * The form of the action for each of the hour is something like below: 
 * "sleeping in her bed"
 * 
 * The output is basically meant to finish the phrase, "x is..."
 * 
 * Persona state: identity stable set, daily_plan
 * 
 * INPUT: 
 *   persona: The Persona class instance 
 *   persona: Integer form of the wake up hour for the persona.  
 * OUTPUT: 
 *   a list of activities and their duration in minutes: 
 * EXAMPLE OUTPUT: 
 *   [['sleeping', 360], ['waking up and starting her morning routine', 60], 
 *    ['eating breakfast', 60],..
 */
export async function generate_hourly_schedule(persona: Persona, wake_up_hour: number): Promise<[string, number][]> {
  if (debug) console.log("GNS FUNCTION: <generate_hourly_schedule>");

  const hour_str = ["00:00 AM", "01:00 AM", "02:00 AM", "03:00 AM", "04:00 AM", 
                    "05:00 AM", "06:00 AM", "07:00 AM", "08:00 AM", "09:00 AM", 
                    "10:00 AM", "11:00 AM", "12:00 PM", "01:00 PM", "02:00 PM", 
                    "03:00 PM", "04:00 PM", "05:00 PM", "06:00 PM", "07:00 PM",
                    "08:00 PM", "09:00 PM", "10:00 PM", "11:00 PM"];
  
  let n_m1_activity: string[] = [];
  const diversity_repeat_count = 3;
  
  for (let i = 0; i < diversity_repeat_count; i++) {
    const n_m1_activity_set = new Set(n_m1_activity);
    if (n_m1_activity_set.size < 5) {
      n_m1_activity = [];
      let temp_wake_up_hour = wake_up_hour;
      
      for (let count = 0; count < hour_str.length; count++) {
        const curr_hour_str = hour_str[count];
        if (temp_wake_up_hour > 0) {
          n_m1_activity.push("sleeping");
          temp_wake_up_hour -= 1;
        } else {
          const result = await run_gpt_prompt_generate_hourly_schedule(
            persona, curr_hour_str, n_m1_activity, hour_str);
          n_m1_activity.push(result[0]);
        }
      }
    }
  }

  // Step 1. Compressing the hourly schedule to the following format: 
  // The integer indicates the number of hours. They should add up to 24. 
  // [['sleeping', 6], ['waking up and starting her morning routine', 1], 
  // ['eating breakfast', 1], ['getting ready for the day', 1], 
  // ['working on her painting', 2], ['taking a break', 1], 
  // ['having lunch', 1], ['working on her painting', 3], 
  // ['taking a break', 2], ['working on her painting', 2], 
  // ['relaxing and watching TV', 1], ['going to bed', 1], ['sleeping', 2]]
  const _n_m1_hourly_compressed: [string, number][] = [];
  let prev: string | null = null;
  let prev_count = 0;
  
  for (const activity of n_m1_activity) {
    if (activity !== prev) {
      prev_count = 1;
      _n_m1_hourly_compressed.push([activity, prev_count]);
      prev = activity;
    } else {
      if (_n_m1_hourly_compressed.length > 0) {
        _n_m1_hourly_compressed[_n_m1_hourly_compressed.length - 1][1] += 1;
      }
    }
  }

  // Step 2. Expand to min scale (from hour scale)
  // [['sleeping', 360], ['waking up and starting her morning routine', 60], 
  // ['eating breakfast', 60],..
  const n_m1_hourly_compressed: [string, number][] = [];
  for (const [task, duration] of _n_m1_hourly_compressed) {
    n_m1_hourly_compressed.push([task, duration * 60]);
  }

  return n_m1_hourly_compressed;
}

/**
 * A few shot decomposition of a task given the task description 
 * 
 * Persona state: identity stable set, curr_date_str, first_name
 * 
 * INPUT: 
 *   persona: The Persona class instance 
 *   task: the description of the task at hand in str form
 *         (e.g., "waking up and starting her morning routine")
 *   duration: an integer that indicates the number of minutes this task is 
 *             meant to last (e.g., 60)
 * OUTPUT: 
 *   a list of list where the inner list contains the decomposed task 
 *   description and the number of minutes the task is supposed to last. 
 * EXAMPLE OUTPUT: 
 *   [['going to the bathroom', 5], ['getting dressed', 5], 
 *    ['eating breakfast', 15], ['checking her email', 5], 
 *    ['getting her supplies ready for the day', 15], 
 *    ['starting to work on her painting', 15]] 
 */
export async function generate_task_decomp(persona: Persona, task: string, duration: number): Promise<[string, number][]> {
  if (debug) console.log("GNS FUNCTION: <generate_task_decomp>");
  const result = await run_gpt_prompt_task_decomp(persona, task, duration);
  return result[0];
}

/**
 * TODO 
 * Given the persona and the task description, choose the action_sector. 
 * 
 * Persona state: identity stable set, n-1 day schedule, daily plan
 * 
 * INPUT: 
 *   act_desp: description of the new action (e.g., "sleeping")
 *   persona: The Persona class instance 
 * OUTPUT: 
 *   action_arena (e.g., "bedroom 2")
 * EXAMPLE OUTPUT: 
 *   "bedroom 2"
 */
export async function generate_action_sector(act_desp: string, persona: Persona, maze: Maze): Promise<string> {
  if (debug) console.log("GNS FUNCTION: <generate_action_sector>");
  const result = await run_gpt_prompt_action_sector(act_desp, persona, maze);
  return result[0];
}

/**
 * TODO 
 * Given the persona and the task description, choose the action_arena. 
 * 
 * Persona state: identity stable set, n-1 day schedule, daily plan
 * 
 * INPUT: 
 *   act_desp: description of the new action (e.g., "sleeping")
 *   persona: The Persona class instance 
 * OUTPUT: 
 *   action_arena (e.g., "bedroom 2")
 * EXAMPLE OUTPUT: 
 *   "bedroom 2"
 */
export async function generate_action_arena(act_desp: string, persona: Persona, maze: Maze, act_world: string, act_sector: string): Promise<string> {
  if (debug) console.log("GNS FUNCTION: <generate_action_arena>");
  const result = await run_gpt_prompt_action_arena(act_desp, persona, maze, act_world, act_sector);
  return result[0];
}

/**
 * TODO
 * Given the action description and the act address (the address where
 * we expect the action to task place), choose one of the game objects. 
 * 
 * Persona state: identity stable set, n-1 day schedule, daily plan
 * 
 * INPUT: 
 *   act_desp: the description of the action (e.g., "sleeping")
 *   act_address: the arena where the action will take place: 
 *              (e.g., "dolores double studio:double studio:bedroom 2")
 *   persona: The Persona class instance 
 * OUTPUT: 
 *   act_game_object: 
 * EXAMPLE OUTPUT: 
 *   "bed"
 */
export async function generate_action_game_object(act_desp: string, act_address: string, persona: Persona, maze: Maze): Promise<string> {
  if (debug) console.log("GNS FUNCTION: <generate_action_game_object>");
  if (!persona.s_mem.get_str_accessible_arena_game_objects(act_address)) {
    return "<random>";
  }
  const result = await run_gpt_prompt_action_game_object(act_desp, persona, maze, act_address);
  return result[0];
}

/**
 * TODO 
 * Given an action description, creates an emoji string description via a few
 * shot prompt. 
 * 
 * Does not really need any information from persona. 
 * 
 * INPUT: 
 *   act_desp: the description of the action (e.g., "sleeping")
 *   persona: The Persona class instance
 * OUTPUT: 
 *   a string of emoji that translates action description.
 * EXAMPLE OUTPUT: 
 *   "🧈🍞"
 */
export async function generate_action_pronunciatio(act_desp: string, persona: Persona): Promise<string> {
  if (debug) console.log("GNS FUNCTION: <generate_action_pronunciatio>");
  try {
    const x = (await run_gpt_prompt_pronunciatio(act_desp, persona))[0];
    return x || "🙂";
  } catch {
    return "🙂";
  }
}

/**
 * TODO 
 * 
 * INPUT: 
 *   act_desp: the description of the action (e.g., "sleeping")
 *   persona: The Persona class instance
 * OUTPUT: 
 *   a string of emoji that translates action description.
 * EXAMPLE OUTPUT: 
 *   "🧈🍞"
 */
export async function generate_action_event_triple(act_desp: string, persona: Persona): Promise<[string, string, string]> {
  if (debug) console.log("GNS FUNCTION: <generate_action_event_triple>");
  const result = await run_gpt_prompt_event_triple(act_desp, persona);
  return result[0];
}

export async function generate_act_obj_desc(act_game_object: string, act_desp: string, persona: Persona): Promise<string> {
  if (debug) console.log("GNS FUNCTION: <generate_act_obj_desc>");
  const result = await run_gpt_prompt_act_obj_desc(act_game_object, act_desp, persona);
  return result[0];
}

export async function generate_act_obj_event_triple(act_game_object: string, act_obj_desc: string, persona: Persona): Promise<[string | null, string | null, string | null]> {
  if (debug) console.log("GNS FUNCTION: <generate_act_obj_event_triple>");
  const result = await run_gpt_prompt_act_obj_event_triple(act_game_object, act_obj_desc, persona);
  return result[0];
}

export async function generate_convo(maze: Maze, init_persona: Persona, target_persona: Persona): Promise<[[string, string][], number]> {
  const curr_loc = maze.access_tile(init_persona.scratch.curr_tile);
  
  // convo = run_gpt_prompt_create_conversation(init_persona, target_persona, curr_loc)[0];
  // convo = agent_chat_v1(maze, init_persona, target_persona);
  const convo = await agent_chat_v2(maze, init_persona, target_persona);
  let all_utt = "";

  for (const row of convo) {
    const [speaker, utt] = row;
    all_utt += `${speaker}: ${utt}\n`;
  }

  const convo_length = Math.ceil(Math.ceil(all_utt.length / 8) / 30);

  if (debug) console.log("GNS FUNCTION: <generate_convo>");
  return [convo, convo_length];
}

export async function generate_convo_summary(persona: Persona, convo: [string, string][]): Promise<string> {
  const convo_summary = (await run_gpt_prompt_summarize_conversation(persona, convo))[0];
  return convo_summary;
}

export async function generate_decide_to_talk(init_persona: Persona, target_persona: Persona, retrieved: RetrievedMemory): Promise<boolean> {
  const x = (await run_gpt_prompt_decide_to_talk(init_persona, target_persona, retrieved))[0];
  if (debug) console.log("GNS FUNCTION: <generate_decide_to_talk>");

  if (x === true || String(x) === "yes") {
    return true;
  } else {
    return false;
  }
}

export async function generate_decide_to_react(init_persona: Persona, target_persona: Persona, retrieved: RetrievedMemory): Promise<any> {
  if (debug) console.log("GNS FUNCTION: <generate_decide_to_react>");
  const result = await run_gpt_prompt_decide_to_react(init_persona, target_persona, retrieved);
  return result[0];
}

export async function generate_new_decomp_schedule(
  persona: Persona,
  inserted_act: string,
  inserted_act_dur: number,
  start_hour: number,
  end_hour: number
): Promise<[string, number][]> {
  // Step 1: Setting up the core variables for the function. 
  // <p> is the persona whose schedule we are editing right now. 
  const p = persona;
  // <today_min_pass> indicates the number of minutes that have passed today. 
  const today_min_pass = (p.scratch.curr_time.getHours() * 60 + p.scratch.curr_time.getMinutes() + 1);
  
  // Step 2: We need to create <main_act_dur> and <truncated_act_dur>. 
  // These are basically a sub-component of <f_daily_schedule> of the persona,
  // but focusing on the current decomposition. 
  const main_act_dur: [string, number][] = [];
  const truncated_act_dur: [string, number][] = [];
  let dur_sum = 0; // duration sum
  let count = 0; // enumerate count
  let truncated_fin = false;

  console.log("DEBUG::: ", persona.scratch.name);
  for (const [act, dur] of p.scratch.f_daily_schedule) {
    if (dur_sum >= start_hour * 60 && dur_sum < end_hour * 60) {
      main_act_dur.push([act, dur]);
      if (dur_sum <= today_min_pass) {
        truncated_act_dur.push([act, dur]);
      } else if (dur_sum > today_min_pass && !truncated_fin) {
        // We need to insert that last act, duration list like this one: 
        // e.g., ['wakes up and completes her morning routine (wakes up...)', 2]
        truncated_act_dur.push([
          p.scratch.f_daily_schedule[count][0],
          dur_sum - today_min_pass
        ]);
        truncated_act_dur[truncated_act_dur.length - 1][1] -= (dur_sum - today_min_pass); // DEC 7 DEBUG;.. is the +1 the right thing to do??? 
        // truncated_act_dur[truncated_act_dur.length - 1][1] -= (dur_sum - today_min_pass + 1) // DEC 7 DEBUG;.. is the +1 the right thing to do??? 
        console.log("DEBUG::: ", truncated_act_dur);
        truncated_fin = true;
      }
    }
    dur_sum += dur;
    count += 1;
  }

  const persona_name = persona.name;
  // main_act_dur = main_act_dur; // This line doesn't do anything in Python either

  const x = truncated_act_dur[truncated_act_dur.length - 1][0].split("(")[0].trim() + " (on the way to " + truncated_act_dur[truncated_act_dur.length - 1][0].split("(")[-1].slice(0, -1) + ")";
  truncated_act_dur[truncated_act_dur.length - 1][0] = x;

  if (truncated_act_dur[truncated_act_dur.length - 1][0].includes("(")) {
    inserted_act = truncated_act_dur[truncated_act_dur.length - 1][0].split("(")[0].trim() + " (" + inserted_act + ")";
  }

  // To do inserted_act_dur+1 below is an important decision but I'm not sure
  // if I understand the full extent of its implications. Might want to 
  // revisit. 
  truncated_act_dur.push([inserted_act, inserted_act_dur]);
  const start_time_hour = new Date(2022, 9, 31, 0, 0, 0, 0); // October 31, 2022 (0-indexed month)
  start_time_hour.setHours(start_time_hour.getHours() + start_hour);
  
  const end_time_hour = new Date(2022, 9, 31, 0, 0, 0, 0);
  end_time_hour.setHours(end_time_hour.getHours() + end_hour);

  if (debug) console.log("GNS FUNCTION: <generate_new_decomp_schedule>");
  const result = await run_gpt_prompt_new_decomp_schedule(
    persona,
    main_act_dur,
    truncated_act_dur,
    start_time_hour.getHours(),
    end_time_hour.getHours(),
    inserted_act,
    inserted_act_dur
  );
  return result[0];
}

/**
 * CHAPTER 3: Plan
 */

async function revise_identity(persona: Persona): Promise<void> {
  const p_name = persona.scratch.name;

  const focal_points = [
    `${p_name}'s plan for ${persona.scratch.get_str_curr_date_str()}.`,
    `Important recent events for ${p_name}'s life.`
  ];
  const retrieved = await new_retrieve(persona, focal_points);

  let statements = "[Statements]\n";
  for (const [key, val] of Object.entries(retrieved)) {
    for (const i of val) {
      statements += `${i.created.toLocaleString('en-US', { weekday: 'long', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}: ${i.embedding_key}\n`;
    }
  }

  // print (";adjhfno;asdjao;idfjo;af", p_name)
  let plan_prompt = statements + "\n";
  plan_prompt += `Given the statements above, is there anything that ${p_name} should remember as they plan for`;
  plan_prompt += ` *${persona.scratch.curr_time.toLocaleString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}*? `;
  plan_prompt += `If there is any scheduling information, be as specific as possible (include date, time, and location if stated in the statement)\n\n`;
  plan_prompt += `Write the response from ${p_name}'s perspective.`;
  const plan_note = await ChatGPT_single_request(plan_prompt);
  // print (plan_note)

  let thought_prompt = statements + "\n";
  thought_prompt += `Given the statements above, how might we summarize ${p_name}'s feelings about their days up to now?\n\n`;
  thought_prompt += `Write the response from ${p_name}'s perspective.`;
  const thought_note = await ChatGPT_single_request(thought_prompt);
  // print (thought_note)

  const prev_date = new Date(persona.scratch.curr_time);
  prev_date.setDate(prev_date.getDate() - 1);
  
  let currently_prompt = `${p_name}'s status from ${prev_date.toLocaleString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}:\n`;
  currently_prompt += `${persona.scratch.currently}\n\n`;
  currently_prompt += `${p_name}'s thoughts at the end of ${prev_date.toLocaleString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}:\n`;
  currently_prompt += (plan_note + thought_note).replace('\n', '') + "\n\n";
  currently_prompt += `It is now ${persona.scratch.curr_time.toLocaleString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}. Given the above, write ${p_name}'s status for ${persona.scratch.curr_time.toLocaleString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} that reflects ${p_name}'s thoughts at the end of ${prev_date.toLocaleString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}. Write this in third-person talking about ${p_name}.`;
  currently_prompt += `If there is any scheduling information, be as specific as possible (include date, time, and location if stated in the statement).\n\n`;
  currently_prompt += "Follow this format below:\nStatus: <new status>";
  // print ("DEBUG ;adjhfno;asdjao;asdfsidfjo;af", p_name)
  // print (currently_prompt)
  const new_currently = await ChatGPT_single_request(currently_prompt);
  // print (new_currently)
  // print (new_currently[10:])

  persona.scratch.currently = new_currently;

  let daily_req_prompt = persona.scratch.get_str_iss() + "\n";
  daily_req_prompt += `Today is ${persona.scratch.curr_time.toLocaleString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}. Here is ${persona.scratch.name}'s plan today in broad-strokes (with the time of the day. e.g., have a lunch at 12:00 pm, watch TV from 7 to 8 pm).\n\n`;
  daily_req_prompt += `Follow this format (the list should have 4~6 items but no more):\n`;
  daily_req_prompt += `1. wake up and complete the morning routine at <time>, 2. ...`;

  const new_daily_req = await ChatGPT_single_request(daily_req_prompt);
  const cleaned_daily_req = new_daily_req.replace('\n', ' ');
  console.log("WE ARE HERE!!!", cleaned_daily_req);
  persona.scratch.daily_plan_req = cleaned_daily_req;
}

export async function _long_term_planning(persona: Persona, new_day: string | boolean): Promise<void> {
  /**
   * Formulates the persona's daily long-term plan if it is the start of a new 
   * day. This basically has two components: first, we create the wake-up hour, 
   * and second, we create the hourly schedule based on it. 
   * INPUT
   *   new_day: Indicates whether the current time signals a "First day",
   *            "New day", or False (for neither). This is important because we
   *            create the personas' long term planning on the new day. 
   */
  // We start by creating the wake up hour for the persona. 
  const wake_up_hour = await generate_wake_up_hour(persona);

  // When it is a new day, we start by creating the daily_req of the persona.
  // Note that the daily_req is a list of strings that describe the persona's
  // day in broad strokes.
  if (new_day === "First day") {
    // Bootstrapping the daily plan for the start of then generation:
    // if this is the start of generation (so there is no previous day's 
    // daily requirement, or if we are on a new day, we want to create a new
    // set of daily requirements.
    persona.scratch.daily_req = await generate_first_daily_plan(persona, wake_up_hour);
  } else if (new_day === "New day") {
    await revise_identity(persona);

    // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - TODO
    // We need to create a new daily_req here...
    // persona.scratch.daily_req = persona.scratch.daily_req; // This line doesn't do anything
  }

  // Based on the daily_req, we create an hourly schedule for the persona, 
  // which is a list of todo items with a time duration (in minutes) that 
  // add up to 24 hours.
  persona.scratch.f_daily_schedule = await generate_hourly_schedule(persona, wake_up_hour);
  persona.scratch.f_daily_schedule_hourly_org = [...persona.scratch.f_daily_schedule];

  // Added March 4 -- adding plan to the memory.
  let thought = `This is ${persona.scratch.name}'s plan for ${persona.scratch.curr_time.toLocaleString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}:`;
  for (const i of persona.scratch.daily_req) {
    thought += ` ${i},`;
  }
  thought = thought.slice(0, -1) + ".";
  
  const created = persona.scratch.curr_time;
  const expiration = new Date(persona.scratch.curr_time);
  expiration.setDate(expiration.getDate() + 30);
  
  const s = persona.scratch.name;
  const p = "plan";
  const o = persona.scratch.curr_time.toLocaleString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const keywords = new Set(["plan"]);
  const thought_poignancy = 5;
  const thought_embedding_pair: [string, number[]] = [thought, await get_embedding(thought)];
  
  persona.a_mem.add_thought(created, expiration, s, p, o,
                            thought, keywords, thought_poignancy,
                            thought_embedding_pair, null);

  // console.log("Sleeping for 20 seconds...");
  // await new Promise(resolve => setTimeout(resolve, 10000));
  // console.log("Done sleeping!");
}