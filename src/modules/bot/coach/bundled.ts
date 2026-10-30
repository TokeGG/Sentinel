// Small bundled practice set (written for this repo). `answer` is for the sample input, so a run can be checked.
import type { Puzzle } from "./puzzles.ts";

export interface Practice extends Puzzle { topics: string[]; answer: string }
const p = (id: string, title: string, statement: string, input: string, answer: string, topics: string[]): Practice =>
  ({ key: `practice:${id}`, source: "practice", title, statement, input, answer, topics });

export const PRACTICE: Practice[] = [
  p("sum-lines", "Sum of lines", "Each line of the input holds one integer. Print the sum of all of them.", "3\n-1\n10\n4\n", "16", ["loops", "parsing"]),
  p("max-group", "Heaviest group", "The input is groups of integers separated by blank lines. Print the largest group total.", "1\n2\n\n10\n\n4\n4\n", "10", ["parsing", "grouping"]),
  p("pairs", "Pair that sums to 50", "Find the two numbers in the input that add up to 50 and print their product.", "12\n7\n38\n20\n", "456", ["hash sets", "search"]),
  p("brackets", "Balanced brackets", "Count how many input lines have fully balanced (), [] and {} brackets. Print the count.", "([]){}\n([)]\n((\n{[()]}\n", "2", ["stacks", "strings"]),
  p("grid-steps", "Shortest grid path", "The input is a grid: S start, E end, # wall, . open. Moving up/down/left/right costs 1. Print the fewest steps from S to E.", "S.#\n..#\n#.E\n", "4", ["BFS", "grids"]),
  p("word-freq", "Most common word", "Print the most common word in the input (lowercase, letters only). Ties: the alphabetically first.", "The cat and the hat. A cat!\n", "cat", ["dictionaries", "strings"]),
];

export const practiceByKey = (key: string) => PRACTICE.find((x) => x.key === key) ?? null;
/** The practice puzzle for a calendar day: rotates through the set. */
export const practiceForDay = (dayIndex: number) => PRACTICE[((dayIndex % PRACTICE.length) + PRACTICE.length) % PRACTICE.length];
