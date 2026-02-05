/**
 * Author: Joon Sung Park (joonspk@stanford.edu)
 * 
 * File: associative_memory.ts
 * Description: Defines the core long-term memory module for generative agents.
 * Note: This class is the Memory Stream module in the generative agents paper.
 */

import * as fs from 'fs';
import * as path from 'path';
import { ConceptNode, AssociativeMemory as AssociativeMemoryInterface } from '../../../types.js';
import { check_if_file_exists } from '../../global_methods.js';

export { ConceptNode };

export class AssociativeMemory implements AssociativeMemoryInterface {
  id_to_node: Map<string, ConceptNode>;
  seq_event: ConceptNode[];
  seq_thought: ConceptNode[];
  seq_chat: ConceptNode[];
  kw_to_event: Map<string, ConceptNode[]>;
  kw_to_thought: Map<string, ConceptNode[]>;
  kw_to_chat: Map<string, ConceptNode[]>;
  kw_strength_event: Map<string, number>;
  kw_strength_thought: Map<string, number>;
  embeddings: Map<string, number[]>;

  constructor(f_saved?: string) {
    this.id_to_node = new Map();
    this.seq_event = [];
    this.seq_thought = [];
    this.seq_chat = [];
    this.kw_to_event = new Map();
    this.kw_to_thought = new Map();
    this.kw_to_chat = new Map();
    this.kw_strength_event = new Map();
    this.kw_strength_thought = new Map();
    this.embeddings = new Map();

    if (f_saved && check_if_file_exists(f_saved)) {
      this.load(f_saved);
    }
  }

  private load(f_saved: string): void {
    // Load embeddings
    const embeddings_path = path.join(f_saved, 'embeddings.json');
    if (check_if_file_exists(embeddings_path)) {
      const embeddings_data = JSON.parse(fs.readFileSync(embeddings_path, 'utf-8'));
      for (const [key, value] of Object.entries(embeddings_data)) {
        this.embeddings.set(key, value as number[]);
      }
    }

    // Load nodes
    const nodes_path = path.join(f_saved, 'nodes.json');
    if (check_if_file_exists(nodes_path)) {
      const nodes_load = JSON.parse(fs.readFileSync(nodes_path, 'utf-8'));
      for (const node_id of Object.keys(nodes_load)) {
        const node_details = nodes_load[node_id];

        const node_count = node_details.node_count;
        const type_count = node_details.type_count;
        const node_type = node_details.type;
        const depth = node_details.depth;

        const created = new Date(node_details.created);
        const expiration = node_details.expiration ? new Date(node_details.expiration) : null;

        const s = node_details.subject;
        const p = node_details.predicate;
        const o = node_details.object;

        const description = node_details.description;
        const embedding_pair: [string, number[]] = [node_details.embedding_key, this.embeddings.get(node_details.embedding_key) || []];
        const poignancy = node_details.poignancy;
        const keywords = new Set<string>(node_details.keywords);
        const filling = node_details.filling;

        if (node_type === 'event') {
          this.add_event(created, expiration, s, p, o, description, keywords, poignancy, embedding_pair, filling);
        } else if (node_type === 'chat') {
          this.add_chat(created, expiration, s, p, o, description, keywords, poignancy, embedding_pair, filling);
        } else if (node_type === 'thought') {
          this.add_thought(created, expiration, s, p, o, description, keywords, poignancy, embedding_pair, filling);
        }
      }
    }

    // Load keyword strength
    const kw_strength_path = path.join(f_saved, 'kw_strength.json');
    if (check_if_file_exists(kw_strength_path)) {
      const kw_strength_load = JSON.parse(fs.readFileSync(kw_strength_path, 'utf-8'));
      if (kw_strength_load.kw_strength_event) {
        for (const [key, value] of Object.entries(kw_strength_load.kw_strength_event)) {
          this.kw_strength_event.set(key, value as number);
        }
      }
      if (kw_strength_load.kw_strength_thought) {
        for (const [key, value] of Object.entries(kw_strength_load.kw_strength_thought)) {
          this.kw_strength_thought.set(key, value as number);
        }
      }
    }
  }

  save(out_json: string): void {
    if (!fs.existsSync(out_json)) {
      fs.mkdirSync(out_json, { recursive: true });
    }

    // Save nodes
    const r: any = {};
    const node_ids = Array.from(this.id_to_node.keys()).sort((a, b) => {
      const numA = parseInt(a.split('_')[1]);
      const numB = parseInt(b.split('_')[1]);
      return numB - numA;
    });

    for (const node_id of node_ids) {
      const node = this.id_to_node.get(node_id)!;
      r[node_id] = {
        node_count: node.node_count,
        type_count: node.type_count,
        type: node.type,
        depth: node.depth,
        created: node.created.toISOString().slice(0, 19).replace('T', ' '),
        expiration: node.expiration ? node.expiration.toISOString().slice(0, 19).replace('T', ' ') : null,
        subject: node.subject,
        predicate: node.predicate,
        object: node.object,
        description: node.description,
        embedding_key: node.embedding_key,
        poignancy: node.poignancy,
        keywords: Array.from(node.keywords),
        filling: node.filling
      };
    }

    fs.writeFileSync(path.join(out_json, 'nodes.json'), JSON.stringify(r, null, 2));

    // Save keyword strength
    const kw_strength: any = {};
    kw_strength.kw_strength_event = Object.fromEntries(this.kw_strength_event);
    kw_strength.kw_strength_thought = Object.fromEntries(this.kw_strength_thought);
    fs.writeFileSync(path.join(out_json, 'kw_strength.json'), JSON.stringify(kw_strength, null, 2));

    // Save embeddings
    fs.writeFileSync(path.join(out_json, 'embeddings.json'), JSON.stringify(Object.fromEntries(this.embeddings), null, 2));
  }

  add_event(
    created: Date,
    expiration: Date | null,
    s: string,
    p: string,
    o: string,
    description: string,
    keywords: Set<string>,
    poignancy: number,
    embedding_pair: [string, number[]],
    filling: string[] | null
  ): ConceptNode {
    const node_count = this.id_to_node.size + 1;
    const type_count = this.seq_event.length + 1;
    const node_type: 'event' | 'thought' | 'chat' = 'event';
    const node_id = `node_${node_count}`;
    const depth = 0;

    // Node type specific clean up
    let clean_description = description;
    if (description.includes('(')) {
      const parts = description.split(' ');
      clean_description = `${parts.slice(0, 3).join(' ')} ${description.split('(').slice(-1)[0].slice(0, -1)}`;
    }

    const node: ConceptNode = {
      node_id,
      node_count,
      type_count,
      type: node_type,
      depth,
      created,
      expiration,
      last_accessed: created,
      subject: s,
      predicate: p,
      object: o,
      description: clean_description,
      embedding_key: embedding_pair[0],
      poignancy,
      keywords,
      filling
    };

    this.seq_event.unshift(node);

    const keywords_lower = Array.from(keywords).map(i => i.toLowerCase());
    for (const kw of keywords_lower) {
      if (this.kw_to_event.has(kw)) {
        this.kw_to_event.get(kw)!.unshift(node);
      } else {
        this.kw_to_event.set(kw, [node]);
      }
    }

    this.id_to_node.set(node_id, node);

    if (`${p} ${o}` !== 'is idle') {
      for (const kw of keywords_lower) {
        if (this.kw_strength_event.has(kw)) {
          this.kw_strength_event.set(kw, this.kw_strength_event.get(kw)! + 1);
        } else {
          this.kw_strength_event.set(kw, 1);
        }
      }
    }

    this.embeddings.set(embedding_pair[0], embedding_pair[1]);

    return node;
  }

  add_thought(
    created: Date,
    expiration: Date | null,
    s: string,
    p: string,
    o: string,
    description: string,
    keywords: Set<string>,
    poignancy: number,
    embedding_pair: [string, number[]],
    filling: string[] | null
  ): ConceptNode {
    const node_count = this.id_to_node.size + 1;
    const type_count = this.seq_thought.length + 1;
    const node_type: 'event' | 'thought' | 'chat' = 'thought';
    const node_id = `node_${node_count}`;
    let depth = 1;

    if (filling && filling.length > 0) {
      try {
        const depths = filling.map(id => this.id_to_node.get(id)!.depth);
        depth = Math.max(...depths) + 1;
      } catch {
        // Keep default depth
      }
    }

    const node: ConceptNode = {
      node_id,
      node_count,
      type_count,
      type: node_type,
      depth,
      created,
      expiration,
      last_accessed: created,
      subject: s,
      predicate: p,
      object: o,
      description,
      embedding_key: embedding_pair[0],
      poignancy,
      keywords,
      filling
    };

    this.seq_thought.unshift(node);

    const keywords_lower = Array.from(keywords).map(i => i.toLowerCase());
    for (const kw of keywords_lower) {
      if (this.kw_to_thought.has(kw)) {
        this.kw_to_thought.get(kw)!.unshift(node);
      } else {
        this.kw_to_thought.set(kw, [node]);
      }
    }

    this.id_to_node.set(node_id, node);

    if (`${p} ${o}` !== 'is idle') {
      for (const kw of keywords_lower) {
        if (this.kw_strength_thought.has(kw)) {
          this.kw_strength_thought.set(kw, this.kw_strength_thought.get(kw)! + 1);
        } else {
          this.kw_strength_thought.set(kw, 1);
        }
      }
    }

    this.embeddings.set(embedding_pair[0], embedding_pair[1]);

    return node;
  }

  add_chat(
    created: Date,
    expiration: Date | null,
    s: string,
    p: string,
    o: string,
    description: string,
    keywords: Set<string>,
    poignancy: number,
    embedding_pair: [string, number[]],
    filling: string[] | null
  ): ConceptNode {
    const node_count = this.id_to_node.size + 1;
    const type_count = this.seq_chat.length + 1;
    const node_type: 'event' | 'thought' | 'chat' = 'chat';
    const node_id = `node_${node_count}`;
    const depth = 0;

    const node: ConceptNode = {
      node_id,
      node_count,
      type_count,
      type: node_type,
      depth,
      created,
      expiration,
      last_accessed: created,
      subject: s,
      predicate: p,
      object: o,
      description,
      embedding_key: embedding_pair[0],
      poignancy,
      keywords,
      filling
    };

    this.seq_chat.unshift(node);

    const keywords_lower = Array.from(keywords).map(i => i.toLowerCase());
    for (const kw of keywords_lower) {
      if (this.kw_to_chat.has(kw)) {
        this.kw_to_chat.get(kw)!.unshift(node);
      } else {
        this.kw_to_chat.set(kw, [node]);
      }
    }

    this.id_to_node.set(node_id, node);
    this.embeddings.set(embedding_pair[0], embedding_pair[1]);

    return node;
  }

  get_summarized_latest_events(retention: number): Set<[string, string, string]> {
    const ret_set = new Set<[string, string, string]>();
    for (const e_node of this.seq_event.slice(0, retention)) {
      ret_set.add([e_node.subject, e_node.predicate, e_node.object]);
    }
    return ret_set;
  }

  get_str_seq_events(): string {
    let ret_str = '';
    for (let count = 0; count < this.seq_event.length; count++) {
      const event = this.seq_event[count];
      ret_str += `Event ${this.seq_event.length - count}: ${event.subject} ${event.predicate} ${event.object} -- ${event.description}\n`;
    }
    return ret_str;
  }

  get_str_seq_thoughts(): string {
    let ret_str = '';
    for (let count = 0; count < this.seq_thought.length; count++) {
      const event = this.seq_thought[count];
      ret_str += `Thought ${this.seq_thought.length - count}: ${event.subject} ${event.predicate} ${event.object} -- ${event.description}`;
    }
    return ret_str;
  }

  get_str_seq_chats(): string {
    let ret_str = '';
    for (const event of this.seq_chat) {
      ret_str += `with ${event.object} (${event.description})\n`;
      ret_str += `${event.created.toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}\n`;
      if (event.filling) {
        for (const row of event.filling) {
          ret_str += `${row[0]}: ${row[1]}\n`;
        }
      }
    }
    return ret_str;
  }

  retrieve_relevant_thoughts(s_content: string, p_content: string, o_content: string): Set<ConceptNode> {
    const contents: string[] = [s_content, p_content, o_content];
    const ret: ConceptNode[] = [];

    for (const i of contents) {
      if (this.kw_to_thought.has(i.toLowerCase())) {
        ret.push(...this.kw_to_thought.get(i.toLowerCase())!);
      }
    }

    return new Set(ret);
  }

  retrieve_relevant_events(s_content: string, p_content: string, o_content: string): Set<ConceptNode> {
    const contents: string[] = [s_content, p_content, o_content];
    const ret: ConceptNode[] = [];

    for (const i of contents) {
      if (this.kw_to_event.has(i)) {
        ret.push(...this.kw_to_event.get(i)!);
      }
    }

    return new Set(ret);
  }

  get_last_chat(target_persona_name: string): ConceptNode | null {
    const lowerName = target_persona_name.toLowerCase();
    if (this.kw_to_chat.has(lowerName)) {
      return this.kw_to_chat.get(lowerName)![0];
    }
    return null;
  }
}
