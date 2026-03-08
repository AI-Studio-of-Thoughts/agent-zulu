import { motion } from "framer-motion";
import agentAvatar from "@/assets/agent-avatar.png";
import type { AvatarEmotion } from "@/protocol/types";

interface AvatarDisplayProps {
  isListening: boolean;
  isSpeaking: boolean;
  isConnected: boolean;
  emotion?: AvatarEmotion;
  intensity?: number;
  localMode?: boolean;
}

const AvatarDisplay = ({
  isListening,
  isSpeaking,
  isConnected,
  emotion = "neutral",
  intensity = 0.2,
  localMode = false,
}: AvatarDisplayProps) => {
  // Map emotion to glow color intensity
  const glowIntensity = intensity;
  const pulseSpeed = isSpeaking ? 0.8 : emotion === "thinking" ? 1.5 : 3;

  return (
    <div className="relative flex items-center justify-center w-full h-full">
      {/* Outer glow rings */}
      {isConnected && (
        <>
          <motion.div
            className="absolute rounded-full border border-primary/20"
            style={{ width: "85%", height: "85%", maxWidth: 520, maxHeight: 520 }}
            animate={{
              scale: isSpeaking ? [1, 1.08, 1] : [1, 1.03, 1],
              opacity: [0.2 * glowIntensity, 0.7 * glowIntensity, 0.2 * glowIntensity],
            }}
            transition={{ duration: pulseSpeed, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute rounded-full border border-accent/15"
            style={{ width: "92%", height: "92%", maxWidth: 560, maxHeight: 560 }}
            animate={{
              scale: [1, 1.04, 1],
              opacity: [0.15, 0.3, 0.15],
            }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
          />
        </>
      )}

      {/* Avatar container */}
      <motion.div
        className="relative rounded-full overflow-hidden glow-ring-lg"
        style={{ width: "70%", height: "70%", maxWidth: 420, maxHeight: 420 }}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 1, ease: "easeOut" }}
      >
        {/* Listening indicator ring */}
        <motion.div
          className="absolute inset-0 rounded-full border-2 border-primary/50 z-10"
          animate={{
            borderColor: isListening
              ? ["hsl(185 100% 50% / 0.5)", "hsl(185 100% 50% / 1)", "hsl(185 100% 50% / 0.5)"]
              : "hsl(185 100% 50% / 0.2)",
          }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />

        <img
          src={agentAvatar}
          alt="Agent Zulu"
          className="w-full h-full object-cover"
        />

        {/* Scan line effect */}
        {isConnected && (
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <motion.div
              className="absolute w-full h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent"
              animate={{ y: ["-100%", "42000%"] }}
              transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
              style={{ top: 0 }}
            />
          </div>
        )}

        {/* Speaking overlay */}
        {isSpeaking && (
          <motion.div
            className="absolute inset-0 bg-primary/5"
            animate={{ opacity: [0, 0.1, 0] }}
            transition={{ duration: 0.5, repeat: Infinity }}
          />
        )}

        {/* Emotion-based overlay for alert/empathetic */}
        {emotion === "alert" && (
          <motion.div
            className="absolute inset-0 bg-destructive/5"
            animate={{ opacity: [0, 0.15, 0] }}
            transition={{ duration: 0.3, repeat: Infinity }}
          />
        )}
      </motion.div>

      {/* Status label */}
      <motion.div
        className="absolute bottom-4 font-mono text-xs tracking-[0.3em] uppercase text-muted-foreground"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
      >
        {isSpeaking ? (
          <span className="text-primary text-glow">Speaking</span>
        ) : isListening ? (
          <span className="text-primary/70">Listening…</span>
        ) : emotion === "thinking" ? (
          <span className="text-accent">Thinking…</span>
        ) : isConnected ? (
          <span>Standby</span>
        ) : (
          <span className="text-destructive">Offline</span>
        )}
      </motion.div>
    </div>
  );
};

export default AvatarDisplay;
