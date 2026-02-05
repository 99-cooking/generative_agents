/**
 * Plan module for generative agents.
 */

// Type imports
import type { ConceptNode, Persona, Maze, RetrievedMemory, RetrievedContext } from '../../../types.js';

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

export async function _determine_action(persona: Persona, maze: Maze): Promise<void> {
  /**
   * Creates the next action sequence for the persona. 
   * The main goal of this function is to run "add_new_action" on the persona's 
   * scratch space, which sets up all the action related variables for the next 
   * action. 
   * As a part of this, the persona may need to decompose its hourly schedule as 
   * needed.   
   * INPUT
   *   persona: Current <Persona> instance whose action we are determining. 
   *   maze: Current <Maze> instance. 
   */
  function determine_decomp(act_desp: string, act_dura: number): boolean {
    /**
     * Given an action description and its duration, we determine whether we need
     * to decompose it. If the action is about the agent sleeping, we generally
     * do not want to decompose it, so that's what we catch here. 
     * INPUT: 
     *   act_desp: the description of the action (e.g., "sleeping")
     *   act_dura: the duration of the action in minutes. 
     * OUTPUT: 
     *   a boolean. True if we need to decompose, False otherwise. 
     */
    if (!act_desp.includes("sleep") && !act_desp.includes("bed")) {
      return true;
    } else if (act_desp.includes("sleeping") || act_desp.includes("asleep") || act_desp.includes("in bed")) {
      return false;
    } else if (act_desp.includes("sleep") || act_desp.includes("bed")) {
      if (act_dura > 60) {
        return false;
      }
    }
    return true;
  }

  // The goal of this function is to get us the action associated with 
  // <curr_index>. As a part of this, we may need to decompose some large 
  // chunk actions. 
  // Importantly, we try to decompose at least two hours worth of schedule at
  // any given point. 
  const curr_index = persona.scratch.get_f_daily_schedule_index();
  const curr_index_60 = persona.scratch.get_f_daily_schedule_index(60);

  // * Decompose * 
  // During the first hour of the day, we need to decompose two hours 
  // sequence. We do that here. 
  if (curr_index === 0) {
    // This portion is invoked if it is the first hour of the day. 
    let [act_desp, act_dura] = persona.scratch.f_daily_schedule[curr_index];
    if (act_dura >= 60) {
      // We decompose if the next action is longer than an hour, and fits the
      // criteria described in determine_decomp.
      if (determine_decomp(act_desp, act_dura)) {
        const decomp = await generate_task_decomp(persona, act_desp, act_dura);
        persona.scratch.f_daily_schedule.splice(curr_index, 1, ...decomp);
      }
    }
    if (curr_index_60 + 1 < persona.scratch.f_daily_schedule.length) {
      [act_desp, act_dura] = persona.scratch.f_daily_schedule[curr_index_60 + 1];
      if (act_dura >= 60) {
        if (determine_decomp(act_desp, act_dura)) {
          const decomp = await generate_task_decomp(persona, act_desp, act_dura);
          persona.scratch.f_daily_schedule.splice(curr_index_60 + 1, 1, ...decomp);
        }
      }
    }
  }

  if (curr_index_60 < persona.scratch.f_daily_schedule.length) {
    // If it is not the first hour of the day, this is always invoked (it is
    // also invoked during the first hour of the day -- to double up so we can
    // decompose two hours in one go). Of course, we need to have something to
    // decompose as well, so we check for that too. 
    if (persona.scratch.curr_time.getHours() < 23) {
      // And we don't want to decompose after 11 pm. 
      const [act_desp, act_dura] = persona.scratch.f_daily_schedule[curr_index_60];
      if (act_dura >= 60) {
        if (determine_decomp(act_desp, act_dura)) {
          const decomp = await generate_task_decomp(persona, act_desp, act_dura);
          persona.scratch.f_daily_schedule.splice(curr_index_60, 1, ...decomp);
        }
      }
    }
  }
  // * End of Decompose * 

  // Generate an <Action> instance from the action description and duration. By
  // this point, we assume that all the relevant actions are decomposed and 
  // ready in f_daily_schedule. 
  console.log("DEBUG LJSDLFSKJF");
  for (const i of persona.scratch.f_daily_schedule) console.log(i);
  console.log(curr_index);
  console.log(persona.scratch.f_daily_schedule.length);
  console.log(persona.scratch.name);
  console.log("------");

  // 1440
  let x_emergency = 0;
  for (const [, dur] of persona.scratch.f_daily_schedule) {
    x_emergency += dur;
  }
  // console.log("x_emergency", x_emergency);

  if (1440 - x_emergency > 0) {
    console.log("x_emergency__AAA", x_emergency);
  }
  persona.scratch.f_daily_schedule.push(["sleeping", 1440 - x_emergency]);

  const [act_desp, act_dura] = persona.scratch.f_daily_schedule[curr_index];

  // Finding the target location of the action and creating action-related
  // variables.
  console.log(`[PLAN] ${persona.scratch.name}: Determining action for "${act_desp}" (${act_dura} min)`);
  
  const act_world = maze.access_tile(persona.scratch.curr_tile)["world"];
  console.log(`[PLAN] ${persona.scratch.name}: act_world = ${act_world}`);
  
  // act_sector = maze.access_tile(persona.scratch.curr_tile)["sector"];
  console.log(`[PLAN] ${persona.scratch.name}: Calling generate_action_sector...`);
  const act_sector = await generate_action_sector(act_desp, persona, maze);
  console.log(`[PLAN] ${persona.scratch.name}: act_sector = ${act_sector}`);
  
  console.log(`[PLAN] ${persona.scratch.name}: Calling generate_action_arena...`);
  const act_arena = await generate_action_arena(act_desp, persona, maze, act_world, act_sector);
  console.log(`[PLAN] ${persona.scratch.name}: act_arena = ${act_arena}`);
  
  const act_address = `${act_world}:${act_sector}:${act_arena}`;
  console.log(`[PLAN] ${persona.scratch.name}: Calling generate_action_game_object for ${act_address}...`);
  const act_game_object = await generate_action_game_object(act_desp, act_address, persona, maze);
  console.log(`[PLAN] ${persona.scratch.name}: act_game_object = ${act_game_object}`);
  
  const new_address = `${act_world}:${act_sector}:${act_arena}:${act_game_object}`;
  console.log(`[PLAN] ${persona.scratch.name}: new_address = ${new_address}`);
  
  console.log(`[PLAN] ${persona.scratch.name}: Calling generate_action_pronunciatio...`);
  const act_pron = await generate_action_pronunciatio(act_desp, persona);
  console.log(`[PLAN] ${persona.scratch.name}: act_pron = ${act_pron}`);
  
  console.log(`[PLAN] ${persona.scratch.name}: Calling generate_action_event_triple...`);
  const act_event = await generate_action_event_triple(act_desp, persona);
  console.log(`[PLAN] ${persona.scratch.name}: act_event = ${JSON.stringify(act_event)}`);
  
  // Persona's actions also influence the object states. We set those up here. 
  console.log(`[PLAN] ${persona.scratch.name}: Calling generate_act_obj_desc...`);
  const act_obj_desp = await generate_act_obj_desc(act_game_object, act_desp, persona);
  console.log(`[PLAN] ${persona.scratch.name}: act_obj_desp = ${act_obj_desp}`);
  
  console.log(`[PLAN] ${persona.scratch.name}: Calling generate_action_pronunciatio for obj...`);
  const act_obj_pron = await generate_action_pronunciatio(act_obj_desp, persona);
  console.log(`[PLAN] ${persona.scratch.name}: act_obj_pron = ${act_obj_pron}`);
  
  console.log(`[PLAN] ${persona.scratch.name}: Calling generate_act_obj_event_triple...`);
  const act_obj_event = await generate_act_obj_event_triple(act_game_object, act_obj_desp, persona);
  console.log(`[PLAN] ${persona.scratch.name}: act_obj_event = ${JSON.stringify(act_obj_event)}`);

  // Adding the action to persona's queue. 
  persona.scratch.add_new_action(
    new_address,
    Math.floor(act_dura),
    act_desp,
    act_pron,
    act_event,
    null,
    null,
    null,
    null,
    act_obj_desp,
    act_obj_pron,
    act_obj_event
  );
}

export function _choose_retrieved(persona: Persona, retrieved: RetrievedMemory): RetrievedContext | null {
  /**
   * Retrieved elements have multiple core "curr_events". We need to choose one
   * event to which we are going to react to. We pick that event here. 
   * INPUT
   *   persona: Current <Persona> instance whose action we are determining. 
   *   retrieved: A dictionary of <ConceptNode> that were retrieved from the 
   *              the persona's associative memory. This dictionary takes the
   *              following form: 
   *              dictionary[event.description] = 
   *                {["curr_event"] = <ConceptNode>, 
   *                 ["events"] = [<ConceptNode>, ...], 
   *                 ["thoughts"] = [<ConceptNode>, ...] }
   */
  // Once we are done with the reflection, we might want to build a more  
  // complex structure here.

  // We do not want to take self events... for now 
  const copy_retrieved = { ...retrieved };
  for (const [event_desc, rel_ctx] of Object.entries(copy_retrieved)) {
    const curr_event = rel_ctx.curr_event;
    if (curr_event.subject === persona.name) {
      delete retrieved[event_desc];
    }
  }

  // Always choose persona first.
  const priority: RetrievedContext[] = [];
  for (const [event_desc, rel_ctx] of Object.entries(retrieved)) {
    const curr_event = rel_ctx.curr_event;
    if (!curr_event.subject.includes(":") && curr_event.subject !== persona.name) {
      priority.push(rel_ctx);
    }
  }
  if (priority.length > 0) {
    return priority[Math.floor(Math.random() * priority.length)];
  }

  // Skip idle. 
  for (const [event_desc, rel_ctx] of Object.entries(retrieved)) {
    const curr_event = rel_ctx.curr_event;
    if (!event_desc.includes("is idle")) {
      priority.push(rel_ctx);
    }
  }
  if (priority.length > 0) {
    return priority[Math.floor(Math.random() * priority.length)];
  }
  return null;
}

export async function _should_react(
  persona: Persona,
  retrieved: RetrievedContext,
  personas: Record<string, Persona>
): Promise<string | false> {
  /**
   * Determines what form of reaction the persona should exihibit given the 
   * retrieved values. 
   * INPUT
   *   persona: Current <Persona> instance whose action we are determining. 
   *   retrieved: A dictionary of <ConceptNode> that were retrieved from the 
   *              the persona's associative memory. This dictionary takes the
   *              following form: 
   *              dictionary[event.description] = 
   *                {["curr_event"] = <ConceptNode>, 
   *                 ["events"] = [<ConceptNode>, ...], 
   *                 ["thoughts"] = [<ConceptNode>, ...] }
   *   personas: A dictionary that contains all persona names as keys, and the 
   *             <Persona> instance as values. 
   */
  async function lets_talk(init_persona: Persona, target_persona: Persona, retrieved: RetrievedContext): Promise<boolean> {
    if (!target_persona.scratch.act_address
      || !target_persona.scratch.act_description
      || !init_persona.scratch.act_address
      || !init_persona.scratch.act_description) {
      return false;
    }

    if (target_persona.scratch.act_description.includes("sleeping")
      || init_persona.scratch.act_description.includes("sleeping")) {
      return false;
    }

    if (init_persona.scratch.curr_time.getHours() === 23) {
      return false;
    }

    if (init_persona.scratch.act_address.includes("<waiting>")) {
      return false;
    }

    if (target_persona.scratch.chatting_with
      || init_persona.scratch.chatting_with) {
      return false;
    }

    if (target_persona.name in init_persona.scratch.chatting_with_buffer) {
      if (init_persona.scratch.chatting_with_buffer[target_persona.name] > 0) {
        return false;
      }
    }

    // Wrap RetrievedContext into RetrievedMemory for the function call
    const retrieved_memory: RetrievedMemory = { [retrieved.curr_event.description]: retrieved };
    if (await generate_decide_to_talk(init_persona, target_persona, retrieved_memory)) {
      return true;
    }

    return false;
  }

  async function lets_react(init_persona: Persona, target_persona: Persona, retrieved: RetrievedContext): Promise<string | false> {
    if (!target_persona.scratch.act_address
      || !target_persona.scratch.act_description
      || !init_persona.scratch.act_address
      || !init_persona.scratch.act_description) {
      return false;
    }

    if (target_persona.scratch.act_description.includes("sleeping")
      || init_persona.scratch.act_description.includes("sleeping")) {
      return false;
    }

    // return false
    if (init_persona.scratch.curr_time.getHours() === 23) {
      return false;
    }

    if (target_persona.scratch.act_description.includes("waiting")) {
      return false;
    }
    if (init_persona.scratch.planned_path.length === 0) {
      return false;
    }

    if (init_persona.scratch.act_address !== target_persona.scratch.act_address) {
      return false;
    }

    // Wrap RetrievedContext into RetrievedMemory for the function call
    const retrieved_memory: RetrievedMemory = { [retrieved.curr_event.description]: retrieved };
    const react_mode = await generate_decide_to_react(init_persona, target_persona, retrieved_memory);

    if (react_mode === "1") {
      const wait_until = new Date(target_persona.scratch.act_start_time.getTime()
        + (target_persona.scratch.act_duration - 1) * 60000);
      const wait_until_str = wait_until.toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).replace(/,\s*/g, ', ');
      return `wait: ${wait_until_str}`;
    } else if (react_mode === "2") {
      return false;
      // return "do other things";
    } else {
      return false;
      // return "keep";
    }
  }

  // If the persona is chatting right now, default to no reaction 
  if (persona.scratch.chatting_with) {
    return false;
  }
  if (persona.scratch.act_address.includes("<waiting>")) {
    return false;
  }

  // Recall that retrieved takes the following form: 
  // dictionary {["curr_event"] = <ConceptNode>, 
  //             ["events"] = [<ConceptNode>, ...], 
  //             ["thoughts"] = [<ConceptNode>, ...]}
  const curr_event = retrieved.curr_event;

  if (!curr_event.subject.includes(":")) {
    // this is a persona event. 
    if (await lets_talk(persona, personas[curr_event.subject], retrieved)) {
      return `chat with ${curr_event.subject}`;
    }
    const react_mode = await lets_react(persona, personas[curr_event.subject], retrieved);
    return react_mode;
  }
  return false;
}

export async function _create_react(
  persona: Persona,
  inserted_act: string,
  inserted_act_dur: number,
  act_address: string,
  act_event: [string, string, string],
  chatting_with: string | null,
  chat: [string, string][] | null,
  chatting_with_buffer: Record<string, number> | null,
  chatting_end_time: Date | null,
  act_pronunciatio: string,
  act_obj_description: string | null,
  act_obj_pronunciatio: string | null,
  act_obj_event: [string | null, string | null, string | null],
  act_start_time?: Date
): Promise<void> {
  const p = persona;

  let min_sum = 0;
  for (let i = 0; i < p.scratch.get_f_daily_schedule_hourly_org_index(); i++) {
    min_sum += p.scratch.f_daily_schedule_hourly_org[i][1];
  }
  const start_hour = Math.floor(min_sum / 60);

  let end_hour: number;
  if (p.scratch.f_daily_schedule_hourly_org[p.scratch.get_f_daily_schedule_hourly_org_index()][1] >= 120) {
    end_hour = start_hour + p.scratch.f_daily_schedule_hourly_org[p.scratch.get_f_daily_schedule_hourly_org_index()][1] / 60;
  } else if (p.scratch.f_daily_schedule_hourly_org[p.scratch.get_f_daily_schedule_hourly_org_index()][1]
    + p.scratch.f_daily_schedule_hourly_org[p.scratch.get_f_daily_schedule_hourly_org_index() + 1]?.[1]) {
    end_hour = start_hour + ((p.scratch.f_daily_schedule_hourly_org[p.scratch.get_f_daily_schedule_hourly_org_index()][1]
      + p.scratch.f_daily_schedule_hourly_org[p.scratch.get_f_daily_schedule_hourly_org_index() + 1][1]) / 60);
  } else {
    end_hour = start_hour + 2;
  }
  end_hour = Math.floor(end_hour);

  let dur_sum = 0;
  let count = 0;
  let start_index: number | null = null;
  let end_index: number | null = null;
  for (const [act, dur] of p.scratch.f_daily_schedule) {
    if (dur_sum >= start_hour * 60 && start_index === null) {
      start_index = count;
    }
    if (dur_sum >= end_hour * 60 && end_index === null) {
      end_index = count;
    }
    dur_sum += dur;
    count += 1;
  }

  const ret = await generate_new_decomp_schedule(p, inserted_act, inserted_act_dur, start_hour, end_hour);
  if (start_index !== null && end_index !== null) {
    p.scratch.f_daily_schedule.splice(start_index, end_index - start_index, ...ret);
  }
  p.scratch.add_new_action(
    act_address,
    inserted_act_dur,
    inserted_act,
    act_pronunciatio,
    act_event,
    chatting_with,
    chat,
    chatting_with_buffer,
    chatting_end_time,
    act_obj_description,
    act_obj_pronunciatio,
    act_obj_event,
    act_start_time
  );
}

export async function _chat_react(
  maze: Maze,
  persona: Persona,
  focused_event: RetrievedContext,
  reaction_mode: string,
  personas: Record<string, Persona>
): Promise<void> {
  // There are two personas -- the persona who is initiating the conversation
  // and the persona who is the target. We get the persona instances here. 
  const init_persona = persona;
  const target_persona = personas[reaction_mode.slice(9).trim()];
  const curr_personas = [init_persona, target_persona];

  // Actually creating the conversation here. 
  const [convo, duration_min] = await generate_convo(maze, init_persona, target_persona);
  const convo_summary = await generate_convo_summary(init_persona, convo);
  const inserted_act = convo_summary;
  const inserted_act_dur = duration_min;

  const act_start_time = target_persona.scratch.act_start_time;

  const curr_time = target_persona.scratch.curr_time;
  let chatting_end_time: Date;
  if (curr_time.getSeconds() !== 0) {
    const temp_curr_time = new Date(curr_time.getTime() + (60 - curr_time.getSeconds()) * 1000);
    chatting_end_time = new Date(temp_curr_time.getTime() + inserted_act_dur * 60000);
  } else {
    chatting_end_time = new Date(curr_time.getTime() + inserted_act_dur * 60000);
  }

  for (const [role, p] of [["init", init_persona], ["target", target_persona]] as [string, Persona][]) {
    let act_address: string;
    let act_event: [string, string, string];
    let chatting_with: string;
    let chatting_with_buffer: Record<string, number>;

    if (role === "init") {
      act_address = `<persona> ${target_persona.name}`;
      act_event = [p.name, "chat with", target_persona.name];
      chatting_with = target_persona.name;
      chatting_with_buffer = {};
      chatting_with_buffer[target_persona.name] = 800;
    } else {
      act_address = `<persona> ${init_persona.name}`;
      act_event = [p.name, "chat with", init_persona.name];
      chatting_with = init_persona.name;
      chatting_with_buffer = {};
      chatting_with_buffer[init_persona.name] = 800;
    }

    const act_pronunciatio = "💬";
    const act_obj_description: string | null = null;
    const act_obj_pronunciatio: string | null = null;
    const act_obj_event: [string | null, string | null, string | null] = [null, null, null];

    await _create_react(
      p,
      inserted_act,
      inserted_act_dur,
      act_address,
      act_event,
      chatting_with,
      convo,
      chatting_with_buffer,
      chatting_end_time,
      act_pronunciatio,
      act_obj_description,
      act_obj_pronunciatio,
      act_obj_event,
      act_start_time
    );
  }
}

export async function _wait_react(persona: Persona, reaction_mode: string): Promise<void> {
  const p = persona;

  const inserted_act = `waiting to start ${p.scratch.act_description.split("(")[p.scratch.act_description.split("(").length - 1].slice(0, -1)}`;
  const end_time = new Date(reaction_mode.slice(6).trim());
  const inserted_act_dur = (end_time.getMinutes() + end_time.getHours() * 60) - (p.scratch.curr_time.getMinutes() + p.scratch.curr_time.getHours() * 60) + 1;

  const act_address = `<waiting> ${p.scratch.curr_tile[0]} ${p.scratch.curr_tile[1]}`;
  const act_event: [string, string, string] = [p.name, "waiting to start", p.scratch.act_description.split("(")[p.scratch.act_description.split("(").length - 1].slice(0, -1)];
  const chatting_with: string | null = null;
  const chat: [string, string][] | null = null;
  const chatting_with_buffer: Record<string, number> | null = null;
  const chatting_end_time: Date | null = null;

  const act_pronunciatio = "⌛";
  const act_obj_description: string | null = null;
  const act_obj_pronunciatio: string | null = null;
  const act_obj_event: [string | null, string | null, string | null] = [null, null, null];

  await _create_react(
    p,
    inserted_act,
    inserted_act_dur,
    act_address,
    act_event,
    chatting_with,
    chat,
    chatting_with_buffer,
    chatting_end_time,
    act_pronunciatio,
    act_obj_description,
    act_obj_pronunciatio,
    act_obj_event
  );
}

export async function plan(
  persona: Persona,
  maze: Maze,
  personas: Record<string, Persona>,
  new_day: string | false,
  retrieved: RetrievedMemory
): Promise<string> {
  /**
   * Main cognitive function of the chain. It takes the retrieved memory and 
   * perception, as well as the maze and the first day state to conduct both 
   * the long term and short term planning for the persona. 
   * INPUT: 
   *   maze: Current <Maze> instance of the world. 
   *   personas: A dictionary that contains all persona names as keys, and the 
   *             Persona instance as values. 
   *   new_day: This can take one of the three values. 
   *     1) <Boolean> False -- It is not a "new day" cycle (if it is, we would
   *        need to call the long term planning sequence for the persona). 
   *     2) <String> "First day" -- It is literally the start of a simulation,
   *        so not only is it a new day, but also it is the first day. 
   *     2) <String> "New day" -- It is a new day. 
   *   retrieved: dictionary of dictionary. The first layer specifies an event,
   *              while the latter layer specifies the "curr_event", "events", 
   *              and "thoughts" that are relevant.
   * OUTPUT 
   *   The target action address of the persona (persona.scratch.act_address).
   */
  // PART 1: Generate the hourly schedule. 
  if (new_day) {
    await _long_term_planning(persona, new_day);
  }

  // PART 2: If the current action has expired, we want to create a new plan.
  if (persona.scratch.act_check_finished()) {
    await _determine_action(persona, maze);
  }

  // PART 3: If you perceived an event that needs to be responded to (saw 
  // another persona), and retrieved relevant information. 
  // Step 1: Retrieved may have multiple events represented in it. The first 
  //         job here is to determine which of the events we want to focus 
  //         on for the persona. 
  //         <focused_event> takes the form of a dictionary like this: 
  //         dictionary {["curr_event"] = <ConceptNode>, 
  //                     ["events"] = [<ConceptNode>, ...], 
  //                     ["thoughts"] = [<ConceptNode>, ...]}
  let focused_event: RetrievedContext | false = false;
  if (Object.keys(retrieved).length > 0) {
    focused_event = _choose_retrieved(persona, retrieved);
  }

  // Step 2: Once we choose an event, we need to determine whether the
  //         persona will take any actions for the perceived event. There are
  //         three possible modes of reaction returned by _should_react. 
  //         a) "chat with {target_persona.name}"
  //         b) "react"
  //         c) False
  if (focused_event) {
    const reaction_mode = await _should_react(persona, focused_event, personas);
    if (reaction_mode) {
      // If we do want to chat, then we generate conversation 
      if (reaction_mode.slice(0, 9) === "chat with") {
        await _chat_react(maze, persona, focused_event, reaction_mode, personas);
      } else if (reaction_mode.slice(0, 4) === "wait") {
        await _wait_react(persona, reaction_mode);
      }
      // elif reaction_mode == "do other things": 
      //   _chat_react(persona, focused_event, reaction_mode, personas)
    }
  }

  // Step 3: Chat-related state clean up. 
  // If the persona is not chatting with anyone, we clean up any of the 
  // chat-related states here. 
  if (persona.scratch.act_event[1] !== "chat with") {
    persona.scratch.chatting_with = null;
    persona.scratch.chat = null;
    persona.scratch.chatting_end_time = null;
  }
  // We want to make sure that the persona does not keep conversing with each
  // other in an infinite loop. So, chatting_with_buffer maintains a form of 
  // buffer that makes the persona wait from talking to the same target 
  // immediately after chatting once. We keep track of the buffer value here. 
  const curr_persona_chat_buffer = persona.scratch.chatting_with_buffer;
  for (const [persona_name, buffer_count] of Object.entries(curr_persona_chat_buffer)) {
    if (persona_name !== persona.scratch.chatting_with) {
      persona.scratch.chatting_with_buffer[persona_name] -= 1;
    }
  }

  return persona.scratch.act_address;
}