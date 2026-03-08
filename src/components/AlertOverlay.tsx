import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, ShieldAlert, Info, ThumbsUp, ThumbsDown } from "lucide-react";

export interface AlertData {
  message: string;
  urgency: "low" | "medium" | "high";
}

interface AlertOverlayProps {
  alert: AlertData | null;
  onDismiss: () => void;
  onFeedback?: (rating: "up" | "down") => void;
}

const urgencyConfig = {
  low: {
    icon: Info,
    borderClass: "border-primary/40",
    bgClass: "bg-primary/10",
    textClass: "text-primary",
    glowClass: "",
  },
  medium: {
    icon: AlertTriangle,
    borderClass: "border-accent/50",
    bgClass: "bg-accent/10",
    textClass: "text-accent",
    glowClass: "shadow-[0_0_20px_hsl(260_80%_60%/0.3)]",
  },
  high: {
    icon: ShieldAlert,
    borderClass: "border-destructive/60",
    bgClass: "bg-destructive/15",
    textClass: "text-destructive",
    glowClass: "shadow-[0_0_40px_hsl(0_70%_50%/0.4)]",
  },
};

const AlertOverlay = ({ alert, onDismiss, onFeedback }: AlertOverlayProps) => {
  return (
    <AnimatePresence>
      {alert && (
        <motion.div
          className="absolute inset-x-0 top-16 flex justify-center z-50"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
        >
          <div
            className={`glass-surface rounded-xl px-5 py-3 max-w-sm flex items-center gap-3 border ${urgencyConfig[alert.urgency].borderClass} ${urgencyConfig[alert.urgency].bgClass} ${urgencyConfig[alert.urgency].glowClass} transition-all`}
          >
            {(() => {
              const Icon = urgencyConfig[alert.urgency].icon;
              return (
                <motion.div
                  animate={alert.urgency === "high" ? { scale: [1, 1.2, 1] } : {}}
                  transition={{ duration: 0.8, repeat: Infinity }}
                >
                  <Icon className={`w-5 h-5 flex-shrink-0 ${urgencyConfig[alert.urgency].textClass}`} />
                </motion.div>
              );
            })()}
            <p className="font-mono text-xs text-foreground/90 leading-relaxed text-left flex-1">
              {alert.message}
            </p>
            {onFeedback && (
              <div className="flex items-center gap-0.5 flex-shrink-0">
                <button
                  onClick={() => onFeedback("up")}
                  className="p-1 rounded text-muted-foreground hover:text-primary transition-colors"
                >
                  <ThumbsUp className="w-3 h-3" />
                </button>
                <button
                  onClick={() => onFeedback("down")}
                  className="p-1 rounded text-muted-foreground hover:text-destructive transition-colors"
                >
                  <ThumbsDown className="w-3 h-3" />
                </button>
              </div>
            )}
            <button
              onClick={onDismiss}
              className="font-mono text-[10px] text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
            >
              ✕
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AlertOverlay;
