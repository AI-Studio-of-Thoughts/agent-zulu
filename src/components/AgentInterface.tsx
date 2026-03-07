import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Power } from "lucide-react";
import AvatarDisplay from "./AvatarDisplay";
import CameraPreview from "./CameraPreview";
import MicIndicator from "./MicIndicator";
import ConnectionStatus from "./ConnectionStatus";

const AgentInterface = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [micActive, setMicActive] = useState(true);
  const [cameraActive, setCameraActive] = useState(false);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [sessionDuration, setSessionDuration] = useState(0);
  const [showStartScreen, setShowStartScreen] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  // Session timer
  useEffect(() => {
    if (isConnected) {
      timerRef.current = setInterval(() => setSessionDuration((d) => d + 1), 1000);
    } else {
      clearInterval(timerRef.current);
      setSessionDuration(0);
    }
    return () => clearInterval(timerRef.current);
  }, [isConnected]);

  // Simulate speaking pattern when connected
  useEffect(() => {
    if (!isConnected) return;
    const interval = setInterval(() => {
      setIsSpeaking(true);
      setTimeout(() => {
        setIsSpeaking(false);
        setIsListening(true);
        setTimeout(() => setIsListening(false), 3000);
      }, 2000 + Math.random() * 3000);
    }, 8000);
    return () => clearInterval(interval);
  }, [isConnected]);

  const startSession = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      setMediaStream(stream);
      setCameraActive(true);
      setMicActive(true);
      setIsConnected(true);
      setIsListening(true);
      setShowStartScreen(false);
    } catch {
      // Try audio only
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setMediaStream(stream);
        setMicActive(true);
        setIsConnected(true);
        setIsListening(true);
        setShowStartScreen(false);
      } catch {
        console.error("Could not access media devices");
      }
    }
  }, []);

  const endSession = useCallback(() => {
    mediaStream?.getTracks().forEach((t) => t.stop());
    setMediaStream(null);
    setIsConnected(false);
    setIsListening(false);
    setIsSpeaking(false);
    setCameraActive(false);
    setShowStartScreen(true);
  }, [mediaStream]);

  const toggleMic = useCallback(() => {
    if (mediaStream) {
      const audioTracks = mediaStream.getAudioTracks();
      audioTracks.forEach((t) => (t.enabled = !t.enabled));
      setMicActive((v) => !v);
    }
  }, [mediaStream]);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-background">
      {/* Subtle background grid */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, hsl(185 100% 50%) 1px, transparent 0)`,
          backgroundSize: "40px 40px",
        }}
      />

      {/* Vignette */}
      <div className="absolute inset-0 bg-gradient-radial from-transparent via-transparent to-background/80 pointer-events-none" />

      <AnimatePresence mode="wait">
        {showStartScreen ? (
          <motion.div
            key="start"
            className="absolute inset-0 flex flex-col items-center justify-center z-30"
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.5 }}
          >
            <motion.h1
              className="font-display text-4xl md:text-6xl tracking-[0.2em] text-foreground text-glow mb-2"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              AGENT ZULU
            </motion.h1>
            <motion.p
              className="font-mono text-xs tracking-[0.4em] text-muted-foreground uppercase mb-12"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              Multi-LLM Conversational AI
            </motion.p>

            <motion.button
              onClick={startSession}
              className="relative group rounded-full w-20 h-20 flex items-center justify-center bg-primary/10 border border-primary/40 text-primary transition-colors hover:bg-primary/20"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.6, type: "spring" }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
            >
              {/* Pulse ring */}
              <motion.div
                className="absolute inset-0 rounded-full border border-primary/30"
                animate={{ scale: [1, 1.4], opacity: [0.5, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
              <Power className="w-7 h-7" />
            </motion.button>

            <motion.span
              className="font-mono text-[10px] tracking-[0.3em] text-muted-foreground mt-6 uppercase"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
            >
              Tap to connect
            </motion.span>
          </motion.div>
        ) : (
          <motion.div
            key="session"
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            {/* Agent name top center */}
            <motion.div
              className="absolute top-6 left-1/2 -translate-x-1/2 z-20"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <h2 className="font-display text-sm tracking-[0.3em] text-foreground/60">
                AGENT ZULU
              </h2>
            </motion.div>

            <ConnectionStatus isConnected={isConnected} sessionDuration={sessionDuration} />

            {/* Avatar area */}
            <div className="absolute inset-0 flex items-center justify-center">
              <AvatarDisplay
                isListening={isListening}
                isSpeaking={isSpeaking}
                isConnected={isConnected}
              />
            </div>

            <CameraPreview stream={mediaStream} isActive={cameraActive} />
            <MicIndicator stream={mediaStream} isActive={micActive} onToggle={toggleMic} />

            {/* End session button */}
            <motion.button
              onClick={endSession}
              className="absolute top-6 right-6 glass-surface rounded-full p-3 text-muted-foreground hover:text-destructive transition-colors z-20"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
            >
              <Power className="w-4 h-4" />
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AgentInterface;
