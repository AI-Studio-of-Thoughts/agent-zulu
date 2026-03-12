/**
 * GenerativeUILayer — Renders contextual suggested actions and ambient label.
 * Also applies dynamic theme tokens to the DOM.
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sun, Brain, CalendarDays, Cloud, Target, ClipboardCheck,
  BookOpen, Moon, Sunrise, Heart, ListChecks, Sparkles,
  Quote, Bug, MessageSquare,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  detectTimePhase, detectMood, detectTopic,
  getThemeTokens, getSuggestedActions, getAmbientLabel,
  applyThemeTokens,
  type TimePhase, type DetectedMood, type ConversationTopic,
  type SuggestedAction, type GenerativeUIState,
} from "@/lib/generative-ui";

const ICON_MAP: Record<string, LucideIcon> = {
  Sun, Brain, CalendarDays, Cloud, Target, ClipboardCheck,
  BookOpen, Moon, Sunrise, Heart, ListChecks, Sparkles,
  Quote, Bug, MessageSquare,
};

interface GenerativeUILayerProps {
  transcripts: Array<{ role: string; text: string }>;
  isConnected: boolean;
  onActionTap?: (prompt: string) => void;
}

const GenerativeUILayer = ({ transcripts, isConnected, onActionTap }: GenerativeUILayerProps) => {
  const [state, setState] = useState<GenerativeUIState>(() => {
    const time = detectTimePhase();
    const ambient = getAmbientLabel(time);
    return {
      timePhase: time,
      mood: "neutral",
      topic: "general",
      suggestedActions: getSuggestedActions(time, "general"),
      ambientLabel: ambient.zu,
      ambientLabelEn: ambient.en,
    };
  });

  const prevTokensRef = useRef<string>("");

  // Update context every 10s or when transcripts change
  const updateContext = useCallback(() => {
    const texts = transcripts.map(t => t.text);
    const time = detectTimePhase();
    const mood = detectMood(texts);
    const topic = detectTopic(texts);
    const tokens = getThemeTokens(time, mood);
    const actions = getSuggestedActions(time, topic);
    const ambient = getAmbientLabel(time);

    // Only apply DOM changes if tokens actually changed
    const tokenKey = `${time}-${mood}`;
    if (tokenKey !== prevTokensRef.current) {
      applyThemeTokens(tokens);
      prevTokensRef.current = tokenKey;
    }

    setState({
      timePhase: time,
      mood,
      topic,
      suggestedActions: actions,
      ambientLabel: ambient.zu,
      ambientLabelEn: ambient.en,
    });
  }, [transcripts]);

  // Apply on mount and periodically
  useEffect(() => {
    updateContext();
    const interval = setInterval(updateContext, 15_000);
    return () => clearInterval(interval);
  }, [updateContext]);

  // Also update when transcripts change significantly
  const prevLenRef = useRef(0);
  useEffect(() => {
    if (transcripts.length !== prevLenRef.current) {
      prevLenRef.current = transcripts.length;
      updateContext();
    }
  }, [transcripts.length, updateContext]);

  if (!isConnected) return null;

  return (
    <>
      {/* Ambient time label — top-left */}
      <motion.div
        className="absolute top-16 left-6 z-20"
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.8, duration: 0.6 }}
      >
        <p className="font-mono text-[9px] tracking-[0.25em] uppercase text-primary/50">
          {state.ambientLabel}
        </p>
        <p className="font-mono text-[8px] tracking-[0.2em] uppercase text-muted-foreground/40 mt-0.5">
          {state.ambientLabelEn}
        </p>
        {state.mood !== "neutral" && (
          <motion.p
            className="font-mono text-[8px] tracking-[0.15em] text-accent/50 mt-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            key={state.mood}
          >
            mood: {state.mood}
          </motion.p>
        )}
      </motion.div>

      {/* Suggested action chips — bottom area */}
      <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-20 flex gap-2">
        <AnimatePresence mode="popLayout">
          {state.suggestedActions.map((action, i) => {
            const Icon = ICON_MAP[action.icon] || Sparkles;
            return (
              <motion.button
                key={action.id}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full glass-surface border border-primary/20 hover:border-primary/50 text-foreground/70 hover:text-foreground transition-all group"
                initial={{ opacity: 0, y: 20, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.9 }}
                transition={{ delay: i * 0.1, type: "spring", stiffness: 300, damping: 25 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => onActionTap?.(action.prompt)}
              >
                <Icon className="w-3 h-3 text-primary/70 group-hover:text-primary transition-colors" />
                <span className="font-mono text-[10px] tracking-wider whitespace-nowrap">
                  {action.label}
                </span>
              </motion.button>
            );
          })}
        </AnimatePresence>
      </div>
    </>
  );
};

export default GenerativeUILayer;
