/**
 * Retrieve module for generative agents.
 */

import type { ConceptNode, Persona, Maze, RetrievedMemory } from '../../../types.js';
import { get_embedding } from '../prompt_template/gpt_structure.js';

const debug = false;


/**
 * This function takes the events that are perceived by the persona as input
 * and returns a set of related events and thoughts that the persona would 
 * need to consider as context when planning.
 * 
 * INPUT: 
 *   persona: The persona object
 *   perceived: a list of event <ConceptNode>s that represent any of the events
 *              that are happening around the persona. What is included in here
 *              are controlled by the att_bandwidth and retention hyper-parameters.
 * OUTPUT: 
 *   retrieved: a dictionary of dictionary. The first layer specifies an event,
 *              while the latter layer specifies the "curr_event", "events",
 *              and "thoughts" that are relevant.
 */
export const retrieve = (
  persona: Persona,
  perceived: ConceptNode[]
): RetrievedMemory => {
  // We retrieve events and thoughts separately.
  const retrieved: RetrievedMemory = {};
  
  for (const event of perceived) {
    retrieved[event.description] = {
      curr_event: event,
      events: [],
      thoughts: []
    };

    // Retrieve relevant events
    const relevantEvents = persona.a_mem.retrieve_relevant_events(
      event.subject,
      event.predicate,
      event.object
    );
    retrieved[event.description].events = Array.from(relevantEvents);

    // Retrieve relevant thoughts
    const relevantThoughts = persona.a_mem.retrieve_relevant_thoughts(
      event.subject,
      event.predicate,
      event.object
    );
    retrieved[event.description].thoughts = Array.from(relevantThoughts);
  }

  return retrieved;
};

/**
 * This function calculates the cosine similarity between two input vectors 
 * 'a' and 'b'. Cosine similarity is a measure of similarity between two 
 * non-zero vectors of an inner product space that measures the cosine 
 * of the angle between them.
 * 
 * INPUT: 
 *   a: 1-D array of numbers
 *   b: 1-D array of numbers
 * OUTPUT: 
 *   A scalar value representing the cosine similarity between the input 
 *   vectors 'a' and 'b'.
 * 
 * Example input: 
 *   a = [0.3, 0.2, 0.5]
 *   b = [0.2, 0.2, 0.5]
 */
export const cos_sim = (a: number[], b: number[]): number => {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same length');
  }

  const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const normA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const normB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (normA * normB);
};

/**
 * This function normalizes the float values of a given dictionary 'd' between 
 * a target minimum and maximum value. The normalization is done by scaling the
 * values to the target range while maintaining the same relative proportions 
 * between the original values.
 * 
 * INPUT: 
 *   d: Dictionary. The input dictionary whose float values need to be 
 *      normalized.
 *   target_min: Integer or float. The minimum value to which the original 
 *               values should be scaled.
 *   target_max: Integer or float. The maximum value to which the original 
 *               values should be scaled.
 * OUTPUT: 
 *   A new dictionary with the same keys as the input but with the float
 *   values normalized between the target_min and target_max.
 * 
 * Example input: 
 *   d = {'a':1.2,'b':3.4,'c':5.6,'d':7.8}
 *   target_min = -5
 *   target_max = 5
 */
export const normalize_dict_floats = (
  d: Record<string, number>,
  target_min: number,
  target_max: number
): Record<string, number> => {
  const values = Object.values(d);
  const min_val = Math.min(...values);
  const max_val = Math.max(...values);
  const range_val = max_val - min_val;

  const result: Record<string, number> = {};
  
  if (range_val === 0) {
    for (const [key, val] of Object.entries(d)) {
      result[key] = (target_max - target_min) / 2;
    }
  } else {
    for (const [key, val] of Object.entries(d)) {
      result[key] = ((val - min_val) * (target_max - target_min) / range_val) + target_min;
    }
  }

  return result;
};

/**
 * This function takes a dictionary 'd' and an integer 'x' as input, and 
 * returns a new dictionary containing the top 'x' key-value pairs from the 
 * input dictionary 'd' with the highest values.
 * 
 * INPUT: 
 *   d: Dictionary. The input dictionary from which the top 'x' key-value pairs 
 *      with the highest values are to be extracted.
 *   x: Integer. The number of top key-value pairs with the highest values to
 *      be extracted from the input dictionary.
 * OUTPUT: 
 *   A new dictionary containing the top 'x' key-value pairs from the input 
 *   dictionary 'd' with the highest values.
 * 
 * Example input: 
 *   d = {'a':1.2,'b':3.4,'c':5.6,'d':7.8}
 *   x = 3
 */
export const top_highest_x_values = (
  d: Record<string, number>,
  x: number
): Record<string, number> => {
  const entries = Object.entries(d);
  entries.sort((a, b) => b[1] - a[1]);
  const topEntries = entries.slice(0, x);
  return Object.fromEntries(topEntries);
};

/**
 * Gets the current Persona object and a list of nodes that are in a 
 * chronological order, and outputs a dictionary that has the recency score
 * calculated.
 * 
 * INPUT: 
 *   persona: Current persona whose memory we are retrieving.
 *   nodes: A list of Node object in a chronological order.
 * OUTPUT: 
 *   recency_out: A dictionary whose keys are the node.node_id and whose values
 *                are the float that represents the recency score.
 */
export const extract_recency = (
  persona: Persona,
  nodes: ConceptNode[]
): Record<string, number> => {
  const recency_out: Record<string, number> = {};
  const recency_decay = persona.scratch.recency_decay;
  
  for (let i = 0; i < nodes.length; i++) {
    recency_out[nodes[i].node_id] = Math.pow(recency_decay, i + 1);
  }

  return recency_out;
};

/**
 * Gets the current Persona object and a list of nodes that are in a 
 * chronological order, and outputs a dictionary that has the importance score
 * calculated.
 * 
 * INPUT: 
 *   persona: Current persona whose memory we are retrieving.
 *   nodes: A list of Node object in a chronological order.
 * OUTPUT: 
 *   importance_out: A dictionary whose keys are the node.node_id and whose 
 *                   values are the float that represents the importance score.
 */
export const extract_importance = (
  persona: Persona,
  nodes: ConceptNode[]
): Record<string, number> => {
  const importance_out: Record<string, number> = {};
  
  for (const node of nodes) {
    importance_out[node.node_id] = node.poignancy;
  }

  return importance_out;
};

/**
 * Gets the current Persona object, a list of nodes that are in a 
 * chronological order, and the focal_pt string and outputs a dictionary 
 * that has the relevance score calculated.
 * 
 * INPUT: 
 *   persona: Current persona whose memory we are retrieving.
 *   nodes: A list of Node object in a chronological order.
 *   focal_pt: A string describing the current thought or event of focus.
 * OUTPUT: 
 *   relevance_out: A dictionary whose keys are the node.node_id and whose values
 *                  are the float that represents the relevance score.
 */
export const extract_relevance = async (
  persona: Persona,
  nodes: ConceptNode[],
  focal_pt: string
): Promise<Record<string, number>> => {
  const focal_embedding = await get_embedding(focal_pt);
  const relevance_out: Record<string, number> = {};

  for (const node of nodes) {
    const node_embedding = persona.a_mem.embeddings.get(node.embedding_key);
    if (node_embedding) {
      relevance_out[node.node_id] = cos_sim(node_embedding, focal_embedding);
    } else {
      relevance_out[node.node_id] = 0;
    }
  }

  return relevance_out;
};

/**
 * Given the current persona and focal points (focal points are events or 
 * thoughts for which we are retrieving), we retrieve a set of nodes for each
 * of the focal points and return a dictionary.
 * 
 * INPUT: 
 *   persona: The current persona object whose memory we are retrieving.
 *   focal_points: A list of focal points (string description of the events or
 *                 thoughts that is the focus of current retrieval).
 *   n_count: The number of top nodes to retrieve per focal point (default: 30).
 * OUTPUT: 
 *   retrieved: A dictionary whose keys are a string focal point, and whose 
 *              values are a list of Node object in the agent's associative 
 *              memory.
 * 
 * Example input:
 *   persona = <persona> object
 *   focal_points = ["How are you?", "Jane is swimming in the pond"]
 */
export const new_retrieve = async (
  persona: Persona,
  focal_points: string[],
  n_count = 30
): Promise<Record<string, ConceptNode[]>> => {
  // <retrieved> is the main dictionary that we are returning
  const retrieved: Record<string, ConceptNode[]> = {};

  for (const focal_pt of focal_points) {
    // Getting all nodes from the agent's memory (both thoughts and events) and
    // sorting them by the datetime of creation.
    // You could also imagine getting the raw conversation, but for now.
    const nodes: [Date, ConceptNode][] = [];
    
    // Combine events and thoughts, filter out idle nodes
    for (const event of persona.a_mem.seq_event) {
      if (!event.embedding_key.includes('idle')) {
        nodes.push([event.last_accessed, event]);
      }
    }
    
    for (const thought of persona.a_mem.seq_thought) {
      if (!thought.embedding_key.includes('idle')) {
        nodes.push([thought.last_accessed, thought]);
      }
    }

    // Sort by last accessed time
    nodes.sort((a, b) => a[0].getTime() - b[0].getTime());
    const sortedNodes = nodes.map(([accessed, node]) => node);

    // Calculating the component dictionaries and normalizing them.
    const recency_out = extract_recency(persona, sortedNodes);
    const recency_out_normalized = normalize_dict_floats(recency_out, 0, 1);
    
    const importance_out = extract_importance(persona, sortedNodes);
    const importance_out_normalized = normalize_dict_floats(importance_out, 0, 1);
    
    const relevance_out = await extract_relevance(persona, sortedNodes, focal_pt);
    const relevance_out_normalized = normalize_dict_floats(relevance_out, 0, 1);

    // Computing the final scores that combines the component values.
    // Note to self: test out different weights. [1, 1, 1] tends to work
    // decently, but in the future, these weights should likely be learned,
    // perhaps through an RL-like process.
    // gw = [1, 1, 1]
    // gw = [1, 2, 1]
    const gw = [0.5, 3, 2];
    const master_out: Record<string, number> = {};
    
    for (const key of Object.keys(recency_out_normalized)) {
      master_out[key] = (
        persona.scratch.recency_w * recency_out_normalized[key] * gw[0] +
        persona.scratch.relevance_w * relevance_out_normalized[key] * gw[1] +
        persona.scratch.importance_w * importance_out_normalized[key] * gw[2]
      );
    }

    // Sort by score
    const master_out_sorted = top_highest_x_values(master_out, Object.keys(master_out).length);

    // Debug print (optional)
    // for (const [key, val] of Object.entries(master_out_sorted)) {
    //   const node = persona.a_mem.id_to_node.get(key);
    //   if (node) {
    //     console.log(node.embedding_key, val);
    //     console.log(
    //       persona.scratch.recency_w * recency_out_normalized[key] * 1,
    //       persona.scratch.relevance_w * relevance_out_normalized[key] * 1,
    //       persona.scratch.importance_w * importance_out_normalized[key] * 1
    //     );
    //   }
    // }

    // Extracting the highest x values.
    // <master_out> has the key of node.id and value of float. Once we get the
    // highest x values, we want to translate the node.id into nodes and return
    // the list of nodes.
    const master_out_top = top_highest_x_values(master_out_sorted, n_count);
    const master_nodes: ConceptNode[] = [];
    
    for (const key of Object.keys(master_out_top)) {
      const node = persona.a_mem.id_to_node.get(key);
      if (node) {
        node.last_accessed = persona.scratch.curr_time;
        master_nodes.push(node);
      }
    }

    retrieved[focal_pt] = master_nodes;
  }

  return retrieved;
};