// Persistent "last seen" tracker. state.json lives in the repo so GitHub
// Actions can commit it back and remember across runs. Shape:
// { expressEntry: { lastDrawNumber: 123 }, news: { seenIds: [...] }, pnp: {...} }

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(__dirname, "..", "state.json");

export async function readState() {
  try {
    const raw = await fs.readFile(FILE, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === "ENOENT") return {};
    throw err;
  }
}

export async function writeState(state) {
  await fs.writeFile(FILE, JSON.stringify(state, null, 2) + "\n", "utf8");
}

// Cap a "seen IDs" list so state.json doesn't grow unbounded.
export function capSeen(arr, max = 200) {
  return arr.slice(-max);
}
