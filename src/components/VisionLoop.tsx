/**
 * VisionLoop — Captures camera frames and sends them through the protocol.
 *
 * Motion-adaptive: uses pixel-diff to detect scene changes.
 * - Idle scenes: 1 frame every ~10s
 * - Active scenes (motion/voice): bursts at 1 frame every ~2s
 * - Falls back to idle after 8s of no motion
 *
 * Exposes imperative API via forwardRef for tool interactions:
 * - getCurrentFrame(): returns current canvas as data URL
 * - pause(ms): temporarily halts frame sending
 */

import { useEffect, useRef, forwardRef, useImperativeHandle, useCallback } from "react";
import type { VisionCapabilities } from "@/protocol";

export interface VisionLoopHandle {
  getCurrentFrame: () => string | null;
  pause: (ms: number) => void;
  isPaused: () => boolean;
}

interface VisionLoopProps {
  mediaStream: MediaStream | null;
  vision: VisionCapabilities;
  /** Whether voice is active (triggers burst mode) */
  voiceActive?: boolean;
}

// ── Motion Detection Config ────────────────────────────────
const MOTION_THRESHOLD = 0.04;    // 4% pixel change triggers "active"
const IDLE_INTERVAL = 10000;      // 10s between frames when idle
const ACTIVE_INTERVAL = 2000;     // 2s between frames during motion/voice
const BURST_WINDOW = 8000;        // stay in burst mode for 8s after last motion
const DIFF_SAMPLE_SIZE = 64;      // downsample to 64x64 for fast diff

const VisionLoop = forwardRef<VisionLoopHandle, VisionLoopProps>(
  ({ mediaStream, vision, voiceActive = false }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const diffCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const prevPixelsRef = useRef<Uint8ClampedArray | null>(null);
    const pausedRef = useRef(false);
    const pauseTimerRef = useRef<ReturnType<typeof setTimeout>>();
    const lastMotionRef = useRef(0);
    const lastSendRef = useRef(0);

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

    /**
     * Lightweight motion detection via downsampled grayscale pixel diff.
     * Returns fraction of pixels that changed significantly (0-1).
     */
    const detectMotion = useCallback((ctx: CanvasRenderingContext2D): number => {
      if (!diffCanvasRef.current) {
        diffCanvasRef.current = document.createElement("canvas");
        diffCanvasRef.current.width = DIFF_SAMPLE_SIZE;
        diffCanvasRef.current.height = DIFF_SAMPLE_SIZE;
      }

      const diffCtx = diffCanvasRef.current.getContext("2d");
      if (!diffCtx) return 0;

      // Draw current frame downsampled
      diffCtx.drawImage(
        ctx.canvas,
        0, 0, ctx.canvas.width, ctx.canvas.height,
        0, 0, DIFF_SAMPLE_SIZE, DIFF_SAMPLE_SIZE
      );

      const currentData = diffCtx.getImageData(0, 0, DIFF_SAMPLE_SIZE, DIFF_SAMPLE_SIZE);
      const currentPixels = currentData.data;

      if (!prevPixelsRef.current) {
        prevPixelsRef.current = new Uint8ClampedArray(currentPixels);
        return 1; // First frame always counts as "changed"
      }

      const prev = prevPixelsRef.current;
      let changedPixels = 0;
      const totalPixels = DIFF_SAMPLE_SIZE * DIFF_SAMPLE_SIZE;
      const threshold = 30; // Per-pixel luminance diff threshold

      for (let i = 0; i < currentPixels.length; i += 4) {
        // Grayscale approximation
        const curGray = currentPixels[i] * 0.299 + currentPixels[i + 1] * 0.587 + currentPixels[i + 2] * 0.114;
        const prevGray = prev[i] * 0.299 + prev[i + 1] * 0.587 + prev[i + 2] * 0.114;

        if (Math.abs(curGray - prevGray) > threshold) {
          changedPixels++;
        }
      }

      // Update previous frame
      prevPixelsRef.current = new Uint8ClampedArray(currentPixels);

      return changedPixels / totalPixels;
    }, []);

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

      const tick = () => {
        if (stopped) return;

        const now = Date.now();

        if (!pausedRef.current && video.readyState >= video.HAVE_CURRENT_DATA) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0);

          // Detect motion
          const motionLevel = detectMotion(ctx);
          const hasMotion = motionLevel > MOTION_THRESHOLD;

          if (hasMotion) {
            lastMotionRef.current = now;
          }

          // Determine if we're in burst mode
          const inBurstMode =
            voiceActive ||
            hasMotion ||
            (now - lastMotionRef.current < BURST_WINDOW);

          const interval = inBurstMode ? ACTIVE_INTERVAL : IDLE_INTERVAL;

          // Send frame if enough time has passed
          if (now - lastSendRef.current >= interval) {
            lastSendRef.current = now;

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
        }

        // Check frequently but only send based on adaptive interval
        setTimeout(tick, 500);
      };

      tick();

      return () => {
        stopped = true;
        video.srcObject = null;
        clearTimeout(pauseTimerRef.current);
        prevPixelsRef.current = null;
      };
    }, [mediaStream, vision, voiceActive, detectMotion]);

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
