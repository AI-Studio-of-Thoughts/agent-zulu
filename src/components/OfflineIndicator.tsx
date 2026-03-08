/**
 * OfflineIndicator — Shows connectivity status and pending outbox queue.
 *
 * Appears as a subtle pill at the top of the screen when offline or
 * when there are pending operations in the queue.
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { WifiOff, CloudOff, Upload } from "lucide-react";
import {
  getOnlineStatus,
  onConnectivityChange,
  onQueueChange,
  getPendingCount,
  flushQueue,
} from "@/lib/offline-outbox";

const OfflineIndicator = () => {
  const [online, setOnline] = useState(getOnlineStatus());
  const [pendingCount, setPendingCount] = useState(0);
  const [flushing, setFlushing] = useState(false);

  useEffect(() => {
    const unsubConnectivity = onConnectivityChange(setOnline);
    const unsubQueue = onQueueChange(setPendingCount);

    // Initial count
    getPendingCount().then(setPendingCount);

    return () => {
      unsubConnectivity();
      unsubQueue();
    };
  }, []);

  const handleFlush = async () => {
    if (flushing || !online) return;
    setFlushing(true);
    await flushQueue();
    setFlushing(false);
  };

  const show = !online || pendingCount > 0;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed top-2 left-1/2 -translate-x-1/2 z-50"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
        >
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border backdrop-blur-md font-mono text-[10px] tracking-wider ${
              !online
                ? "bg-destructive/10 border-destructive/30 text-destructive"
                : "bg-primary/10 border-primary/30 text-primary"
            }`}
          >
            {!online ? (
              <>
                <WifiOff className="w-3 h-3" />
                <span>OFFLINE</span>
                {pendingCount > 0 && (
                  <span className="bg-destructive/20 rounded-full px-1.5 py-0.5 text-[8px]">
                    {pendingCount} queued
                  </span>
                )}
              </>
            ) : pendingCount > 0 ? (
              <>
                <CloudOff className="w-3 h-3" />
                <span>{pendingCount} pending</span>
                <button
                  onClick={handleFlush}
                  disabled={flushing}
                  className="flex items-center gap-1 bg-primary/20 hover:bg-primary/30 rounded-full px-2 py-0.5 transition-colors disabled:opacity-50"
                >
                  <Upload className={`w-2.5 h-2.5 ${flushing ? "animate-pulse" : ""}`} />
                  <span className="text-[8px]">{flushing ? "SYNCING" : "SYNC"}</span>
                </button>
              </>
            ) : null}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default OfflineIndicator;
