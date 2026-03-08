import { useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { VideoOff } from "lucide-react";
import ToolOverlay from "./ToolOverlay";

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
}

const CameraPreview = ({
  stream,
  isActive,
  pointer = null,
  frozenFrame = null,
  onDismissFrozen,
  zoomLevel = 1,
}: CameraPreviewProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <motion.div
      className="absolute bottom-6 right-6 w-40 h-28 rounded-lg overflow-hidden glass-surface z-20"
      initial={{ opacity: 0, y: 20, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: 0.8, duration: 0.5 }}
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
            className="w-full h-full object-cover transform -scale-x-100"
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

      {/* Zoom indicator */}
      {zoomLevel > 1 && (
        <div className="absolute top-1 left-1 font-mono text-[8px] tracking-wider text-primary bg-background/60 rounded px-1 py-0.5 z-20">
          {zoomLevel.toFixed(1)}×
        </div>
      )}

      {/* Border glow */}
      <div className="absolute inset-0 rounded-lg border border-primary/20 pointer-events-none" />

      {/* Label */}
      <div className="absolute bottom-1 left-2 font-mono text-[9px] tracking-widest text-muted-foreground uppercase z-10">
        You
      </div>
    </motion.div>
  );
};

export default CameraPreview;
