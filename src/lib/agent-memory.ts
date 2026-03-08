/**
 * Agent Memory — Persistent object/scene memory + goal tracking across sessions.
 *
 * Stores remembered objects and goals in localStorage.
 * Provides helpers to save, load, search, and format for system prompts.
 */

export interface MemoryEntry {
  name: string;
  description: string;
  timestamp: number;
}

export interface GoalEntry {
  name: string;
  description: string;
  milestones: string[];
  completedMilestones: string[];
  createdAt: number;
  active: boolean;
}

export interface AgentSettings {
  memoryEnabled: boolean;
  proactivityLevel: "off" | "low" | "medium" | "high";
}

const STORAGE_KEY = "agent-zulu-memory";
const GOALS_KEY = "agent-zulu-goals";
const SETTINGS_KEY = "agent-zulu-settings";
const MAX_MEMORIES = 50;
const MAX_GOALS = 20;

// ── Memories ────────────────────────────────────────────────

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
 * Fuzzy search memories by keyword matching on name + description.
 */
export function searchMemories(query: string): MemoryEntry[] {
  const memories = loadMemories();
  if (!query.trim()) return memories.slice(-5);

  const terms = query.toLowerCase().split(/\s+/);
  return memories
    .filter((m) => {
      const text = `${m.name} ${m.description}`.toLowerCase();
      return terms.some((t) => text.includes(t));
    })
    .slice(-5);
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

// ── Goals ───────────────────────────────────────────────────

export function loadGoals(): GoalEntry[] {
  try {
    const raw = localStorage.getItem(GOALS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as GoalEntry[];
  } catch {
    return [];
  }
}

export function saveGoal(name: string, description: string, milestones: string[] = []): void {
  const goals = loadGoals();
  const existing = goals.findIndex((g) => g.name === name);
  const entry: GoalEntry = {
    name,
    description,
    milestones,
    completedMilestones: [],
    createdAt: Date.now(),
    active: true,
  };

  if (existing >= 0) {
    goals[existing] = { ...goals[existing], description, milestones };
  } else {
    goals.push(entry);
    if (goals.length > MAX_GOALS) {
      goals.shift();
    }
  }

  localStorage.setItem(GOALS_KEY, JSON.stringify(goals));
}

export function completeGoalMilestone(goalName: string, milestone: string): void {
  const goals = loadGoals();
  const goal = goals.find((g) => g.name === goalName);
  if (goal && !goal.completedMilestones.includes(milestone)) {
    goal.completedMilestones.push(milestone);
  }
  localStorage.setItem(GOALS_KEY, JSON.stringify(goals));
}

export function clearGoals(): void {
  localStorage.removeItem(GOALS_KEY);
}

export function formatGoalsForPrompt(): string {
  const goals = loadGoals().filter((g) => g.active);
  if (goals.length === 0) return "";

  const items = goals
    .map((g) => {
      const progress = g.milestones.length > 0
        ? ` (${g.completedMilestones.length}/${g.milestones.length} milestones)`
        : "";
      return `- ${g.name}: ${g.description}${progress}`;
    })
    .join("\n");

  return `\n\nThe user has these active goals you should support and check in on:\n${items}\nProactively reference these when relevant.`;
}

// ── Settings ────────────────────────────────────────────────

const DEFAULT_SETTINGS: AgentSettings = {
  memoryEnabled: true,
  proactivityLevel: "medium",
};

export function loadSettings(): AgentSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: Partial<AgentSettings>): void {
  const current = loadSettings();
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...current, ...settings }));
}

export function getProactiveThreshold(level: AgentSettings["proactivityLevel"]): number {
  switch (level) {
    case "off": return 2; // effectively never
    case "low": return 0.9;
    case "medium": return 0.7;
    case "high": return 0.5;
    default: return 0.7;
  }
}
