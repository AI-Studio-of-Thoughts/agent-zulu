/**
 * VisionLoop — Captures camera frames and sends them through the protocol.
 *
 * Motion-adaptive: uses pixel-diff to detect scene changes.
 * - Idle scenes: 1 frame every ~10s
 * - Active scenes (motion/voice): bursts at 1 frame every ~2s
 * - Falls back to idle after 8s of no motion
 *
 * On-device fallback: when cloud vision latency exceeds threshold or fails,
 * switches to local-only mode with basic scene classification.
 *
 * Exposes imperative API via forwardRef for tool interactions:
 * - getCurrentFrame(): returns current canvas as data URL
 * - pause(ms): temporarily halts frame sending
 * - isInLocalMode(): whether fallback is active
 */

import { useEffect, useRef, forwardRef, useImperativeHandle, useCallback, useState } from "react";
import type { VisionCapabilities } from "@/protocol";

export interface VisionLoopHandle {
  getCurrentFrame: () => string | null;
  pause: (ms: number) => void;
  isPaused: () => boolean;
  isInLocalMode: () => boolean;
}

interface VisionLoopProps {
  mediaStream: MediaStream | null;
  vision: VisionCapabilities;
  /** Whether voice is active (triggers burst mode) */
  voiceActive?: boolean;
  /** Callback when local mode status changes */
  onLocalModeChange?: (isLocal: boolean) => void;
}

// ── Motion Detection Config ────────────────────────────────
const MOTION_THRESHOLD = 0.04;    // 4% pixel change triggers "active"
const IDLE_INTERVAL = 15000;      // 15s between frames when idle
const ACTIVE_INTERVAL = 6000;     // 6s between frames during motion/voice
const BURST_WINDOW = 8000;        // stay in burst mode for 8s after last motion
const DIFF_SAMPLE_SIZE = 64;      // downsample to 64x64 for fast diff

// ── On-Device Fallback Config ──────────────────────────────
const LATENCY_THRESHOLD = 6000;   // 6s — switch to local if cloud exceeds this
const CONSECUTIVE_FAILURES = 3;   // switch after N consecutive cloud failures
const LOCAL_MODE_RETRY = 30000;   // retry cloud every 30s while in local mode

// Simple scene tags from local analysis
type LocalSceneTag = "person" | "motion" | "bright" | "dark" | "static" | "unknown";

interface LocalVisionResult {
  motionLevel: number;
  brightness: number;
  tags: LocalSceneTag[];
}

const VisionLoop = forwardRef<VisionLoopHandle, VisionLoopProps>(
  ({ mediaStream, vision, voiceActive = false, onLocalModeChange }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const diffCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const prevPixelsRef = useRef<Uint8ClampedArray | null>(null);
    const pausedRef = useRef(false);
    const pauseTimerRef = useRef<ReturnType<typeof setTimeout>>();
    const lastMotionRef = useRef(0);
    const lastSendRef = useRef(0);

    // On-device fallback state
    const localModeRef = useRef(false);
    const consecutiveFailuresRef = useRef(0);
    const lastCloudRetryRef = useRef(0);
    const [isLocalMode, setIsLocalMode] = useState(false);

    const setLocalMode = useCallback((value: boolean) => {
      localModeRef.current = value;
      setIsLocalMode(value);
      onLocalModeChange?.(value);
    }, [onLocalModeChange]);

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
      isInLocalMode: () => localModeRef.current,
    }));

    /**
     * Lightweight motion detection via downsampled grayscale pixel diff.
     */
    const detectMotion = useCallback((ctx: CanvasRenderingContext2D): number => {
      if (!diffCanvasRef.current) {
        diffCanvasRef.current = document.createElement("canvas");
        diffCanvasRef.current.width = DIFF_SAMPLE_SIZE;
        diffCanvasRef.current.height = DIFF_SAMPLE_SIZE;
      }

      const diffCtx = diffCanvasRef.current.getContext("2d");
      if (!diffCtx) return 0;

      diffCtx.drawImage(
        ctx.canvas,
        0, 0, ctx.canvas.width, ctx.canvas.height,
        0, 0, DIFF_SAMPLE_SIZE, DIFF_SAMPLE_SIZE
      );

      const currentData = diffCtx.getImageData(0, 0, DIFF_SAMPLE_SIZE, DIFF_SAMPLE_SIZE);
      const currentPixels = currentData.data;

      if (!prevPixelsRef.current) {
        prevPixelsRef.current = new Uint8ClampedArray(currentPixels);
        return 1;
      }

      const prev = prevPixelsRef.current;
      let changedPixels = 0;
      const totalPixels = DIFF_SAMPLE_SIZE * DIFF_SAMPLE_SIZE;
      const threshold = 30;

      for (let i = 0; i < currentPixels.length; i += 4) {
        const curGray = currentPixels[i] * 0.299 + currentPixels[i + 1] * 0.587 + currentPixels[i + 2] * 0.114;
        const prevGray = prev[i] * 0.299 + prev[i + 1] * 0.587 + prev[i + 2] * 0.114;
        if (Math.abs(curGray - prevGray) > threshold) {
          changedPixels++;
        }
      }

      prevPixelsRef.current = new Uint8ClampedArray(currentPixels);
      return changedPixels / totalPixels;
    }, []);

    /**
     * On-device local scene analysis (no cloud needed).
     * Analyzes brightness, motion, and basic spatial features.
     */
    const analyzeLocally = useCallback((ctx: CanvasRenderingContext2D, motionLevel: number): LocalVisionResult => {
      if (!diffCanvasRef.current) return { motionLevel, brightness: 0.5, tags: ["unknown"] };

      const diffCtx = diffCanvasRef.current.getContext("2d");
      if (!diffCtx) return { motionLevel, brightness: 0.5, tags: ["unknown"] };

      const data = diffCtx.getImageData(0, 0, DIFF_SAMPLE_SIZE, DIFF_SAMPLE_SIZE);
      const pixels = data.data;

      // Calculate average brightness
      let totalBrightness = 0;
      let skinTonePixels = 0;
      const totalPixels = DIFF_SAMPLE_SIZE * DIFF_SAMPLE_SIZE;

      for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
        totalBrightness += (r * 0.299 + g * 0.587 + b * 0.114) / 255;

        // Simple skin tone detection (rough heuristic)
        if (r > 80 && g > 40 && b > 20 && r > g && r > b && Math.abs(r - g) > 15) {
          skinTonePixels++;
        }
      }

      const brightness = totalBrightness / totalPixels;
      const tags: LocalSceneTag[] = [];

      if (motionLevel > MOTION_THRESHOLD) tags.push("motion");
      else tags.push("static");

      if (brightness > 0.6) tags.push("bright");
      else if (brightness < 0.3) tags.push("dark");

      if (skinTonePixels / totalPixels > 0.05) tags.push("person");

      if (tags.length === 0) tags.push("unknown");

      return { motionLevel, brightness, tags };
    }, []);

    /**
     * Wraps vision.sendFrame with latency tracking and fallback logic.
     */
    const sendFrameWithFallback = useCallback((
      blob: Blob,
      ctx: CanvasRenderingContext2D,
      motionLevel: number
    ) => {
      if (!vision.sendFrame) return;

      const now = Date.now();

      // If in local mode, periodically retry cloud
      if (localModeRef.current) {
        if (now - lastCloudRetryRef.current < LOCAL_MODE_RETRY) {
          // Stay in local mode — emit local analysis only
          const local = analyzeLocally(ctx, motionLevel);
          console.debug("[VisionLoop] Local mode:", local.tags.join(", "));
          return;
        }
        // Retry cloud
        lastCloudRetryRef.current = now;
      }

      const sendStart = Date.now();

      // Send to cloud with timeout tracking
      const timeoutId = setTimeout(() => {
        // If we haven't heard back, count as slow
        consecutiveFailuresRef.current++;
        if (consecutiveFailuresRef.current >= CONSECUTIVE_FAILURES && !localModeRef.current) {
          console.warn("[VisionLoop] Cloud too slow — switching to local mode");
          setLocalMode(true);
        }
      }, LATENCY_THRESHOLD);

      // Monkey-patch: track when the adapter finishes processing
      const originalSendFrame = vision.sendFrame;
      const wrappedSend = (frame: ImageData | Blob) => {
        originalSendFrame(frame);
        // Clear timeout if send succeeded quickly (adapter will process async)
        const elapsed = Date.now() - sendStart;
        if (elapsed < LATENCY_THRESHOLD) {
          clearTimeout(timeoutId);
          consecutiveFailuresRef.current = Math.max(0, consecutiveFailuresRef.current - 1);
          if (localModeRef.current && consecutiveFailuresRef.current === 0) {
            console.info("[VisionLoop] Cloud recovered — exiting local mode");
            setLocalMode(false);
          }
        }
      };

      wrappedSend(blob);
    }, [vision, analyzeLocally, setLocalMode]);

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

          const motionLevel = detectMotion(ctx);
          const hasMotion = motionLevel > MOTION_THRESHOLD;

          if (hasMotion) {
            lastMotionRef.current = now;
          }

          const inBurstMode =
            voiceActive ||
            hasMotion ||
            (now - lastMotionRef.current < BURST_WINDOW);

          const interval = inBurstMode ? ACTIVE_INTERVAL : IDLE_INTERVAL;

          if (now - lastSendRef.current >= interval) {
            lastSendRef.current = now;

            canvas.toBlob(
              (blob) => {
                if (blob && !stopped && !pausedRef.current) {
                  sendFrameWithFallback(blob, ctx, motionLevel);
                }
              },
              "image/jpeg",
              0.7
            );
          }
        }

        setTimeout(tick, 500);
      };

      tick();

      return () => {
        stopped = true;
        video.srcObject = null;
        clearTimeout(pauseTimerRef.current);
        prevPixelsRef.current = null;
      };
    }, [mediaStream, vision, voiceActive, detectMotion, sendFrameWithFallback]);

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
