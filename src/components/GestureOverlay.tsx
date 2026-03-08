/**
 * GestureOverlay — AR-like visual feedback for detected hand gestures.
 *
 * Renders animated overlays on the camera preview when the sovereign
 * vision backend detects gestures (hand_offer, point, wave, hold_up, open_palm).
 * Each gesture type has a distinct animation + isiZulu label.
 */

import { motion, AnimatePresence } from "framer-motion";
import { Hand, Grab, MousePointerClick, Sparkles } from "lucide-react";

export interface GestureData {
  type: "hand_offer" | "point" | "wave" | "hold_up" | "open_palm";
  /** Normalized 0-1 coordinates of gesture center */
  x: number;
  y: number;
  /** isiZulu response to the gesture */
  label_zu: string;
  /** English gloss */
  label_en?: string;
  /** Confidence 0-1 */
  confidence: number;
}

interface GestureOverlayProps {
  gesture: GestureData | null;
}

const gestureConfig: Record<GestureData["type"], {
  icon: typeof Hand;
  color: string;
  animation: "accept" | "ripple" | "point" | "glow";
  zuFallback: string;
}> = {
  hand_offer: {
    icon: Grab,
    color: "hsl(var(--primary))",
    animation: "accept",
    zuFallback: "Ngiyabonga — ngiyakwamukela",
  },
  point: {
    icon: MousePointerClick,
    color: "hsl(var(--primary))",
    animation: "point",
    zuFallback: "Ngiyabona lapho ukhomba khona",
  },
  wave: {
    icon: Hand,
    color: "hsl(var(--accent))",
    animation: "ripple",
    zuFallback: "Sawubona!",
  },
  hold_up: {
    icon: Sparkles,
    color: "hsl(var(--primary))",
    animation: "glow",
    zuFallback: "Ngiyakubona — ake ngibheke",
  },
  open_palm: {
    icon: Hand,
    color: "hsl(var(--accent))",
    animation: "ripple",
    zuFallback: "Ubuntu — isandla esivulekile",
  },
};

const GestureOverlay = ({ gesture }: GestureOverlayProps) => {
  return (
    <AnimatePresence>
      {gesture && gesture.confidence > 0.3 && (
        <motion.div
          key={`${gesture.type}-${gesture.x}-${gesture.y}`}
          className="absolute z-30 pointer-events-none"
          style={{
            left: `${gesture.x * 100}%`,
            top: `${gesture.y * 100}%`,
            transform: "translate(-50%, -50%)",
          }}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.5, opacity: 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 20 }}
        >
          <GestureAnimation gesture={gesture} />
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const GestureAnimation = ({ gesture }: { gesture: GestureData }) => {
  const config = gestureConfig[gesture.type];
  const Icon = config.icon;
  const label = gesture.label_zu || config.zuFallback;

  return (
    <div className="relative flex flex-col items-center">
      {/* Outer pulse rings */}
      {(config.animation === "ripple" || config.animation === "accept") && (
        <>
          <motion.div
            className="absolute w-14 h-14 rounded-full border-2 border-primary/40"
            animate={{ scale: [1, 2.2], opacity: [0.5, 0] }}
            transition={{ duration: 1.2, repeat: Infinity, repeatDelay: 0.3 }}
          />
          <motion.div
            className="absolute w-14 h-14 rounded-full border border-primary/20"
            animate={{ scale: [1, 2.8], opacity: [0.3, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 0.5 }}
          />
        </>
      )}

      {/* Glow ring for hold_up */}
      {config.animation === "glow" && (
        <motion.div
          className="absolute w-16 h-16 rounded-full"
          style={{
            background: `radial-gradient(circle, hsl(var(--primary) / 0.3), transparent 70%)`,
          }}
          animate={{ scale: [1, 1.4, 1], opacity: [0.6, 0.9, 0.6] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      )}

      {/* Directional arrow for point */}
      {config.animation === "point" && (
        <motion.div
          className="absolute w-10 h-10"
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 1, repeat: Infinity }}
        >
          <div className="w-0 h-0 mx-auto border-l-[6px] border-r-[6px] border-b-[8px] border-l-transparent border-r-transparent border-b-primary/60" />
        </motion.div>
      )}

      {/* Icon circle */}
      <motion.div
        className="relative w-8 h-8 rounded-full flex items-center justify-center bg-primary/20 border border-primary/50 shadow-[0_0_16px_4px_hsl(var(--primary)/0.3)]"
        animate={
          config.animation === "accept"
            ? { scale: [1, 1.15, 1], rotate: [0, -5, 5, 0] }
            : config.animation === "ripple"
            ? { scale: [1, 1.1, 1] }
            : {}
        }
        transition={{ duration: 1.5, repeat: Infinity }}
      >
        <Icon className="w-4 h-4 text-primary" />
      </motion.div>

      {/* isiZulu label */}
      <motion.div
        className="absolute top-10 whitespace-nowrap"
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <span className="font-mono text-[8px] tracking-wider text-primary bg-background/80 rounded px-1.5 py-0.5 border border-primary/20">
          {label}
        </span>
        {gesture.label_en && (
          <span className="block font-mono text-[7px] tracking-wider text-muted-foreground mt-0.5 text-center">
            {gesture.label_en}
          </span>
        )}
      </motion.div>
    </div>
  );
};

export default GestureOverlay;
