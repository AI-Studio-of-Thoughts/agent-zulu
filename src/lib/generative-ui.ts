/**
 * Generative UI Engine — Adapts interface based on context signals.
 *
 * Signals: time of day, detected mood, conversation topic.
 * Outputs: theme tokens, suggested actions, ambient label.
 */

export type TimePhase = "dawn" | "morning" | "afternoon" | "evening" | "night";
export type DetectedMood = "neutral" | "focused" | "curious" | "stressed" | "joyful" | "reflective";
export type ConversationTopic = "general" | "health" | "productivity" | "creative" | "heritage" | "technical" | "social";

export interface GenerativeUIState {
  timePhase: TimePhase;
  mood: DetectedMood;
  topic: ConversationTopic;
  suggestedActions: SuggestedAction[];
  ambientLabel: string;
  ambientLabelEn: string;
}

export interface SuggestedAction {
  id: string;
  label: string;
  icon: string; // lucide icon name
  prompt: string; // what to say/do when tapped
}

// ── Time Detection ──────────────────────────────────────────

export function detectTimePhase(): TimePhase {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 7) return "dawn";
  if (hour >= 7 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}

// ── Mood Detection from transcript patterns ─────────────────

const MOOD_KEYWORDS: Record<DetectedMood, string[]> = {
  focused: ["deadline", "urgent", "task", "finish", "complete", "work", "project", "code", "build"],
  curious: ["what", "how", "why", "explain", "tell me", "wonder", "learn", "teach", "show"],
  stressed: ["help", "problem", "issue", "broken", "stuck", "frustrat", "anxious", "worry", "overwhelm"],
  joyful: ["great", "awesome", "amazing", "love", "happy", "thank", "perfect", "beautiful", "excellent"],
  reflective: ["think", "remember", "goal", "future", "past", "meaning", "purpose", "journey", "grow"],
  neutral: [],
};

export function detectMood(recentTranscripts: string[]): DetectedMood {
  if (recentTranscripts.length === 0) return "neutral";
  
  const text = recentTranscripts.slice(-5).join(" ").toLowerCase();
  const scores: Record<DetectedMood, number> = {
    neutral: 0, focused: 0, curious: 0, stressed: 0, joyful: 0, reflective: 0,
  };

  for (const [mood, keywords] of Object.entries(MOOD_KEYWORDS)) {
    for (const kw of keywords) {
      if (text.includes(kw)) scores[mood as DetectedMood]++;
    }
  }

  const best = Object.entries(scores).reduce((a, b) => (b[1] > a[1] ? b : a));
  return best[1] > 0 ? (best[0] as DetectedMood) : "neutral";
}

// ── Topic Detection ─────────────────────────────────────────

const TOPIC_KEYWORDS: Record<ConversationTopic, string[]> = {
  health: ["health", "heart", "sleep", "exercise", "diet", "wellness", "medical", "body", "vitals", "stress"],
  productivity: ["schedule", "meeting", "email", "task", "calendar", "deadline", "remind", "plan", "organize"],
  creative: ["design", "art", "music", "write", "story", "create", "imagine", "draw", "paint", "compose"],
  heritage: ["zulu", "isizulu", "culture", "tradition", "proverb", "ubuntu", "ancestor", "heritage", "africa"],
  technical: ["code", "build", "debug", "api", "deploy", "server", "database", "algorithm", "function"],
  social: ["call", "message", "friend", "family", "meet", "chat", "connect", "share", "community"],
  general: [],
};

export function detectTopic(recentTranscripts: string[]): ConversationTopic {
  if (recentTranscripts.length === 0) return "general";

  const text = recentTranscripts.slice(-8).join(" ").toLowerCase();
  const scores: Record<ConversationTopic, number> = {
    general: 0, health: 0, productivity: 0, creative: 0, heritage: 0, technical: 0, social: 0,
  };

  for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    for (const kw of keywords) {
      if (text.includes(kw)) scores[topic as ConversationTopic]++;
    }
  }

  const best = Object.entries(scores).reduce((a, b) => (b[1] > a[1] ? b : a));
  return best[1] > 0 ? (best[0] as ConversationTopic) : "general";
}

// ── Theme Tokens per Context ────────────────────────────────

export interface ThemeTokens {
  primary: string;       // HSL values
  accent: string;
  glowPrimary: string;
  glowAccent: string;
  gridColor: string;     // for background dot grid
  backgroundShift: string; // subtle bg tint
}

const TIME_THEMES: Record<TimePhase, ThemeTokens> = {
  dawn: {
    primary: "30 90% 55%",
    accent: "280 60% 55%",
    glowPrimary: "30 90% 55%",
    glowAccent: "280 60% 55%",
    gridColor: "30 90% 55%",
    backgroundShift: "25 20% 6%",
  },
  morning: {
    primary: "185 100% 50%",
    accent: "160 70% 50%",
    glowPrimary: "185 100% 50%",
    glowAccent: "160 70% 50%",
    gridColor: "185 100% 50%",
    backgroundShift: "200 25% 5%",
  },
  afternoon: {
    primary: "45 95% 55%",
    accent: "200 80% 55%",
    glowPrimary: "45 95% 55%",
    glowAccent: "200 80% 55%",
    gridColor: "45 95% 55%",
    backgroundShift: "40 15% 6%",
  },
  evening: {
    primary: "15 85% 55%",
    accent: "260 80% 60%",
    glowPrimary: "15 85% 55%",
    glowAccent: "260 80% 60%",
    gridColor: "15 85% 55%",
    backgroundShift: "10 20% 5%",
  },
  night: {
    primary: "240 70% 65%",
    accent: "280 80% 55%",
    glowPrimary: "240 70% 65%",
    glowAccent: "280 80% 55%",
    gridColor: "240 70% 65%",
    backgroundShift: "240 30% 4%",
  },
};

// Mood overlays — blend on top of time theme
const MOOD_TINTS: Record<DetectedMood, Partial<ThemeTokens>> = {
  neutral: {},
  focused: { accent: "200 90% 50%" },
  curious: { primary: "170 90% 50%", glowPrimary: "170 90% 50%" },
  stressed: { accent: "0 70% 55%", glowAccent: "0 70% 55%" },
  joyful: { primary: "50 95% 55%", glowPrimary: "50 95% 55%" },
  reflective: { accent: "270 70% 60%", glowAccent: "270 70% 60%" },
};

export function getThemeTokens(time: TimePhase, mood: DetectedMood): ThemeTokens {
  const base = { ...TIME_THEMES[time] };
  const tint = MOOD_TINTS[mood];
  return { ...base, ...tint };
}

// ── Suggested Actions per Context ───────────────────────────

const TIME_ACTIONS: Record<TimePhase, SuggestedAction[]> = {
  dawn: [
    { id: "dawn-1", label: "Morning goals", icon: "Sun", prompt: "What are my goals for today?" },
    { id: "dawn-2", label: "Meditation", icon: "Brain", prompt: "Guide me through a 2-minute morning meditation" },
  ],
  morning: [
    { id: "morn-1", label: "Plan my day", icon: "CalendarDays", prompt: "Help me plan my day" },
    { id: "morn-2", label: "Check weather", icon: "Cloud", prompt: "What's the weather like today?" },
  ],
  afternoon: [
    { id: "aft-1", label: "Focus session", icon: "Target", prompt: "Start a focus session for my top task" },
    { id: "aft-2", label: "Quick review", icon: "ClipboardCheck", prompt: "Review my progress today" },
  ],
  evening: [
    { id: "eve-1", label: "Daily reflection", icon: "BookOpen", prompt: "Let's reflect on my day" },
    { id: "eve-2", label: "Wind down", icon: "Moon", prompt: "Suggest a relaxing evening activity" },
  ],
  night: [
    { id: "nit-1", label: "Sleep prep", icon: "Moon", prompt: "Help me prepare for sleep" },
    { id: "nit-2", label: "Tomorrow's plan", icon: "Sunrise", prompt: "What should I focus on tomorrow?" },
  ],
};

const TOPIC_ACTIONS: Record<ConversationTopic, SuggestedAction[]> = {
  general: [],
  health: [
    { id: "hlth-1", label: "Wellness check", icon: "Heart", prompt: "How am I doing health-wise?" },
  ],
  productivity: [
    { id: "prod-1", label: "Next task", icon: "ListChecks", prompt: "What's my next priority task?" },
  ],
  creative: [
    { id: "crea-1", label: "Inspire me", icon: "Sparkles", prompt: "Give me creative inspiration" },
  ],
  heritage: [
    { id: "heri-1", label: "Isaga", icon: "Quote", prompt: "Share a Zulu proverb relevant to now" },
  ],
  technical: [
    { id: "tech-1", label: "Debug help", icon: "Bug", prompt: "Help me debug this issue" },
  ],
  social: [
    { id: "soc-1", label: "Draft message", icon: "MessageSquare", prompt: "Help me draft a message" },
  ],
};

const AMBIENT_LABELS: Record<TimePhase, { zu: string; en: string }> = {
  dawn: { zu: "Ukusa — isikhathi sokuvuka", en: "Dawn — time of awakening" },
  morning: { zu: "Ekuseni — usuku olusha", en: "Morning — a new day" },
  afternoon: { zu: "Emini — isikhathi somsebenzi", en: "Afternoon — time of work" },
  evening: { zu: "Ntambama — ukuphumula", en: "Evening — time of rest" },
  night: { zu: "Ebusuku — amaphupho", en: "Night — time of dreams" },
};

export function getSuggestedActions(time: TimePhase, topic: ConversationTopic): SuggestedAction[] {
  const actions = [...TIME_ACTIONS[time]];
  const topicActions = TOPIC_ACTIONS[topic];
  if (topicActions.length > 0) {
    actions.push(topicActions[0]);
  }
  return actions.slice(0, 3); // max 3
}

export function getAmbientLabel(time: TimePhase): { zu: string; en: string } {
  return AMBIENT_LABELS[time];
}

// ── Apply theme to DOM ──────────────────────────────────────

export function applyThemeTokens(tokens: ThemeTokens): void {
  const root = document.documentElement;
  root.style.setProperty("--primary", tokens.primary);
  root.style.setProperty("--glow-primary", tokens.glowPrimary);
  root.style.setProperty("--accent", tokens.accent);
  root.style.setProperty("--glow-accent", tokens.glowAccent);
  root.style.setProperty("--ring", tokens.primary);
  root.style.setProperty("--sidebar-primary", tokens.primary);
  root.style.setProperty("--sidebar-ring", tokens.primary);
  // Shadow glows
  root.style.setProperty("--shadow-glow", `0 0 30px hsl(${tokens.glowPrimary} / 0.15)`);
  root.style.setProperty("--shadow-glow-lg", `0 0 60px hsl(${tokens.glowPrimary} / 0.2)`);
  root.style.setProperty("--shadow-glow-accent", `0 0 30px hsl(${tokens.glowAccent} / 0.15)`);
}
