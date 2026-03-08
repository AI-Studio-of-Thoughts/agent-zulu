/**
 * ThinkingBubble — "Ngiyacabanga..." micro-bubble shown during
 * sovereign reflection calls (>1.5s latency).
 */

import { motion, AnimatePresence } from "framer-motion";
import { Brain } from "lucide-react";

interface ThinkingBubbleProps {
  visible: boolean;
}

const ThinkingBubble = ({ visible }: ThinkingBubbleProps) => (
  <AnimatePresence>
    {visible && (
      <motion.div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[180%] z-30"
        initial={{ opacity: 0, y: 10, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -5, scale: 0.95 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
      >
        <div className="glass-surface rounded-full px-4 py-2 border border-primary/30 flex items-center gap-2 shadow-[0_0_20px_4px_hsl(var(--primary)/0.15)]">
          <motion.div
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
          >
            <Brain className="w-3.5 h-3.5 text-primary" />
          </motion.div>
          <span className="font-mono text-[10px] tracking-[0.15em] text-primary/80">
            Ngiyacabanga…
          </span>
          <motion.div className="flex gap-0.5">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-1 h-1 rounded-full bg-primary/60"
                animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
                transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
              />
            ))}
          </motion.div>
        </div>
      </motion.div>
    )}
  </AnimatePresence>
);

export default ThinkingBubble;
