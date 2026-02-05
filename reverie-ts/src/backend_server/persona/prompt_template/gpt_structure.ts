/**
 * Author: Joon Sung Park (joonspk@stanford.edu)
 * 
 * File: gpt_structure.ts
 * Description: Wrapper functions for calling OpenRouter API (replacing OpenAI).
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

/**
 * Sleep for specified milliseconds
 */
export const tempSleep = (seconds = 0.1): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, seconds * 1000));
};

/**
 * Make a single request to OpenRouter chat completion API
 */
export const ChatGPT_single_request = async (prompt: string): Promise<string> => {
  await tempSleep();
  
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'deepseek/deepseek-v3.2',
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!response.ok) {
    console.error('OpenRouter API error:', response.statusText);
    return 'ChatGPT ERROR';
  }

  const data = await response.json() as any;
  return data.choices[0].message.content;
};

/**
 * Make a request to OpenRouter chat completion API (GPT-4 equivalent)
 */
export const GPT4_request = async (prompt: string): Promise<string> => {
  await tempSleep();
  
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek/deepseek-v3.2',
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      console.error('OpenRouter API error:', response.statusText);
      return 'ChatGPT ERROR';
    }

    const data = await response.json() as any;
    return data.choices[0].message.content;
  } catch (error) {
    console.error('ChatGPT ERROR:', error);
    return 'ChatGPT ERROR';
  }
};

/**
 * Make a request to OpenRouter chat completion API (GPT-3.5 equivalent)
 */
export const ChatGPT_request = async (prompt: string): Promise<string> => {
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek/deepseek-v3.2',
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      console.error('OpenRouter API error:', response.statusText);
      return 'ChatGPT ERROR';
    }

    const data = await response.json() as any;
    return data.choices[0].message.content;
  } catch (error) {
    console.error('ChatGPT ERROR:', error);
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

  if (verbose) {
    console.log("CHAT GPT PROMPT");
    console.log(fullPrompt);
  }

  for (let i = 0; i < repeat; i++) {
    try {
      const curr_gpt_response = (await GPT4_request(fullPrompt)).trim();
      const end_index = curr_gpt_response.lastIndexOf('}') + 1;
      const json_str = curr_gpt_response.substring(0, end_index);
      const parsed = JSON.parse(json_str);
      const output = parsed.output;

      if (func_validate && func_validate(output, prompt)) {
        return func_clean_up ? func_clean_up(output, prompt) : output;
      }

      if (verbose) {
        console.log("---- repeat count: \n", i, output);
        console.log(output);
        console.log("~~~~");
      }
    } catch (error) {
      // Continue on error
    }
  }

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

  if (verbose) {
    console.log("CHAT GPT PROMPT");
    console.log(fullPrompt);
  }

  for (let i = 0; i < repeat; i++) {
    try {
      const curr_gpt_response = (await ChatGPT_request(fullPrompt)).trim();
      const end_index = curr_gpt_response.lastIndexOf('}') + 1;
      const json_str = curr_gpt_response.substring(0, end_index);
      const parsed = JSON.parse(json_str);
      const output = parsed.output;

      if (func_validate && func_validate(output, prompt)) {
        return func_clean_up ? func_clean_up(output, prompt) : output;
      }

      if (verbose) {
        console.log("---- repeat count: \n", i, output);
        console.log(output);
        console.log("~~~~");
      }
    } catch (error) {
      // Continue on error
    }
  }

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
  if (verbose) {
    console.log("CHAT GPT PROMPT");
    console.log(prompt);
  }

  for (let i = 0; i < repeat; i++) {
    try {
      const curr_gpt_response = (await ChatGPT_request(prompt)).trim();
      if (func_validate && func_validate(curr_gpt_response, prompt)) {
        return func_clean_up ? func_clean_up(curr_gpt_response, prompt) : curr_gpt_response;
      }
      if (verbose) {
        console.log(`---- repeat count: ${i}`);
        console.log(curr_gpt_response);
        console.log("~~~~");
      }
    } catch (error) {
      // Continue on error
    }
  }

  console.log("FAIL SAFE TRIGGERED");
  return fail_safe_response;
};

/**
 * Get embeddings using OpenRouter API
 */
export const get_embedding = async (
  text: string,
  model = "openai/text-embedding-ada-002"
): Promise<number[]> => {
  const cleanedText = text.replace(/\n/g, " ");
  const finalText = cleanedText || "this is blank";

  const response = await fetch('https://openrouter.ai/api/v1/embeddings', {
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
    console.error('OpenRouter Embedding API error:', response.statusText);
    throw new Error('Failed to get embedding');
  }

  const data = await response.json() as any;
  return data.data[0].embedding;
};

/**
 * Generate prompt by replacing placeholders in template
 * Note: In this TypeScript version, we expect the prompt template content to be passed in
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
 * This now uses chat completion API with appropriate model
 */
export const GPT_request = async (prompt: string, gpt_parameter: GPTParameters): Promise<string> => {
  await tempSleep();
  
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: gpt_parameter.model || 'deepseek/deepseek-v3.2',
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
      console.error('OpenRouter API error:', response.statusText);
      return 'TOKEN LIMIT EXCEEDED';
    }

    const data = await response.json() as any;
    return data.choices[0].message.content;
  } catch (error) {
    console.error('TOKEN LIMIT EXCEEDED');
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
  if (verbose) {
    console.log(prompt);
  }

  for (let i = 0; i < repeat; i++) {
    const curr_gpt_response = await GPT_request(prompt, gpt_parameter);
    
    if (func_validate && func_validate(curr_gpt_response, prompt)) {
      return func_clean_up ? func_clean_up(curr_gpt_response, prompt) : curr_gpt_response;
    }
    
    if (verbose) {
      console.log("---- repeat count: ", i, curr_gpt_response);
      console.log(curr_gpt_response);
      console.log("~~~~");
    }
  }
  
  return fail_safe_response;
};
