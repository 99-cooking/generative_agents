/**
 * Author: Joon Sung Park (joonspk@stanford.edu)
 * 
 * File: scratch.ts
 * Description: Defines the short-term memory module for generative agents.
 */

import * as fs from 'fs';
import * as path from 'path';
import { check_if_file_exists } from '../../global_methods.js';
import { Scratch as ScratchInterface } from '../../../types.js';

export class Scratch implements ScratchInterface {
  // PERSONA HYPERPARAMETERS
  vision_r: number;
  att_bandwidth: number;
  retention: number;

  // WORLD INFORMATION
  curr_time: Date;
  curr_tile: [number, number];
  daily_plan_req: string;

  // THE CORE IDENTITY OF THE PERSONA
  name: string;
  first_name: string;
  last_name: string;
  age: number;
  innate: string;
  learned: string;
  currently: string;
  lifestyle: string;
  living_area: string;

  // REFLECTION VARIABLES
  concept_forget: number;
  daily_reflection_time: number;
  daily_reflection_size: number;
  overlap_reflect_th: number;
  kw_strg_event_reflect_th: number;
  kw_strg_thought_reflect_th: number;
  recency_w: number;
  relevance_w: number;
  importance_w: number;
  recency_decay: number;
  importance_trigger_max: number;
  importance_trigger_curr: number;
  importance_ele_n: number;
  thought_count: number;

  // PERSONA PLANNING
  daily_req: string[];
  f_daily_schedule: [string, number][];
  f_daily_schedule_hourly_org: [string, number][];

  // CURR ACTION
  act_address: string | null;
  act_start_time: Date | null;
  act_duration: number | null;
  act_description: string | null;
  act_pronunciatio: string | null;
  act_event: [string, string | null, string | null];

  act_obj_description: string | null;
  act_obj_pronunciatio: string | null;
  act_obj_event: [string | null, string | null, string | null];

  chatting_with: string | null;
  chat: [string, string][] | null;
  chatting_with_buffer: Record<string, number>;
  chatting_end_time: Date | null;

  act_path_set: boolean;
  planned_path: [number, number][];

  constructor(f_saved?: string) {
    // Default values
    this.vision_r = 4;
    this.att_bandwidth = 3;
    this.retention = 5;

    this.curr_time = new Date();
    this.curr_tile = [0, 0];
    this.daily_plan_req = '';

    this.name = '';
    this.first_name = '';
    this.last_name = '';
    this.age = 0;
    this.innate = '';
    this.learned = '';
    this.currently = '';
    this.lifestyle = '';
    this.living_area = '';

    this.concept_forget = 100;
    this.daily_reflection_time = 60 * 3;
    this.daily_reflection_size = 5;
    this.overlap_reflect_th = 2;
    this.kw_strg_event_reflect_th = 4;
    this.kw_strg_thought_reflect_th = 4;
    this.recency_w = 1;
    this.relevance_w = 1;
    this.importance_w = 1;
    this.recency_decay = 0.99;
    this.importance_trigger_max = 150;
    this.importance_trigger_curr = this.importance_trigger_max;
    this.importance_ele_n = 0;
    this.thought_count = 5;

    this.daily_req = [];
    this.f_daily_schedule = [];
    this.f_daily_schedule_hourly_org = [];

    this.act_address = null;
    this.act_start_time = null;
    this.act_duration = null;
    this.act_description = null;
    this.act_pronunciatio = null;
    this.act_event = [this.name, null, null];

    this.act_obj_description = null;
    this.act_obj_pronunciatio = null;
    this.act_obj_event = [null, null, null];

    this.chatting_with = null;
    this.chat = null;
    this.chatting_with_buffer = {};
    this.chatting_end_time = null;

    this.act_path_set = false;
    this.planned_path = [];

    if (f_saved && check_if_file_exists(f_saved)) {
      const scratch_load = JSON.parse(fs.readFileSync(f_saved, 'utf-8'));

      this.vision_r = scratch_load.vision_r;
      this.att_bandwidth = scratch_load.att_bandwidth;
      this.retention = scratch_load.retention;

      if (scratch_load.curr_time) {
        this.curr_time = new Date(scratch_load.curr_time);
      }
      this.curr_tile = scratch_load.curr_tile;
      this.daily_plan_req = scratch_load.daily_plan_req;

      this.name = scratch_load.name;
      this.first_name = scratch_load.first_name;
      this.last_name = scratch_load.last_name;
      this.age = scratch_load.age;
      this.innate = scratch_load.innate;
      this.learned = scratch_load.learned;
      this.currently = scratch_load.currently;
      this.lifestyle = scratch_load.lifestyle;
      this.living_area = scratch_load.living_area;

      this.concept_forget = scratch_load.concept_forget;
      this.daily_reflection_time = scratch_load.daily_reflection_time;
      this.daily_reflection_size = scratch_load.daily_reflection_size;
      this.overlap_reflect_th = scratch_load.overlap_reflect_th;
      this.kw_strg_event_reflect_th = scratch_load.kw_strg_event_reflect_th;
      this.kw_strg_thought_reflect_th = scratch_load.kw_strg_thought_reflect_th;

      this.recency_w = scratch_load.recency_w;
      this.relevance_w = scratch_load.relevance_w;
      this.importance_w = scratch_load.importance_w;
      this.recency_decay = scratch_load.recency_decay;
      this.importance_trigger_max = scratch_load.importance_trigger_max;
      this.importance_trigger_curr = scratch_load.importance_trigger_curr;
      this.importance_ele_n = scratch_load.importance_ele_n;
      this.thought_count = scratch_load.thought_count;

      this.daily_req = scratch_load.daily_req;
      this.f_daily_schedule = scratch_load.f_daily_schedule;
      this.f_daily_schedule_hourly_org = scratch_load.f_daily_schedule_hourly_org;

      this.act_address = scratch_load.act_address;
      if (scratch_load.act_start_time) {
        this.act_start_time = new Date(scratch_load.act_start_time);
      }
      this.act_duration = scratch_load.act_duration;
      this.act_description = scratch_load.act_description;
      this.act_pronunciatio = scratch_load.act_pronunciatio;
      this.act_event = scratch_load.act_event;

      this.act_obj_description = scratch_load.act_obj_description;
      this.act_obj_pronunciatio = scratch_load.act_obj_pronunciatio;
      this.act_obj_event = scratch_load.act_obj_event;

      this.chatting_with = scratch_load.chatting_with;
      this.chat = scratch_load.chat;
      this.chatting_with_buffer = scratch_load.chatting_with_buffer || {};
      if (scratch_load.chatting_end_time) {
        this.chatting_end_time = new Date(scratch_load.chatting_end_time);
      }

      this.act_path_set = scratch_load.act_path_set;
      this.planned_path = scratch_load.planned_path;
    }
  }

  save(out_json: string): void {
    const scratch: any = {};
    scratch.vision_r = this.vision_r;
    scratch.att_bandwidth = this.att_bandwidth;
    scratch.retention = this.retention;

    scratch.curr_time = this.curr_time.toISOString();
    scratch.curr_tile = this.curr_tile;
    scratch.daily_plan_req = this.daily_plan_req;

    scratch.name = this.name;
    scratch.first_name = this.first_name;
    scratch.last_name = this.last_name;
    scratch.age = this.age;
    scratch.innate = this.innate;
    scratch.learned = this.learned;
    scratch.currently = this.currently;
    scratch.lifestyle = this.lifestyle;
    scratch.living_area = this.living_area;

    scratch.concept_forget = this.concept_forget;
    scratch.daily_reflection_time = this.daily_reflection_time;
    scratch.daily_reflection_size = this.daily_reflection_size;
    scratch.overlap_reflect_th = this.overlap_reflect_th;
    scratch.kw_strg_event_reflect_th = this.kw_strg_event_reflect_th;
    scratch.kw_strg_thought_reflect_th = this.kw_strg_thought_reflect_th;

    scratch.recency_w = this.recency_w;
    scratch.relevance_w = this.relevance_w;
    scratch.importance_w = this.importance_w;
    scratch.recency_decay = this.recency_decay;
    scratch.importance_trigger_max = this.importance_trigger_max;
    scratch.importance_trigger_curr = this.importance_trigger_curr;
    scratch.importance_ele_n = this.importance_ele_n;
    scratch.thought_count = this.thought_count;

    scratch.daily_req = this.daily_req;
    scratch.f_daily_schedule = this.f_daily_schedule;
    scratch.f_daily_schedule_hourly_org = this.f_daily_schedule_hourly_org;

    scratch.act_address = this.act_address;
    scratch.act_start_time = this.act_start_time ? this.act_start_time.toISOString() : null;
    scratch.act_duration = this.act_duration;
    scratch.act_description = this.act_description;
    scratch.act_pronunciatio = this.act_pronunciatio;
    scratch.act_event = this.act_event;

    scratch.act_obj_description = this.act_obj_description;
    scratch.act_obj_pronunciatio = this.act_obj_pronunciatio;
    scratch.act_obj_event = this.act_obj_event;

    scratch.chatting_with = this.chatting_with;
    scratch.chat = this.chat;
    scratch.chatting_with_buffer = this.chatting_with_buffer;
    scratch.chatting_end_time = this.chatting_end_time ? this.chatting_end_time.toISOString() : null;

    scratch.act_path_set = this.act_path_set;
    scratch.planned_path = this.planned_path;

    fs.writeFileSync(out_json, JSON.stringify(scratch, null, 2));
  }

  get_f_daily_schedule_index(advance = 0): number {
    const today_min_elapsed = this.curr_time.getHours() * 60 + this.curr_time.getMinutes() + advance;

    let curr_index = 0;
    let elapsed = 0;
    for (const [task, duration] of this.f_daily_schedule) {
      elapsed += duration;
      if (elapsed > today_min_elapsed) {
        return curr_index;
      }
      curr_index++;
    }
    return curr_index;
  }

  get_f_daily_schedule_hourly_org_index(advance = 0): number {
    const today_min_elapsed = this.curr_time.getHours() * 60 + this.curr_time.getMinutes() + advance;

    let curr_index = 0;
    let elapsed = 0;
    for (const [task, duration] of this.f_daily_schedule_hourly_org) {
      elapsed += duration;
      if (elapsed > today_min_elapsed) {
        return curr_index;
      }
      curr_index++;
    }
    return curr_index;
  }

  get_str_iss(): string {
    let commonset = '';
    commonset += `Name: ${this.name}\n`;
    commonset += `Age: ${this.age}\n`;
    commonset += `Innate traits: ${this.innate}\n`;
    commonset += `Learned traits: ${this.learned}\n`;
    commonset += `Currently: ${this.currently}\n`;
    commonset += `Lifestyle: ${this.lifestyle}\n`;
    commonset += `Daily plan requirement: ${this.daily_plan_req}\n`;
    commonset += `Current Date: ${this.curr_time.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}\n`;
    return commonset;
  }

  get_str_name(): string {
    return this.name;
  }

  get_str_firstname(): string {
    return this.first_name;
  }

  get_str_lastname(): string {
    return this.last_name;
  }

  get_str_age(): string {
    return String(this.age);
  }

  get_str_innate(): string {
    return this.innate;
  }

  get_str_learned(): string {
    return this.learned;
  }

  get_str_currently(): string {
    return this.currently;
  }

  get_str_lifestyle(): string {
    return this.lifestyle;
  }

  get_str_daily_plan_req(): string {
    return this.daily_plan_req;
  }

  get_str_curr_date_str(): string {
    return this.curr_time.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  }

  get_curr_event(): [string, string | null, string | null] {
    if (!this.act_address) {
      return [this.name, null, null];
    }
    return this.act_event;
  }

  get_curr_event_and_desc(): [string, string | null, string | null, string | null] {
    if (!this.act_address) {
      return [this.name, null, null, null];
    }
    return [this.act_event[0], this.act_event[1], this.act_event[2], this.act_description];
  }

  get_curr_obj_event_and_desc(): [string, string | null, string | null, string | null] {
    if (!this.act_address) {
      return ['', null, null, null];
    }
    return [this.act_address, this.act_obj_event[1], this.act_obj_event[2], this.act_obj_description];
  }

  add_new_action(
    action_address: string,
    action_duration: number,
    action_description: string,
    action_pronunciatio: string,
    action_event: [string, string, string],
    chatting_with: string | null,
    chat: [string, string][] | null,
    chatting_with_buffer: Record<string, number> | null,
    chatting_end_time: Date | null,
    act_obj_description: string | null,
    act_obj_pronunciatio: string | null,
    act_obj_event: [string | null, string | null, string | null],
    act_start_time: Date | null = null
  ): void {
    this.act_address = action_address;
    this.act_duration = action_duration;
    this.act_description = action_description;
    this.act_pronunciatio = action_pronunciatio;
    this.act_event = action_event;

    this.chatting_with = chatting_with;
    this.chat = chat;
    if (chatting_with_buffer) {
      Object.assign(this.chatting_with_buffer, chatting_with_buffer);
    }
    this.chatting_end_time = chatting_end_time;

    this.act_obj_description = act_obj_description;
    this.act_obj_pronunciatio = act_obj_pronunciatio;
    this.act_obj_event = act_obj_event;

    this.act_start_time = this.curr_time;
    this.act_path_set = false;
  }

  act_time_str(): string {
    return this.act_start_time ? this.act_start_time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '';
  }

  act_check_finished(): boolean {
    if (!this.act_address) {
      return true;
    }

    let end_time: Date;
    if (this.chatting_with) {
      end_time = this.chatting_end_time!;
    } else {
      const x = new Date(this.act_start_time!);
      if (x.getSeconds() !== 0) {
        x.setSeconds(0);
        x.setMinutes(x.getMinutes() + 1);
      }
      end_time = new Date(x.getTime() + (this.act_duration || 0) * 60000);
    }

    const curr_time_str = this.curr_time.toLocaleTimeString('en-US', { hour12: false });
    const end_time_str = end_time.toLocaleTimeString('en-US', { hour12: false });
    return curr_time_str === end_time_str;
  }

  act_summarize(): Record<string, any> {
    return {
      persona: this.name,
      address: this.act_address,
      start_datetime: this.act_start_time,
      duration: this.act_duration,
      description: this.act_description,
      pronunciatio: this.act_pronunciatio
    };
  }

  act_summary_str(): string {
    const start_datetime_str = this.act_start_time ? this.act_start_time.toLocaleString('en-US', { weekday: 'long', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
    let ret = `[${start_datetime_str}]\n`;
    ret += `Activity: ${this.name} is ${this.act_description}\n`;
    ret += `Address: ${this.act_address}\n`;
    ret += `Duration in minutes (e.g., x min): ${this.act_duration} min\n`;
    return ret;
  }

  get_str_daily_schedule_summary(): string {
    let ret = '';
    let curr_min_sum = 0;
    for (const [task, duration] of this.f_daily_schedule) {
      curr_min_sum += duration;
      const hour = Math.floor(curr_min_sum / 60);
      const minute = curr_min_sum % 60;
      ret += `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')} || ${task}\n`;
    }
    return ret;
  }

  get_str_daily_schedule_hourly_org_summary(): string {
    let ret = '';
    let curr_min_sum = 0;
    for (const [task, duration] of this.f_daily_schedule_hourly_org) {
      curr_min_sum += duration;
      const hour = Math.floor(curr_min_sum / 60);
      const minute = curr_min_sum % 60;
      ret += `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')} || ${task}\n`;
    }
    return ret;
  }
}
