import { motion } from "framer-motion";
import { Wifi, WifiOff, Activity } from "lucide-react";

interface ConnectionStatusProps {
  isConnected: boolean;
  sessionDuration: number;
}

const ConnectionStatus = ({ isConnected, sessionDuration }: ConnectionStatusProps) => {
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  return (
    <motion.div
      className="absolute top-6 left-6 flex items-center gap-4 z-20"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
    >
      {/* Connection indicator */}
      <div className="glass-surface rounded-full px-4 py-2 flex items-center gap-2">
        {isConnected ? (
          <>
            <motion.div
              className="w-2 h-2 rounded-full bg-primary"
              animate={{ opacity: [1, 0.4, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            <Wifi className="w-3.5 h-3.5 text-primary" />
            <span className="font-mono text-[10px] tracking-widest text-secondary-foreground uppercase">
              Connected
            </span>
          </>
        ) : (
          <>
            <div className="w-2 h-2 rounded-full bg-destructive" />
            <WifiOff className="w-3.5 h-3.5 text-destructive" />
            <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
              Disconnected
            </span>
          </>
        )}
      </div>

      {/* Session timer */}
      {isConnected && (
        <motion.div
          className="glass-surface rounded-full px-3 py-2 flex items-center gap-2"
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <Activity className="w-3 h-3 text-muted-foreground" />
          <span className="font-mono text-[10px] tracking-widest text-muted-foreground">
            {formatTime(sessionDuration)}
          </span>
        </motion.div>
      )}
    </motion.div>
  );
};

export default ConnectionStatus;
