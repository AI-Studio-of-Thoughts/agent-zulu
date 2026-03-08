/**
 * VisionLoop — Captures camera frames and sends them through the protocol.
 *
 * Runs only when session is active, camera is on, and backend supports vision.
 * Rate-limited to ~0.25 FPS (1 frame / 4s). Backend-agnostic.
 *
 * Exposes imperative API via forwardRef for tool interactions:
 * - getCurrentFrame(): returns current canvas as data URL
 * - pause(ms): temporarily halts frame sending
 */

import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react";
import type { VisionCapabilities } from "@/protocol";

export interface VisionLoopHandle {
  getCurrentFrame: () => string | null;
  pause: (ms: number) => void;
  isPaused: () => boolean;
}

interface VisionLoopProps {
  mediaStream: MediaStream | null;
  vision: VisionCapabilities;
  fps?: number;
}

const VisionLoop = forwardRef<VisionLoopHandle, VisionLoopProps>(
  ({ mediaStream, vision, fps = 0.25 }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const pausedRef = useRef(false);
    const pauseTimerRef = useRef<ReturnType<typeof setTimeout>>();

    useImperativeHandle(ref, () => ({
      getCurrentFrame: () => {
        const canvas = canvasRef.current;
        if (!canvas || canvas.width === 0) return null;
        return canvas.toDataURL("image/jpeg", 0.8);
      },
      pause: (ms: number) => {
        pausedRef.current = true;
        clearTimeout(pauseTimerRef.current);
        pauseTimerRef.current = setTimeout(() => {
          pausedRef.current = false;
        }, ms);
      },
      isPaused: () => pausedRef.current,
    }));

    useEffect(() => {
      if (!mediaStream || !vision.supportsVision || !vision.sendFrame) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      video.srcObject = mediaStream;
      video.play().catch(() => {});

      let stopped = false;
      const interval = Math.round(1000 / fps);

      const tick = () => {
        if (stopped) return;

        if (!pausedRef.current && video.readyState >= video.HAVE_CURRENT_DATA) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0);

          canvas.toBlob(
            (blob) => {
              if (blob && vision.sendFrame && !stopped && !pausedRef.current) {
                vision.sendFrame(blob);
              }
            },
            "image/jpeg",
            0.7
          );
        }

        setTimeout(tick, interval);
      };

      tick();

      return () => {
        stopped = true;
        video.srcObject = null;
        clearTimeout(pauseTimerRef.current);
      };
    }, [mediaStream, vision, fps]);

    return (
      <>
        <video ref={videoRef} className="hidden" muted playsInline />
        <canvas ref={canvasRef} className="hidden" />
      </>
    );
  }
);

VisionLoop.displayName = "VisionLoop";

export default VisionLoop;
