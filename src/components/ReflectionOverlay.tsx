/**
 * ReflectionOverlay — AR visualization of the agent's autonomous reflection.
 *
 * Renders a cinematic "reflection moment" when the Second Intelligence
 * pauses to synthesize session insights — proverbs, cultural threads,
 * goal updates, and community echoes — all overlaid on the cockpit.
 */

import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, BookOpen, Target, Users, X } from "lucide-react";
import type { ReflectionEvent, ReflectionOverlayItem } from "@/protocol/types";

interface ReflectionOverlayProps {
  reflection: ReflectionEvent | null;
  onDismiss?: () => void;
}

const overlayIcons: Record<ReflectionOverlayItem["type"], typeof Sparkles> = {
  proverb: BookOpen,
  cultural_insight: Sparkles,
  goal_update: Target,
  community_echo: Users,
};

const ReflectionOverlay = ({ reflection, onDismiss }: ReflectionOverlayProps) => {
  return (
    <AnimatePresence>
      {reflection && (
        <motion.div
          className="absolute inset-0 z-40 flex items-center justify-center pointer-events-auto"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
        >
          {/* Backdrop with subtle blur */}
          <motion.div
            className="absolute inset-0 bg-background/40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Main reflection card */}
          <motion.div
            className="relative glass-surface rounded-2xl p-6 max-w-sm w-[90vw] border border-primary/30 shadow-[0_0_40px_8px_hsl(var(--primary)/0.15)]"
            initial={{ scale: 0.85, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: -10 }}
            transition={{ type: "spring", stiffness: 250, damping: 22, delay: 0.1 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <motion.div
                  animate={{ rotate: [0, 15, -15, 0] }}
                  transition={{ duration: 3, repeat: Infinity, repeatDelay: 2 }}
                >
                  <Sparkles className="w-4 h-4 text-primary" />
                </motion.div>
                <span className="font-display text-[11px] tracking-[0.25em] text-primary/90 uppercase">
                  Reflection
                </span>
              </div>
              {onDismiss && (
                <button
                  onClick={onDismiss}
                  className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Summary */}
            <motion.p
              className="font-mono text-xs text-foreground/85 leading-relaxed mb-3"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              {reflection.summary}
            </motion.p>

            {reflection.summary_en && (
              <motion.p
                className="font-mono text-[10px] text-muted-foreground leading-relaxed mb-4 italic"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                {reflection.summary_en}
              </motion.p>
            )}

            {/* Proverb — the heart */}
            <motion.div
              className="bg-primary/10 rounded-lg px-4 py-3 border border-primary/20 mb-4"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 }}
            >
              <div className="flex items-start gap-2">
                <BookOpen className="w-3.5 h-3.5 text-primary mt-0.5 flex-shrink-0" />
                <p className="font-mono text-[11px] text-primary leading-relaxed">
                  {reflection.proverb}
                </p>
              </div>
            </motion.div>

            {/* Goal update */}
            {reflection.goal_update && (
              <motion.div
                className="flex items-start gap-2 mb-3"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
              >
                <Target className="w-3 h-3 text-accent mt-0.5 flex-shrink-0" />
                <p className="font-mono text-[10px] text-accent/80 leading-relaxed">
                  {reflection.goal_update}
                </p>
              </motion.div>
            )}

            {/* Community echo */}
            {reflection.community_echo && (
              <motion.div
                className="flex items-start gap-2 mb-3"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.9 }}
              >
                <Users className="w-3 h-3 text-primary/60 mt-0.5 flex-shrink-0" />
                <p className="font-mono text-[10px] text-muted-foreground leading-relaxed">
                  {reflection.community_echo}
                </p>
              </motion.div>
            )}

            {/* AR overlay chips */}
            {reflection.overlays.length > 0 && (
              <motion.div
                className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-border/30"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1 }}
              >
                {reflection.overlays.map((item, i) => {
                  const Icon = overlayIcons[item.type] || Sparkles;
                  return (
                    <motion.div
                      key={i}
                      className="flex items-center gap-1 bg-primary/10 rounded-full px-2 py-0.5 border border-primary/20"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 1 + i * 0.1, type: "spring" }}
                    >
                      <Icon className="w-2.5 h-2.5 text-primary/70" />
                      <span className="font-mono text-[8px] text-primary/80">
                        {item.label}
                      </span>
                    </motion.div>
                  );
                })}
              </motion.div>
            )}

            {/* Source tag */}
            {reflection.source && (
              <div className="mt-3 font-mono text-[7px] tracking-[0.2em] text-muted-foreground/50 uppercase text-right">
                {reflection.source}
              </div>
            )}
          </motion.div>

          {/* Floating AR items on the camera feed area */}
          {reflection.overlays
            .filter((o) => o.x !== undefined && o.y !== undefined)
            .map((item, i) => (
              <motion.div
                key={`ar-${i}`}
                className="absolute z-50 pointer-events-none"
                style={{
                  left: `${(item.x! * 0.3 + 0.6) * 100}%`,
                  top: `${(item.y! * 0.3 + 0.6) * 100}%`,
                }}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ delay: 1.2 + i * 0.15, type: "spring" }}
              >
                <motion.div
                  className="w-6 h-6 rounded-full border border-primary/40 flex items-center justify-center bg-primary/10 shadow-[0_0_12px_hsl(var(--primary)/0.3)]"
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <Sparkles className="w-3 h-3 text-primary" />
                </motion.div>
                <span className="absolute top-7 left-1/2 -translate-x-1/2 whitespace-nowrap font-mono text-[7px] text-primary bg-background/70 rounded px-1 py-0.5">
                  {item.label}
                </span>
              </motion.div>
            ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ReflectionOverlay;
