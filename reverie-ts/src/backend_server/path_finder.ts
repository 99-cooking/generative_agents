/**
 * Author: Joon Sung Park (joonspk@stanford.edu)
 * 
 * File: path_finder.ts
 * Description: Implements various path finding functions for generative agents.
 */

// Using native Math instead of mathjs
const math = Math;

/**
 * Print maze for debugging
 */
const print_maze = (maze: any[][]): void => {
  for (const row of maze) {
    for (const item of row) {
      process.stdout.write(String(item));
    }
    console.log();
  }
};

/**
 * Path finder v2 using wave propagation algorithm
 */
const path_finder_v2 = (
  a: number[][],
  start: [number, number],
  end: [number, number],
  collision_block_char: string | number,
  verbose = false
): [number, number][] => {
  const make_step = (m: number[][], k: number): void => {
    for (let i = 0; i < m.length; i++) {
      for (let j = 0; j < m[i].length; j++) {
        if (m[i][j] === k) {
          if (i > 0 && m[i - 1][j] === 0 && a[i - 1][j] === 0) {
            m[i - 1][j] = k + 1;
          }
          if (j > 0 && m[i][j - 1] === 0 && a[i][j - 1] === 0) {
            m[i][j - 1] = k + 1;
          }
          if (i < m.length - 1 && m[i + 1][j] === 0 && a[i + 1][j] === 0) {
            m[i + 1][j] = k + 1;
          }
          if (j < m[i].length - 1 && m[i][j + 1] === 0 && a[i][j + 1] === 0) {
            m[i][j + 1] = k + 1;
          }
        }
      }
    }
  };

  // Convert maze to 0/1 representation
  const new_maze: number[][] = [];
  for (const row of a) {
    const new_row: number[] = [];
    for (const j of row) {
      if (j === collision_block_char) {
        new_row.push(1);
      } else {
        new_row.push(0);
      }
    }
    new_maze.push(new_row);
  }
  a = new_maze;

  // Initialize distance matrix
  const m: number[][] = [];
  for (let i = 0; i < a.length; i++) {
    m.push([]);
    for (let j = 0; j < a[i].length; j++) {
      m[i].push(0);
    }
  }
  const [i, j] = start;
  m[i][j] = 1;

  let k = 0;
  let except_handle = 150;
  while (m[end[0]][end[1]] === 0) {
    k += 1;
    make_step(m, k);

    if (except_handle === 0) {
      break;
    }
    except_handle -= 1;
  }

  // Backtrack to find path
  let [ci, cj] = end;
  k = m[ci][cj];
  const the_path: [number, number][] = [[ci, cj]];
  while (k > 1) {
    if (ci > 0 && m[ci - 1][cj] === k - 1) {
      ci = ci - 1;
      cj = cj;
      the_path.push([ci, cj]);
      k -= 1;
    } else if (cj > 0 && m[ci][cj - 1] === k - 1) {
      ci = ci;
      cj = cj - 1;
      the_path.push([ci, cj]);
      k -= 1;
    } else if (ci < m.length - 1 && m[ci + 1][cj] === k - 1) {
      ci = ci + 1;
      cj = cj;
      the_path.push([ci, cj]);
      k -= 1;
    } else if (cj < m[ci].length - 1 && m[ci][cj + 1] === k - 1) {
      ci = ci;
      cj = cj + 1;
      the_path.push([ci, cj]);
      k -= 1;
    }
  }

  the_path.reverse();
  return the_path;
};

/**
 * Main path finder function
 */
export const path_finder = (
  maze: number[][],
  start: [number, number],
  end: [number, number],
  collision_block_char: string | number,
  verbose = false
): [number, number][] => {
  // EMERGENCY PATCH - swap coordinates
  const start_swapped: [number, number] = [start[1], start[0]];
  const end_swapped: [number, number] = [end[1], end[0]];

  const path = path_finder_v2(maze, start_swapped, end_swapped, collision_block_char, verbose);

  // Swap back coordinates
  const new_path: [number, number][] = [];
  for (const i of path) {
    new_path.push([i[1], i[0]]);
  }

  return new_path;
};

/**
 * Find the closest coordinate from a list of target coordinates
 */
export const closest_coordinate = (
  curr_coordinate: [number, number],
  target_coordinates: [number, number][]
): [number, number] => {
  let min_dist: number | null = null;
  let closest_coordinate: [number, number] | null = null;

  for (const coordinate of target_coordinates) {
    const dist = Math.sqrt(
      Math.pow(coordinate[0] - curr_coordinate[0], 2) +
      Math.pow(coordinate[1] - curr_coordinate[1], 2)
    );

    if (!closest_coordinate) {
      min_dist = dist;
      closest_coordinate = coordinate;
    } else if (min_dist! > dist) {
      min_dist = dist;
      closest_coordinate = coordinate;
    }
  }

  return closest_coordinate!;
};

/**
 * Path finder 2 - finds path to a position adjacent to target
 */
export const path_finder_2 = (
  maze: number[][],
  start: [number, number],
  end: [number, number],
  collision_block_char: string | number,
  verbose = false
): [number, number][] => {
  const start_list = [start[0], start[1]];
  const end_list = [end[0], end[1]];

  const t_top: [number, number] = [end_list[0], end_list[1] + 1];
  const t_bottom: [number, number] = [end_list[0], end_list[1] - 1];
  const t_left: [number, number] = [end_list[0] - 1, end_list[1]];
  const t_right: [number, number] = [end_list[0] + 1, end_list[1]];
  const pot_target_coordinates = [t_top, t_bottom, t_left, t_right];

  const maze_width = maze[0].length;
  const maze_height = maze.length;
  const target_coordinates: [number, number][] = [];

  for (const coordinate of pot_target_coordinates) {
    if (coordinate[0] >= 0 && coordinate[0] < maze_width &&
        coordinate[1] >= 0 && coordinate[1] < maze_height) {
      target_coordinates.push(coordinate);
    }
  }

  const target_coordinate = closest_coordinate(start_list as [number, number], target_coordinates);
  const path = path_finder(maze, start, target_coordinate, collision_block_char, verbose);

  return path;
};

/**
 * Path finder 3 - finds meeting point path for two personas
 */
export const path_finder_3 = (
  maze: number[][],
  start: [number, number],
  end: [number, number],
  collision_block_char: string | number,
  verbose = false
): [number, number][][] | [] => {
  const curr_path = path_finder(maze, start, end, collision_block_char, verbose);

  if (curr_path.length <= 2) {
    return [];
  }

  const a_path = curr_path.slice(0, Math.floor(curr_path.length / 2));
  const b_path = curr_path.slice(Math.floor(curr_path.length / 2) - 1);
  b_path.reverse();

  console.log(a_path);
  console.log(b_path);

  return [a_path, b_path];
};

// Default collision block ID
export const collision_block_id = '#';
