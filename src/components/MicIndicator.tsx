import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Mic, MicOff } from "lucide-react";

interface MicIndicatorProps {
  stream: MediaStream | null;
  isActive: boolean;
  onToggle: () => void;
}

const MicIndicator = ({ stream, isActive, onToggle }: MicIndicatorProps) => {
  const [level, setLevel] = useState(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!stream || !isActive) {
      setLevel(0);
      return;
    }

    const ctx = new AudioContext();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    analyserRef.current = analyser;

    const data = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteFrequencyData(data);
      const avg = data.reduce((a, b) => a + b, 0) / data.length;
      setLevel(avg / 255);
      rafRef.current = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelAnimationFrame(rafRef.current);
      ctx.close();
    };
  }, [stream, isActive]);

  const bars = 5;

  return (
    <motion.button
      onClick={onToggle}
      className="absolute bottom-6 left-6 glass-surface rounded-full px-4 py-3 flex items-center gap-3 cursor-pointer z-20 group"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.9 }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      {isActive ? (
        <Mic className="w-4 h-4 text-primary" />
      ) : (
        <MicOff className="w-4 h-4 text-destructive" />
      )}

      {/* Audio level bars */}
      <div className="flex items-end gap-[2px] h-4">
        {Array.from({ length: bars }).map((_, i) => (
          <motion.div
            key={i}
            className="w-[3px] rounded-full bg-primary"
            animate={{
              height: isActive ? Math.max(4, level * 16 * (0.5 + Math.random() * 0.5)) : 4,
              opacity: isActive ? 0.5 + level * 0.5 : 0.2,
            }}
            transition={{ duration: 0.1 }}
          />
        ))}
      </div>
    </motion.button>
  );
};

export default MicIndicator;
