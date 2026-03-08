/**
 * Agent Memory — Persistent object/scene memory across sessions.
 *
 * Stores remembered objects in localStorage keyed by "agent-zulu-memory".
 * Provides helpers to save, load, and format memories for the system prompt.
 */

export interface MemoryEntry {
  name: string;
  description: string;
  timestamp: number;
}

const STORAGE_KEY = "agent-zulu-memory";
const MAX_MEMORIES = 50;

export function loadMemories(): MemoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const entries: MemoryEntry[] = JSON.parse(raw);
    return entries.slice(-MAX_MEMORIES);
  } catch {
    return [];
  }
}

export function saveMemory(name: string, description: string): void {
  const memories = loadMemories();
  // Update existing or append
  const existing = memories.findIndex((m) => m.name === name);
  const entry: MemoryEntry = { name, description, timestamp: Date.now() };

  if (existing >= 0) {
    memories[existing] = entry;
  } else {
    memories.push(entry);
    if (memories.length > MAX_MEMORIES) {
      memories.shift();
    }
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(memories));
}

export function clearMemories(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Format memories as a context string for injection into the system prompt.
 */
export function formatMemoriesForPrompt(): string {
  const memories = loadMemories();
  if (memories.length === 0) return "";

  const items = memories
    .map((m) => `- ${m.name}: ${m.description}`)
    .join("\n");

  return `\n\nYou have previously observed and remembered these items from the user's environment:\n${items}\nReference these naturally when you see them again.`;
}
