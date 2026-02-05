/**
 * Author: Joon Sung Park (joonspk@stanford.edu)
 * 
 * File: gpt_structure.ts
 * Description: Wrapper functions for calling OpenRouter API (replacing OpenAI).
 * 
 * Updated with proper timeouts and error handling.
 */

import * as fs from 'fs';
import * as path from 'path';

export interface GPTParameters {
  engine?: string;
  model?: string;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stream?: boolean;
  stop?: string[] | null;
}

// Configuration
const DEFAULT_TIMEOUT_MS = 60000; // 60 seconds
const DEFAULT_MODEL = 'deepseek/deepseek-chat';
const EMBEDDING_MODEL = 'openai/text-embedding-ada-002';
const DEBUG_LLM = process.env.DEBUG_LLM === 'true';

/**
 * Extract JSON from a response that may be wrapped in markdown code blocks
 */
function extractJSON(response: string): string {
  let text = response.trim();
  
  // Remove markdown code blocks if present
  // Handle ```json ... ``` or ``` ... ```
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    text = codeBlockMatch[1].trim();
  }
  
  // Find the JSON object - look for { ... }
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return jsonMatch[0];
  }
  
  return text;
}

/**
 * Sleep for specified milliseconds
 */
export const tempSleep = (seconds = 0.1): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, seconds * 1000));
};

/**
 * Create a fetch with timeout
 */
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number = DEFAULT_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Make a single request to OpenRouter chat completion API
 */
export const ChatGPT_single_request = async (prompt: string): Promise<string> => {
  await tempSleep();
  
  if (DEBUG_LLM) {
    console.log(`[LLM] ChatGPT_single_request - prompt length: ${prompt.length}`);
  }
  
  try {
    const response = await fetchWithTimeout('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[LLM ERROR] OpenRouter API error:', response.status, response.statusText, errorText);
      return 'ChatGPT ERROR';
    }

    const data = await response.json() as any;
    const result = data.choices?.[0]?.message?.content || 'ChatGPT ERROR';
    
    if (DEBUG_LLM) {
      console.log(`[LLM] Response length: ${result.length}`);
    }
    
    return result;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.error('[LLM ERROR] Request timed out after', DEFAULT_TIMEOUT_MS, 'ms');
    } else {
      console.error('[LLM ERROR] ChatGPT_single_request failed:', error.message);
    }
    return 'ChatGPT ERROR';
  }
};

/**
 * Make a request to OpenRouter chat completion API (GPT-4 equivalent)
 */
export const GPT4_request = async (prompt: string): Promise<string> => {
  await tempSleep();
  
  if (DEBUG_LLM) {
    console.log(`[LLM] GPT4_request - prompt length: ${prompt.length}`);
  }
  
  try {
    const response = await fetchWithTimeout('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[LLM ERROR] OpenRouter API error:', response.status, response.statusText, errorText);
      return 'ChatGPT ERROR';
    }

    const data = await response.json() as any;
    return data.choices?.[0]?.message?.content || 'ChatGPT ERROR';
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.error('[LLM ERROR] Request timed out');
    } else {
      console.error('[LLM ERROR] GPT4_request failed:', error.message);
    }
    return 'ChatGPT ERROR';
  }
};

/**
 * Make a request to OpenRouter chat completion API (GPT-3.5 equivalent)
 */
export const ChatGPT_request = async (prompt: string): Promise<string> => {
  if (DEBUG_LLM) {
    console.log(`[LLM] ChatGPT_request - prompt length: ${prompt.length}`);
  }
  
  try {
    const response = await fetchWithTimeout('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[LLM ERROR] OpenRouter API error:', response.status, response.statusText, errorText);
      return 'ChatGPT ERROR';
    }

    const data = await response.json() as any;
    return data.choices?.[0]?.message?.content || 'ChatGPT ERROR';
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.error('[LLM ERROR] Request timed out');
    } else {
      console.error('[LLM ERROR] ChatGPT_request failed:', error.message);
    }
    return 'ChatGPT ERROR';
  }
};

/**
 * Safe generation with GPT-4 equivalent model
 */
export const GPT4_safe_generate_response = async <T = string>(
  prompt: string,
  example_output: string,
  special_instruction: string,
  repeat = 3,
  fail_safe_response: any = "error",
  func_validate?: (response: string, prompt?: string) => boolean,
  func_clean_up?: (response: string, prompt?: string) => T,
  verbose = false
): Promise<T | false> => {
  let fullPrompt = 'GPT-3 Prompt:\n"""\n' + prompt + '\n"""\n';
  fullPrompt += `Output the response to the prompt above in json. ${special_instruction}\n`;
  fullPrompt += "Example output json:\n";
  fullPrompt += '{"output": "' + example_output + '"}';

  if (verbose || DEBUG_LLM) {
    console.log("[LLM] GPT4_safe_generate_response");
    if (verbose) console.log(fullPrompt);
  }

  for (let i = 0; i < repeat; i++) {
    try {
      const curr_gpt_response = (await GPT4_request(fullPrompt)).trim();
      
      if (curr_gpt_response === 'ChatGPT ERROR') {
        console.error(`[LLM ERROR] Attempt ${i + 1}/${repeat} returned error`);
        continue;
      }
      
      // Extract JSON from potential markdown code blocks
      const json_str = extractJSON(curr_gpt_response);
      if (!json_str || !json_str.includes('{')) {
        console.error(`[LLM ERROR] Attempt ${i + 1}/${repeat} - No JSON found in response`);
        continue;
      }
      
      const parsed = JSON.parse(json_str);
      const output = parsed.output;

      if (func_validate && func_validate(output, prompt)) {
        return func_clean_up ? func_clean_up(output, prompt) : output;
      }

      if (verbose) {
        console.log("---- repeat count:", i, output);
      }
    } catch (error: any) {
      console.error(`[LLM ERROR] Attempt ${i + 1}/${repeat} parse error:`, error.message);
    }
  }

  console.error('[LLM ERROR] GPT4_safe_generate_response exhausted retries, returning fail_safe');
  return false;
};

/**
 * Safe generation with ChatGPT equivalent model
 */
export const ChatGPT_safe_generate_response = async <T = string>(
  prompt: string,
  example_output: string,
  special_instruction: string,
  repeat = 3,
  fail_safe_response: any = "error",
  func_validate?: (response: string, prompt?: string) => boolean,
  func_clean_up?: (response: string, prompt?: string) => T,
  verbose = false
): Promise<T | false> => {
  let fullPrompt = '"""\n' + prompt + '\n"""\n';
  fullPrompt += `Output the response to the prompt above in json. ${special_instruction}\n`;
  fullPrompt += "Example output json:\n";
  fullPrompt += '{"output": "' + example_output + '"}';

  if (verbose || DEBUG_LLM) {
    console.log("[LLM] ChatGPT_safe_generate_response");
  }

  for (let i = 0; i < repeat; i++) {
    try {
      const curr_gpt_response = (await ChatGPT_request(fullPrompt)).trim();
      
      if (curr_gpt_response === 'ChatGPT ERROR') {
        console.error(`[LLM ERROR] Attempt ${i + 1}/${repeat} returned error`);
        continue;
      }
      
      // Extract JSON from potential markdown code blocks
      const json_str = extractJSON(curr_gpt_response);
      if (!json_str || !json_str.includes('{')) {
        console.error(`[LLM ERROR] Attempt ${i + 1}/${repeat} - No JSON found in response`);
        continue;
      }
      
      const parsed = JSON.parse(json_str);
      const output = parsed.output;

      if (func_validate && func_validate(output, prompt)) {
        return func_clean_up ? func_clean_up(output, prompt) : output;
      }

      if (verbose) {
        console.log("---- repeat count:", i, output);
      }
    } catch (error: any) {
      console.error(`[LLM ERROR] Attempt ${i + 1}/${repeat} parse error:`, error.message);
    }
  }

  console.error('[LLM ERROR] ChatGPT_safe_generate_response exhausted retries, returning fail_safe');
  return false;
};

/**
 * Safe generation with ChatGPT equivalent model (OLD version without JSON wrapping)
 */
export const ChatGPT_safe_generate_response_OLD = async (
  prompt: string,
  repeat = 3,
  fail_safe_response = "error",
  func_validate?: (response: string, prompt?: string) => boolean,
  func_clean_up?: (response: string, prompt?: string) => string,
  verbose = false
): Promise<any> => {
  if (verbose || DEBUG_LLM) {
    console.log("[LLM] ChatGPT_safe_generate_response_OLD");
  }

  for (let i = 0; i < repeat; i++) {
    try {
      const curr_gpt_response = (await ChatGPT_request(prompt)).trim();
      
      if (curr_gpt_response === 'ChatGPT ERROR') {
        console.error(`[LLM ERROR] Attempt ${i + 1}/${repeat} returned error`);
        continue;
      }
      
      if (func_validate && func_validate(curr_gpt_response, prompt)) {
        return func_clean_up ? func_clean_up(curr_gpt_response, prompt) : curr_gpt_response;
      }
      if (verbose) {
        console.log(`---- repeat count: ${i}`);
        console.log(curr_gpt_response);
      }
    } catch (error: any) {
      console.error(`[LLM ERROR] Attempt ${i + 1}/${repeat} error:`, error.message);
    }
  }

  console.log("[LLM] FAIL SAFE TRIGGERED");
  return fail_safe_response;
};

/**
 * Get embeddings using OpenRouter API
 */
export const get_embedding = async (
  text: string,
  model = EMBEDDING_MODEL
): Promise<number[]> => {
  const cleanedText = text.replace(/\n/g, " ");
  const finalText = cleanedText || "this is blank";

  if (DEBUG_LLM) {
    console.log(`[LLM] get_embedding - text length: ${finalText.length}`);
  }

  try {
    const response = await fetchWithTimeout('https://openrouter.ai/api/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        input: finalText
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[LLM ERROR] Embedding API error:', response.status, response.statusText, errorText);
      // Return a zero vector as fallback
      return new Array(1536).fill(0);
    }

    const data = await response.json() as any;
    return data.data?.[0]?.embedding || new Array(1536).fill(0);
  } catch (error: any) {
    console.error('[LLM ERROR] get_embedding failed:', error.message);
    // Return a zero vector as fallback
    return new Array(1536).fill(0);
  }
};

/**
 * Generate prompt by replacing placeholders in template
 */
export const generate_prompt = (
  curr_input: string | string[],
  prompt_template_content: string
): string => {
  let inputs: string[];
  if (typeof curr_input === 'string') {
    inputs = [curr_input];
  } else {
    inputs = curr_input;
  }
  inputs = inputs.map(i => String(i));

  let prompt = prompt_template_content;
  
  for (let count = 0; count < inputs.length; count++) {
    prompt = prompt.replace(`!<INPUT ${count}>!`, inputs[count]);
  }
  
  if (prompt.includes('<commentblockmarker>###</commentblockmarker>')) {
    prompt = prompt.split('<commentblockmarker>###</commentblockmarker>')[1];
  }
  
  return prompt.trim();
};

/**
 * Original GPT request (for compatibility with text-davinci style calls)
 */
export const GPT_request = async (prompt: string, gpt_parameter: GPTParameters): Promise<string> => {
  await tempSleep();
  
  if (DEBUG_LLM) {
    console.log(`[LLM] GPT_request - prompt length: ${prompt.length}`);
  }
  
  try {
    const response = await fetchWithTimeout('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: gpt_parameter.model || DEFAULT_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: gpt_parameter.temperature ?? 0.7,
        max_tokens: gpt_parameter.max_tokens ?? 150,
        top_p: gpt_parameter.top_p ?? 1,
        frequency_penalty: gpt_parameter.frequency_penalty ?? 0,
        presence_penalty: gpt_parameter.presence_penalty ?? 0,
        stop: gpt_parameter.stop
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[LLM ERROR] GPT_request error:', response.status, response.statusText, errorText);
      return 'TOKEN LIMIT EXCEEDED';
    }

    const data = await response.json() as any;
    return data.choices?.[0]?.message?.content || 'TOKEN LIMIT EXCEEDED';
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.error('[LLM ERROR] GPT_request timed out');
    } else {
      console.error('[LLM ERROR] GPT_request failed:', error.message);
    }
    return 'TOKEN LIMIT EXCEEDED';
  }
};

/**
 * Safe generate response with retry logic
 */
export const safe_generate_response = async (
  prompt: string,
  gpt_parameter: GPTParameters,
  repeat = 5,
  fail_safe_response: string | any = "error",
  func_validate?: (response: string, prompt?: string) => boolean,
  func_clean_up?: (response: string, prompt?: string) => any,
  verbose = false
): Promise<any> => {
  if (verbose || DEBUG_LLM) {
    console.log("[LLM] safe_generate_response");
  }

  for (let i = 0; i < repeat; i++) {
    const curr_gpt_response = await GPT_request(prompt, gpt_parameter);
    
    if (curr_gpt_response === 'TOKEN LIMIT EXCEEDED' || curr_gpt_response === 'ChatGPT ERROR') {
      console.error(`[LLM ERROR] Attempt ${i + 1}/${repeat} returned error`);
      continue;
    }
    
    if (func_validate && func_validate(curr_gpt_response, prompt)) {
      return func_clean_up ? func_clean_up(curr_gpt_response, prompt) : curr_gpt_response;
    }
    
    if (verbose) {
      console.log("---- repeat count:", i, curr_gpt_response);
    }
  }
  
  console.error('[LLM ERROR] safe_generate_response exhausted retries, returning fail_safe');
  return fail_safe_response;
};
