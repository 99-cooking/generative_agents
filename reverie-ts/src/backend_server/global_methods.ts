/**
 * Author: Joon Sung Park (joonspk@stanford.edu)
 * 
 * File: global_methods.ts
 * Description: Contains utility functions used throughout the project.
 */

import * as fs from 'fs';
import * as path from 'path';
import csv from 'csv-parser';
import { createObjectCsvWriter } from 'csv-writer';

export const create_folder_if_not_there = (curr_path: string): boolean => {
  /**
   * Checks if a folder in the curr_path exists. If it does not exist, creates
   * the folder. 
   * Note that if the curr_path designates a file location, it will operate on 
   * the folder that contains the file. But the function also works even if the 
   * path designates to just a folder. 
   */
  const outfolder_name = curr_path.split("/");
  if (outfolder_name.length !== 1) {
    // This checks if the curr path is a file or a folder. 
    if (outfolder_name[outfolder_name.length - 1].includes(".")) {
      outfolder_name.pop();
    }

    const folder_path = outfolder_name.join("/");
    if (!fs.existsSync(folder_path)) {
      fs.mkdirSync(folder_path, { recursive: true });
      return true;
    }
  }

  return false;
};

export const write_list_of_list_to_csv = (
  curr_list_of_list: any[][],
  outfile: string
): void => {
  /**
   * Writes a list of list to csv. 
   */
  create_folder_if_not_there(outfile);
  
  const csvWriter = createObjectCsvWriter({
    path: outfile,
    header: curr_list_of_list[0].map((_, index) => ({ id: `col${index}`, title: `col${index}` }))
  });

  // Convert array of arrays to array of objects
  const records = curr_list_of_list.map(row => {
    const obj: any = {};
    row.forEach((value, index) => {
      obj[`col${index}`] = value;
    });
    return obj;
  });

  csvWriter.writeRecords(records);
};

export const write_list_to_csv_line = (
  line_list: any[],
  outfile: string
): void => {
  /**
   * Writes one line to a csv file.
   */
  create_folder_if_not_there(outfile);
  
  const fileExists = fs.existsSync(outfile);
  const csvWriter = createObjectCsvWriter({
    path: outfile,
    header: line_list.map((_, index) => ({ id: `col${index}`, title: `col${index}` })),
    append: fileExists
  });

  const record = line_list.reduce((obj: any, value, index) => {
    obj[`col${index}`] = value;
    return obj;
  }, {});

  csvWriter.writeRecords([record]);
};

export const read_file_to_list = (
  curr_file: string,
  header = false,
  strip_trail = true
): Promise<string[][] | [string[], string[][]]> => {
  /**
   * Reads in a csv file to a list of list (async version).
   */
  if (!fs.existsSync(curr_file)) {
    return Promise.resolve(header ? [[], []] : []) as Promise<string[][] | [string[], string[][]]>;
  }

  const results: string[][] = [];
  
  return new Promise((resolve, reject) => {
    fs.createReadStream(curr_file)
      .pipe(csv({ headers: false }))
      .on('data', (data: any) => {
        const row = Object.values(data).map((value: any) => {
          let val = String(value);
          if (strip_trail) {
            val = val.trim();
          }
          return val;
        });
        results.push(row);
      })
      .on('end', () => {
        if (header) {
          const headers = results.length > 0 ? results[0] : [];
          const data = results.length > 0 ? results.slice(1) : [];
          resolve([headers, data]);
        } else {
          resolve(results);
        }
      })
      .on('error', reject);
  });
};

export const read_file_to_list_sync = (
  curr_file: string,
  header = false,
  strip_trail = true
): any[][] | [any[], any[][]] => {
  /**
   * Reads in a csv file to a list of list (synchronous version).
   */
  if (!fs.existsSync(curr_file)) {
    return header ? [[], []] : [];
  }

  const content = fs.readFileSync(curr_file, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim() !== '');
  
  const results: any[][] = [];
  
  for (const line of lines) {
    // Simple CSV parsing - handles quoted values and commas
    const row: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        row.push(strip_trail ? current.trim() : current);
        current = '';
      } else {
        current += char;
      }
    }
    
    // Don't forget the last value
    row.push(strip_trail ? current.trim() : current);
    results.push(row);
  }
  
  if (header) {
    const headers = results.length > 0 ? results[0] : [];
    const data = results.length > 0 ? results.slice(1) : [];
    return [headers, data];
  } else {
    return results;
  }
};

export const read_file_to_set = async (
  curr_file: string,
  col = 0
): Promise<Set<string>> => {
  /**
   * Reads in a "single column" of a csv file to a set.
   */
  const analysis_set = new Set<string>();
  
  if (!fs.existsSync(curr_file)) {
    return analysis_set;
  }

  const data = await read_file_to_list(curr_file, false, true) as any[][];
  
  for (const row of data) {
    if (row.length > col) {
      analysis_set.add(row[col]);
    }
  }
  
  return analysis_set;
};

export const get_row_len = async (curr_file: string): Promise<number | false> => {
  /**
   * Get the number of rows in a csv file
   */
  try {
    const data = await read_file_to_list(curr_file, false, true) as any[][];
    return data.length;
  } catch {
    return false;
  }
};

export const check_if_file_exists = (curr_file: string): boolean => {
  /**
   * Checks if a file exists
   */
  try {
    fs.accessSync(curr_file);
    return true;
  } catch {
    return false;
  }
};

export const find_filenames = (
  path_to_dir: string,
  suffix = ".csv"
): string[] => {
  /**
   * Given a directory, find all files that ends with the provided suffix and 
   * returns their paths.  
   */
  try {
    const files = fs.readdirSync(path_to_dir);
    return files
      .filter(filename => filename.endsWith(suffix))
      .map(filename => path.join(path_to_dir, filename));
  } catch {
    return [];
  }
};

export const average = (list_of_val: number[]): number => {
  /**
   * Finds the average of the numbers in a list.
   */
  if (list_of_val.length === 0) return 0;
  return list_of_val.reduce((sum, val) => sum + val, 0) / list_of_val.length;
};

export const std = (list_of_val: number[]): number => {
  /**
   * Finds the std of the numbers in a list.
   */
  if (list_of_val.length === 0) return 0;
  const avg = average(list_of_val);
  const variance = list_of_val.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / list_of_val.length;
  return Math.sqrt(variance);
};

export const copyanything = (src: string, dst: string): void => {
  /**
   * Copy over everything in the src folder to dst folder.
   */
  const copyRecursiveSync = (source: string, target: string) => {
    const stats = fs.statSync(source);
    
    if (stats.isDirectory()) {
      if (!fs.existsSync(target)) {
        fs.mkdirSync(target, { recursive: true });
      }
      
      const files = fs.readdirSync(source);
      files.forEach(file => {
        copyRecursiveSync(path.join(source, file), path.join(target, file));
      });
    } else {
      fs.copyFileSync(source, target);
    }
  };

  copyRecursiveSync(src, dst);
};