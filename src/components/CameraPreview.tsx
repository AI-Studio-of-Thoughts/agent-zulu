import { useRef, useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { VideoOff, SwitchCamera, Maximize2, Minimize2 } from "lucide-react";
import ToolOverlay from "./ToolOverlay";
import GestureOverlay, { type GestureData } from "./GestureOverlay";

interface PointerData {
  x: number;
  y: number;
  description: string;
}

interface CameraPreviewProps {
  stream: MediaStream | null;
  isActive: boolean;
  pointer?: PointerData | null;
  frozenFrame?: string | null;
  onDismissFrozen?: () => void;
  zoomLevel?: number;
  gesture?: GestureData | null;
  onSwitchCamera?: () => void;
  facingMode?: "user" | "environment";
}

const CameraPreview = ({
  stream,
  isActive,
  pointer = null,
  frozenFrame = null,
  onDismissFrozen,
  zoomLevel = 1,
  gesture = null,
  onSwitchCamera,
  facingMode = "user",
}: CameraPreviewProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const toggleExpand = useCallback(() => setExpanded((v) => !v), []);

  // Size classes based on expanded state
  const sizeClass = expanded
    ? "w-64 h-48 md:w-80 md:h-60"
    : "w-44 h-32 md:w-52 md:h-36";

  // Position: bottom-right but higher so it's clearly visible
  const positionClass = expanded
    ? "bottom-20 right-4 md:bottom-24 md:right-6"
    : "bottom-20 right-4 md:bottom-24 md:right-6";

  return (
    <motion.div
      className={`absolute ${positionClass} ${sizeClass} rounded-xl overflow-hidden glass-surface z-20 border-2 border-primary/30`}
      initial={{ opacity: 0, y: 20, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: 0.8, duration: 0.5 }}
      layout
    >
      {isActive && stream ? (
        <motion.div
          className="w-full h-full"
          animate={{ scale: zoomLevel }}
          transition={{ type: "spring", stiffness: 200, damping: 20 }}
        >
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover ${facingMode === "user" ? "transform -scale-x-100" : ""}`}
          />
        </motion.div>
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <VideoOff className="w-6 h-6 text-muted-foreground" />
        </div>
      )}

      {/* Tool overlays rendered on top of camera feed */}
      <ToolOverlay
        pointer={pointer}
        frozenFrame={frozenFrame}
        onDismissFrozen={onDismissFrozen}
      />

      {/* AR gesture overlay */}
      <GestureOverlay gesture={gesture} />

      {/* Controls bar */}
      <div className="absolute top-1 right-1 flex gap-1 z-30">
        {/* Expand/minimize toggle */}
        <button
          onClick={toggleExpand}
          className="p-1.5 rounded-md bg-background/60 backdrop-blur-sm text-foreground/70 hover:text-primary transition-colors"
          aria-label={expanded ? "Minimize camera" : "Expand camera"}
        >
          {expanded ? (
            <Minimize2 className="w-3.5 h-3.5" />
          ) : (
            <Maximize2 className="w-3.5 h-3.5" />
          )}
        </button>

        {/* Camera flip */}
        {onSwitchCamera && (
          <button
            onClick={onSwitchCamera}
            className="p-1.5 rounded-md bg-background/60 backdrop-blur-sm text-foreground/70 hover:text-primary transition-colors"
            aria-label="Switch camera"
          >
            <SwitchCamera className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Zoom indicator */}
      {zoomLevel > 1 && (
        <div className="absolute top-1 left-1 font-mono text-[8px] tracking-wider text-primary bg-background/60 rounded px-1 py-0.5 z-20">
          {zoomLevel.toFixed(1)}×
        </div>
      )}

      {/* LIVE indicator — makes it obvious camera is on */}
      {isActive && stream && (
        <div className="absolute top-1.5 left-1.5 flex items-center gap-1 z-20">
          <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
          <span className="font-mono text-[8px] tracking-widest text-destructive/80 uppercase">
            Live
          </span>
        </div>
      )}

      {/* Border glow */}
      <div className="absolute inset-0 rounded-xl border border-primary/20 pointer-events-none" />

      {/* Label */}
      <div className="absolute bottom-1 left-2 font-mono text-[9px] tracking-widest text-muted-foreground uppercase z-10">
        {facingMode === "user" ? "You" : "Rear"}
      </div>
    </motion.div>
  );
};

export default CameraPreview;
