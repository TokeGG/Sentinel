// Offline Practice CTF: beginner puzzles built and checked entirely in the app from a seed, answer flag{...}.
// Nothing touches a network or any external system. The model only writes story/hints and explains afterwards.
import type { Difficulty } from "./gen.ts";
import type { Puzzle } from "./puzzles.ts";
import { b64, shuffle, caesar, hex, int, pick, rng, rot13, sha256Hex, vigenere, xorHex } from "./ctfCipher.ts";

export const CTF_CATEGORIES = ["encoding", "hashing", "forensics", "logs", "logic"] as const;
export type CtfCategory = (typeof CTF_CATEGORIES)[number];
export interface CtfGen { title: string; category: CtfCategory; difficulty: Difficulty; body: string; flag: string; concept: string }

const WORDS = ["falcon", "orbit", "maple", "cobalt", "ember", "quartz", "harbor", "lantern", "tundra", "velvet", "nimbus", "pixel"];
const flagOf = (r: () => number) => `flag{${pick(r, WORDS)}_${pick(r, WORDS)}_${int(r, 10, 99)}}`;

function encoding(r: () => number, d: Difficulty, flag: string): Omit<CtfGen, "category" | "difficulty"> {
  const easy = [["Base64", b64(flag)], ["Hex", hex(flag)], ["ROT13", rot13(flag)]];
  const k = int(r, 1, 25), key = pick(r, ["key", "cat", "lab", "sun"]), vk = pick(r, WORDS).slice(0, 4);
  const mid = [[`Caesar (unknown shift)`, caesar(flag, k)], [`XOR with the 3-letter key "${key}", shown as hex`, xorHex(flag, key)]];
  const hard = [[`Vigenere (the key is one of: ${WORDS.slice(0, 6).map((w) => w.slice(0, 4)).join(", ")}, ${vk})`, vigenere(flag, vk)], [`Base64 of hex`, b64(hex(flag))]];
  const [how, data] = pick(r, d === "easy" ? easy : d === "medium" ? mid : hard);
  return { title: `Encoded message (${how.split(" ")[0]})`, body: `This was encoded with ${how}. Decode it:\n\n${data}`, flag, concept: `${how.split(" (")[0]} is reversible encoding or a classic cipher, not real protection.` };
}
async function hashing(r: () => number, d: Difficulty) {
  if (d === "easy") {
    const [name, len] = pick(r, [["md5", 32], ["sha1", 40], ["sha256", 64]] as const);
    const h = Array.from({ length: len }, () => "0123456789abcdef"[int(r, 0, 15)]).join("");
    return { title: "Name that hash", body: `What hash type has this length/shape? Answer as flag{<type>} (md5, sha1 or sha256).\n\n${h}`, flag: `flag{${name}}`, concept: "Hash types can often be guessed from their length: 32 hex = MD5, 40 = SHA-1, 64 = SHA-256." };
  }
  const list = shuffle(r, WORDS).slice(0, d === "medium" ? 6 : 12), word = pick(r, list);
  return { title: "Crack it with a wordlist", body: `This SHA-256 hash is one word from the list. Answer flag{<word>}.\n\n${await sha256Hex(word)}\n\nWordlist:\n${list.join("\n")}`, flag: `flag{${word}}`, concept: "Hashes are one-way, but a weak secret falls to hashing every candidate (a dictionary attack). Salting and slow hashes defend." };
}
function forensics(r: () => number, d: Difficulty, flag: string) {
  if (d === "easy") return { title: "Hidden in plain sight", body: `A note's metadata:\n\nAuthor: ${pick(r, WORDS)}\nCreated: 2026-0${int(r, 1, 9)}-1${int(r, 0, 9)}\nComment: ${b64(flag)}\nPages: ${int(r, 1, 9)}\n\nOne field hides the flag.`, flag, concept: "Metadata (EXIF, document properties) often leaks more than the content." };
  if (d === "medium") {
    const [ext, magic] = pick(r, [["png", "25 50 44 46 2d"], ["jpg", "50 4b 03 04"], ["pdf", "89 50 4e 47"]] as const);
    const real = { "25 50 44 46 2d": "pdf", "50 4b 03 04": "zip", "89 50 4e 47": "png" }[magic];
    return { title: "Wrong file signature", body: `A file named evidence.${ext} starts with the bytes:\n\n${magic} ...\n\nWhat type is it really? Answer flag{<type>}.`, flag: `flag{${real}}`, concept: "File type comes from magic bytes at the start, not the extension." };
  }
  const lines = Array.from({ length: flag.length }, (_, i) => `${flag[i]}${pick(r, WORDS).slice(1)} ${pick(r, WORDS)} ${pick(r, WORDS)}`);
  return { title: "Acrostic", body: `A recovered text blob:\n\n${lines.join("\n")}`, flag, concept: "Steganography hides data in plain sight: first letters, whitespace, low bits." };
}
function logs(r: () => number, d: Difficulty) {
  const n = d === "easy" ? 8 : d === "medium" ? 15 : 25, bad = int(r, 2, n - 2), ip = `10.0.${int(r, 1, 9)}.${int(r, 2, 250)}`;
  const lines = Array.from({ length: n }, (_, i) => i === bad
    ? `12:0${i % 10}:${10 + i} 203.0.113.${int(r, 2, 250)} POST /login 200 user=admin attempts=${int(r, 40, 90)}`
    : `12:0${i % 10}:${10 + i} ${ip} GET /${pick(r, WORDS)} 200`);
  return { title: "Find the suspicious line", body: `Which line number (1-based) shows the suspicious login? Answer flag{<number>}.\n\n${lines.join("\n")}`, flag: `flag{${bad + 1}}`, concept: "Log analysis: look for outliers (new source IP, sensitive path, unusual counts)." };
}
function logic(r: () => number, d: Difficulty) {
  const a = int(r, 2, 9), b = int(r, 2, d === "hard" ? 40 : 12), seq = Array.from({ length: 5 }, (_, i) => a + b * i * (d === "easy" ? 1 : i));
  const next = a + b * 5 * (d === "easy" ? 1 : 5);
  return { title: "Next in the sequence", body: `Find the next number and answer flag{<number>}:\n\n${seq.join(", ")}, ?`, flag: `flag{${next}}`, concept: "Pattern spotting: look at differences between terms (and differences of differences)." };
}

/** Deterministic: the same seed, category and difficulty always give the same puzzle and flag. */
export async function makeCtf(seed: number, category: CtfCategory, difficulty: Difficulty): Promise<CtfGen> {
  const r = rng(seed), flag = flagOf(r);
  const g = category === "encoding" ? encoding(r, difficulty, flag) : category === "hashing" ? await hashing(r, difficulty)
    : category === "forensics" ? forensics(r, difficulty, flag) : category === "logs" ? logs(r, difficulty) : logic(r, difficulty);
  return { ...g, category, difficulty };
}
export const ctfPuzzle = (g: CtfGen, seed: number): Puzzle => ({ key: `ctfgen:${g.category}:${g.difficulty}:${seed}`, source: "ctfgen", title: g.title, statement: g.body, input: JSON.stringify({ flag: g.flag, concept: g.concept, category: g.category }) });
export const flagOk = (guess: string, flag: string) => guess.trim().toLowerCase() === flag.toLowerCase();
