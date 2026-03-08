/**
 * VisionLoop — Captures camera frames and sends them through the protocol.
 *
 * Runs only when session is active, camera is on, and backend supports vision.
 * Rate-limited to ~4 FPS. Backend-agnostic — the adapter decides what to do.
 */

import { useEffect, useRef } from "react";
import type { VisionCapabilities } from "@/protocol";

interface VisionLoopProps {
  mediaStream: MediaStream | null;
  vision: VisionCapabilities;
  fps?: number;
}

const VisionLoop = ({ mediaStream, vision, fps = 0.25 }: VisionLoopProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

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

      if (video.readyState >= video.HAVE_CURRENT_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);

        canvas.toBlob(
          (blob) => {
            if (blob && vision.sendFrame && !stopped) {
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
    };
  }, [mediaStream, vision, fps]);

  return (
    <>
      <video ref={videoRef} className="hidden" muted playsInline />
      <canvas ref={canvasRef} className="hidden" />
    </>
  );
};

export default VisionLoop;
