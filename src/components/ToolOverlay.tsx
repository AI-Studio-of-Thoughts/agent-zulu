/**
 * ToolOverlay — Renders visual feedback for tool calls.
 *
 * Handles:
 * - point_at_screen: Glowing indicator at (x,y) with label
 * - freeze_frame: Frozen frame overlay on camera preview
 *
 * Positioned absolutely within the camera preview container.
 */

import { motion, AnimatePresence } from "framer-motion";

interface PointerData {
  x: number;
  y: number;
  description: string;
}

interface ToolOverlayProps {
  pointer: PointerData | null;
  frozenFrame: string | null;
  onDismissFrozen?: () => void;
}

const ToolOverlay = ({ pointer, frozenFrame, onDismissFrozen }: ToolOverlayProps) => {
  return (
    <>
      {/* Frozen frame overlay */}
      <AnimatePresence>
        {frozenFrame && (
          <motion.div
            className="absolute inset-0 z-10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <img
              src={frozenFrame}
              alt="Frozen frame"
              className="w-full h-full object-cover"
            />
            {/* Frozen indicator */}
            <div className="absolute top-1 right-1 flex items-center gap-1 bg-destructive/80 rounded px-1.5 py-0.5">
              <div className="w-1.5 h-1.5 rounded-full bg-destructive-foreground animate-pulse" />
              <span className="font-mono text-[8px] text-destructive-foreground tracking-wider uppercase">
                Frozen
              </span>
            </div>
            {onDismissFrozen && (
              <button
                onClick={onDismissFrozen}
                className="absolute bottom-1 left-1/2 -translate-x-1/2 font-mono text-[8px] text-muted-foreground/80 hover:text-foreground tracking-wider uppercase bg-background/60 rounded px-2 py-0.5 transition-colors"
              >
                Resume
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pointer overlay */}
      <AnimatePresence>
        {pointer && (
          <motion.div
            className="absolute z-20 pointer-events-none"
            style={{
              left: `${pointer.x * 100}%`,
              top: `${pointer.y * 100}%`,
              transform: "translate(-50%, -50%)",
            }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            {/* Outer pulse ring */}
            <motion.div
              className="absolute inset-0 w-10 h-10 -ml-5 -mt-5 rounded-full border-2 border-primary/60"
              animate={{ scale: [1, 1.8], opacity: [0.6, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
            {/* Inner dot */}
            <div className="w-4 h-4 -ml-2 -mt-2 rounded-full bg-primary shadow-[0_0_12px_4px_hsl(var(--primary)/0.4)]" />
            {/* Label */}
            <div className="absolute top-3 left-3 whitespace-nowrap">
              <span className="font-mono text-[9px] tracking-wider text-primary bg-background/70 rounded px-1.5 py-0.5">
                {pointer.description}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default ToolOverlay;
