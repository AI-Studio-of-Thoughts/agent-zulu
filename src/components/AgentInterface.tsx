import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Power, ThumbsUp, ThumbsDown } from "lucide-react";
import { toast } from "sonner";
import AvatarDisplay from "./AvatarDisplay";
import CameraPreview from "./CameraPreview";
import MicIndicator from "./MicIndicator";
import ConnectionStatus from "./ConnectionStatus";
import VisionLoop from "./VisionLoop";
import AlertOverlay from "./AlertOverlay";
import SettingsPanel from "./SettingsPanel";
import ReflectionOverlay from "./ReflectionOverlay";
import type { VisionLoopHandle } from "./VisionLoop";
import type { AlertData } from "./AlertOverlay";
import type { ReflectionEvent } from "@/protocol/types";
import { useAgentProtocol, HybridAdapter, SovereignBetaAdapter } from "@/protocol";
import { supabase } from "@/integrations/supabase/client";
import {
  saveMemory,
  searchMemories,
  saveGoal,
  loadGoals,
  completeGoalMilestone,
  loadSettings,
  getProactiveThreshold,
  getGoalReminders,
  type AgentSettings,
} from "@/lib/agent-memory";
import {
  startShadowSession,
  endShadowSession,
  logToolCall,
  logSpecialistDelegation,
  logProactiveTrigger,
  logAlertTriggered,
  shadowLog,
} from "@/lib/shadow-logger";

import type { GestureData } from "./GestureOverlay";

interface PointerData {
  x: number;
  y: number;
  description: string;
}

const AgentInterface = () => {
  const [settings, setSettings] = useState<AgentSettings>(loadSettings);
  const adapter = useMemo(
    () => settings.sovereignBeta ? new SovereignBetaAdapter() : new HybridAdapter(),
    [settings.sovereignBeta]
  );
  const agent = useAgentProtocol(adapter);

  const [isConnecting, setIsConnecting] = useState(false);
  const [micActive, setMicActive] = useState(true);
  const [cameraActive, setCameraActive] = useState(false);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [sessionDuration, setSessionDuration] = useState(0);
  const [showStartScreen, setShowStartScreen] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const visionLoopRef = useRef<VisionLoopHandle>(null);

  // Tool overlay state
  const [pointer, setPointer] = useState<PointerData | null>(null);
  const [frozenFrame, setFrozenFrame] = useState<string | null>(null);
  const [localMode, setLocalMode] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [activeGesture, setActiveGesture] = useState<GestureData | null>(null);
  const pointerTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const freezeTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const zoomTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const gestureTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // Proactive speech + alerts + feedback + reflection
  const [proactiveText, setProactiveText] = useState<string | null>(null);
  const [activeAlert, setActiveAlert] = useState<AlertData | null>(null);
  const [goalReminder, setGoalReminder] = useState<string | null>(null);
  const [activeReflection, setActiveReflection] = useState<ReflectionEvent | null>(null);
  const alertTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const goalReminderTimerRef = useRef<ReturnType<typeof setInterval>>();
  const reflectionTimerRef = useRef<ReturnType<typeof setInterval>>();
  const transcriptsRef = useRef<Array<{ role: string; text: string }>>([]);
  const visionDescriptionsRef = useRef<string[]>([]);
  const gesturesRef = useRef<Array<{ type: string; x: number; y: number; label_zu?: string; label_en?: string }>>([]);

  // Settings
  // Settings — moved to top of component
  const proactiveThreshold = getProactiveThreshold(settings.proactivityLevel);

  // Proactive rate limiter
  const lastProactiveRef = useRef(0);
  const PROACTIVE_MIN_INTERVAL = 30_000;

  const isConnected = agent.status === "connected";
  const isSpeaking = agent.voiceState.isSpeaking;
  const isListening = agent.voiceState.isListening;

  // Feedback handler
  const handleFeedback = useCallback((type: "proactive" | "alert", text: string, rating: "up" | "down") => {
    shadowLog("user_feedback", { type, text, rating, sovereign_beta: settings.sovereignBeta });
  }, [settings.sovereignBeta]);

  // Log sovereign toggle changes and first impression
  const sovereignFirstLogged = useRef(false);
  const handleSettingsChange = useCallback((newSettings: AgentSettings) => {
    if (newSettings.sovereignBeta !== settings.sovereignBeta) {
      shadowLog("sovereign_toggle", { enabled: newSettings.sovereignBeta });
      sovereignFirstLogged.current = false; // Reset for next activation
    }
    setSettings(newSettings);
  }, [settings.sovereignBeta]);

  // Log first sovereign response
  useEffect(() => {
    if (!settings.sovereignBeta || sovereignFirstLogged.current) return;
    const unsub = adapter.on((event) => {
      if (event.type === "transcript" && event.entry.role === "agent" && !sovereignFirstLogged.current) {
        sovereignFirstLogged.current = true;
        shadowLog("sovereign_first_impression", { text: event.entry.text });
      }
    });
    return unsub;
  }, [adapter, settings.sovereignBeta]);

  // Register tool handlers on the adapter
  useEffect(() => {
    agent.registerTools({
      point_at_screen: async (params) => {
        const x = Number(params.x ?? 0.5);
        const y = Number(params.y ?? 0.5);
        const description = String(params.description ?? "here");
        setPointer({ x, y, description });
        clearTimeout(pointerTimerRef.current);
        pointerTimerRef.current = setTimeout(() => setPointer(null), 5000);
        return `Pointed at (${x.toFixed(2)}, ${y.toFixed(2)}): ${description}`;
      },
      freeze_frame: async () => {
        const frame = visionLoopRef.current?.getCurrentFrame();
        if (frame) {
          setFrozenFrame(frame);
          visionLoopRef.current?.pause(10000);
          clearTimeout(freezeTimerRef.current);
          freezeTimerRef.current = setTimeout(() => setFrozenFrame(null), 10000);
          return "Frame frozen for inspection.";
        }
        return "No frame available to freeze.";
      },
      remember_object: async (params) => {
        if (!settings.memoryEnabled) return "Memory is disabled by user.";
        const name = String(params.name ?? "unknown");
        const description = String(params.description ?? "");
        saveMemory(name, description);
        return `Remembered "${name}" for future sessions.`;
      },
      search_knowledge_base: async (params) => {
        const query = String(params.query ?? "");
        const matches = searchMemories(query);
        if (matches.length === 0) return "No matching memories found.";
        return JSON.stringify(
          matches.map((m) => ({ name: m.name, description: m.description }))
        );
      },
      zoom_camera: async (params) => {
        const factor = Math.max(1, Math.min(3, Number(params.factor ?? 1.5)));
        const duration = Math.min(15000, Number(params.duration_ms ?? 6000));
        setZoomLevel(factor);
        clearTimeout(zoomTimerRef.current);
        zoomTimerRef.current = setTimeout(() => setZoomLevel(1), duration);
        return `Zoomed to ${factor}x for ${duration}ms.`;
      },
      alert_user: async (params) => {
        const message = String(params.message ?? "Alert");
        const urgency = (["low", "medium", "high"].includes(String(params.urgency))
          ? String(params.urgency)
          : "medium") as AlertData["urgency"];
        setActiveAlert({ message, urgency });
        clearTimeout(alertTimerRef.current);
        if (urgency !== "high") {
          alertTimerRef.current = setTimeout(() => setActiveAlert(null), 8000);
        }
        logAlertTriggered(message, urgency);
        return `Alert shown: [${urgency}] ${message}`;
      },
      set_goal: async (params) => {
        if (!settings.memoryEnabled) return "Memory is disabled by user.";
        const name = String(params.name ?? "goal");
        const description = String(params.description ?? "");
        const milestones = Array.isArray(params.milestones) ? params.milestones.map(String) : [];
        saveGoal(name, description, milestones);
        return `Goal "${name}" set with ${milestones.length} milestones.`;
      },
      complete_milestone: async (params) => {
        const goalName = String(params.goal_name ?? "");
        const milestone = String(params.milestone ?? "");
        completeGoalMilestone(goalName, milestone);
        return `Milestone "${milestone}" completed for goal "${goalName}".`;
      },
      search_goals: async () => {
        const goals = loadGoals().filter((g) => g.active);
        if (goals.length === 0) return "No active goals.";
        return JSON.stringify(
          goals.map((g) => ({
            name: g.name,
            description: g.description,
            progress: `${g.completedMilestones.length}/${g.milestones.length}`,
          }))
        );
      },
      delegate_to_specialist: async (params) => {
        const specialist = String(params.specialist ?? "general");
        const task = String(params.task ?? "");
        const immersionNote = settings.isiZuluImmersion
          ? " Respond primarily in isiZulu with English gloss."
          : "";
        try {
          const { data, error } = await supabase.functions.invoke("specialist-delegation", {
            body: { specialist, task: task + immersionNote, context: [] },
          });
          if (error) return `Specialist error: ${error.message}`;
          const result = data?.analysis ?? "No analysis available.";
          logSpecialistDelegation(specialist, task, result);
          return `[${specialist}]: ${result}${data?.isizulu_note ? ` (${data.isizulu_note})` : ""}`;
        } catch {
          return `Specialist delegation failed.`;
        }
      },
      describe_in_isizulu: async (params) => {
        const subject = String(params.subject ?? "this object");
        try {
          const { data, error } = await supabase.functions.invoke("specialist-delegation", {
            body: {
              specialist: "heritage",
              task: `Describe "${subject}" primarily in isiZulu. Provide the isiZulu description first, then a brief English gloss. Include cultural significance, relevant proverbs (izaga), and symbolic meaning.`,
              context: [],
            },
          });
          if (error) return `Heritage specialist error: ${error.message}`;
          const result = data?.analysis ?? "Akukho ncazelo.";
          logSpecialistDelegation("heritage", `describe_in_isizulu: ${subject}`, result);
          return `[isiZulu]: ${result}${data?.isizulu_note ? `\n${data.isizulu_note}` : ""}`;
        } catch {
          return "Heritage specialist unavailable.";
        }
      },
    });
  }, [agent, settings.memoryEnabled, settings.isiZuluImmersion]);

  // Listen for proactive + gesture + transcript events from the adapter
  useEffect(() => {
    const unsub = adapter.on((event) => {
      if (
        event.type === "proactive" &&
        event.confidence >= proactiveThreshold &&
        !isSpeaking
      ) {
        const now = Date.now();
        if (now - lastProactiveRef.current < PROACTIVE_MIN_INTERVAL) return;
        lastProactiveRef.current = now;
        setProactiveText(event.text);
        logProactiveTrigger(event.text, event.confidence);
        setTimeout(() => setProactiveText(null), 8000);
      }
      if (event.type === "gesture") {
        setActiveGesture(event.gesture as any);
        clearTimeout(gestureTimerRef.current);
        gestureTimerRef.current = setTimeout(() => setActiveGesture(null), 5000);
        // Collect for reflection context
        gesturesRef.current.push({
          type: event.gesture.type,
          x: event.gesture.x,
          y: event.gesture.y,
          label_zu: event.gesture.label_zu,
          label_en: event.gesture.label_en,
        });
        if (gesturesRef.current.length > 10) gesturesRef.current.shift();
        // Trigger reflection on open_palm hold gesture
        if (event.gesture.type === "open_palm" && settings.reflectionMode) {
          triggerReflection();
        }
      }
      if (event.type === "transcript") {
        transcriptsRef.current.push({ role: event.entry.role, text: event.entry.text });
        if (transcriptsRef.current.length > 20) transcriptsRef.current.shift();
        // Collect vision descriptions from agent transcripts
        if (event.entry.role === "agent") {
          visionDescriptionsRef.current.push(event.entry.text);
          if (visionDescriptionsRef.current.length > 10) visionDescriptionsRef.current.shift();
        }
      }
    });
    return unsub;
  }, [adapter, isSpeaking, proactiveThreshold, settings.reflectionMode]);

  // Autonomous reflection trigger — every 2.5 min of idle when reflection mode on
  const triggerReflection = useCallback(async () => {
    if (activeReflection) return; // Don't overlap
    if (transcriptsRef.current.length === 0 && visionDescriptionsRef.current.length === 0) return;

    try {
      const goals = loadGoals().filter((g) => g.active);
      const memories = searchMemories("").slice(-5);
      const lang = settings.panAfricanMode ? settings.panAfricanLanguage : (settings.isiZuluImmersion ? "isizulu" : "isizulu");

      const { data, error } = await supabase.functions.invoke("sovereign-reflection", {
        body: {
          transcripts: transcriptsRef.current.slice(-10),
          vision_descriptions: visionDescriptionsRef.current.slice(-5),
          gestures: gesturesRef.current.slice(-5),
          goals: goals.map((g) => ({ name: g.name, description: g.description, milestones: g.milestones, completedMilestones: g.completedMilestones })),
          memories: memories.map((m) => ({ name: m.name, description: m.description })),
          target_language: lang,
          community_query: settings.ubuntuDataSharing ? true : null,
        },
      });

      if (error) {
        console.error("[Reflection] Error:", error.message);
        return;
      }

      if (data) {
        const reflection: ReflectionEvent = {
          summary: data.summary || "",
          summary_en: data.summary_en,
          proverb: data.proverb || "Umuntu ngumuntu ngabantu.",
          goal_update: data.goal_update,
          overlays: data.overlays || [],
          community_echo: data.community_echo,
          source: data.source || "sovereign-reflection",
        };
        setActiveReflection(reflection);
        shadowLog("reflection_triggered", {
          proverb: reflection.proverb,
          overlay_count: reflection.overlays.length,
          has_community: !!reflection.community_echo,
          sovereign_beta: settings.sovereignBeta,
        });
        // Auto-dismiss after 20s
        setTimeout(() => setActiveReflection(null), 20000);
      }
    } catch (err) {
      console.error("[Reflection] Failed:", err);
    }
  }, [activeReflection, settings]);

  // Idle reflection timer
  useEffect(() => {
    if (isConnected && settings.reflectionMode && !isSpeaking) {
      reflectionTimerRef.current = setInterval(() => {
        if (!isSpeaking && !isListening) {
          triggerReflection();
        }
      }, 150_000); // 2.5 minutes
      return () => clearInterval(reflectionTimerRef.current);
    } else {
      clearInterval(reflectionTimerRef.current);
    }
  }, [isConnected, settings.reflectionMode, isSpeaking, isListening, triggerReflection]);

  // Offline goal reminders — cycle through active goals when in local mode
  useEffect(() => {
    if (localMode && isConnected && settings.memoryEnabled) {
      const reminders = getGoalReminders();
      if (reminders.length === 0) return;
      let idx = 0;
      // Show first reminder after 5s
      const showNext = () => {
        setGoalReminder(reminders[idx % reminders.length]);
        idx++;
        setTimeout(() => setGoalReminder(null), 6000);
      };
      const timeout = setTimeout(showNext, 5000);
      goalReminderTimerRef.current = setInterval(showNext, 45000); // every 45s
      return () => {
        clearTimeout(timeout);
        clearInterval(goalReminderTimerRef.current);
        setGoalReminder(null);
      };
    } else {
      setGoalReminder(null);
      clearInterval(goalReminderTimerRef.current);
    }
  }, [localMode, isConnected, settings.memoryEnabled]);

  const dismissFrozen = useCallback(() => {
    setFrozenFrame(null);
    clearTimeout(freezeTimerRef.current);
  }, []);

  const dismissAlert = useCallback(() => {
    setActiveAlert(null);
    clearTimeout(alertTimerRef.current);
  }, []);

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

  const startSession = useCallback(async () => {
    setIsConnecting(true);
    try {
      // CRITICAL: getUserMedia must be called first, directly in click handler
      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        setCameraActive(true);
      } catch {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch (micErr) {
          toast.error("Microphone required", {
            description: "Agent Zulu needs microphone access to start a voice session. Please connect a microphone and allow access.",
          });
          setIsConnecting(false);
          return;
        }
      }
      setMediaStream(stream);
      setMicActive(true);

      const { data, error } = await supabase.functions.invoke("elevenlabs-conversation-token");
      if (error || !data?.signed_url) {
        stream?.getTracks().forEach((t) => t.stop());
        setMediaStream(null);
        throw new Error(error?.message || "No signed URL received");
      }

      await agent.connect({ signed_url: data.signed_url });
      startShadowSession();
      setShowStartScreen(false);
    } catch (err) {
      console.error("Failed to start session:", err);
      toast.error("Connection failed", {
        description: err instanceof Error ? err.message : "Could not connect to Agent Zulu. Please try again.",
      });
      setIsConnecting(false);
    }
  }, [agent]);

  const endSession = useCallback(async () => {
    await agent.disconnect();
    endShadowSession();
    mediaStream?.getTracks().forEach((t) => t.stop());
    setMediaStream(null);
    setCameraActive(false);
    setShowStartScreen(true);
    setPointer(null);
    setFrozenFrame(null);
    setZoomLevel(1);
    setProactiveText(null);
    setActiveAlert(null);
    setGoalReminder(null);
    setActiveReflection(null);
    transcriptsRef.current = [];
    visionDescriptionsRef.current = [];
    gesturesRef.current = [];
    clearInterval(reflectionTimerRef.current);
  }, [agent, mediaStream]);

  const toggleMic = useCallback(() => {
    if (mediaStream) {
      const audioTracks = mediaStream.getAudioTracks();
      audioTracks.forEach((t) => (t.enabled = !t.enabled));
      const newState = !micActive;
      setMicActive(newState);
      agent.setMicMuted(!newState);
    }
  }, [mediaStream, micActive, agent]);

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
              Sovereign AI Cockpit
            </motion.p>

            <motion.button
              onClick={startSession}
              disabled={isConnecting}
              className="relative group rounded-full w-20 h-20 flex items-center justify-center bg-primary/10 border border-primary/40 text-primary transition-colors hover:bg-primary/20 disabled:opacity-50"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.6, type: "spring" }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
            >
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
              {isConnecting ? "Connecting…" : "Tap to connect"}
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

            {/* Alert overlay with feedback */}
            <AlertOverlay
              alert={activeAlert}
              onDismiss={dismissAlert}
              onFeedback={(rating) => {
                if (activeAlert) handleFeedback("alert", activeAlert.message, rating);
                dismissAlert();
              }}
            />

            {/* Settings panel */}
            <SettingsPanel onSettingsChange={handleSettingsChange} />

            {/* Avatar area */}
            <div className="absolute inset-0 flex items-center justify-center">
              <AvatarDisplay
                isListening={isListening}
                isSpeaking={isSpeaking}
                isConnected={isConnected}
                emotion={agent.avatarState.emotion}
                intensity={agent.avatarState.intensity}
                localMode={localMode}
              />
            </div>

            {/* Proactive suggestion bubble with feedback */}
            <AnimatePresence>
              {proactiveText && (
                <motion.div
                  className="absolute bottom-40 left-1/2 -translate-x-1/2 z-30 max-w-xs"
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                >
                  <div className="glass-surface rounded-lg px-4 py-2.5 border border-primary/30">
                    {settings.sovereignBeta && (
                      <span className="inline-block font-mono text-[8px] tracking-[0.2em] text-primary/80 bg-primary/10 rounded px-1.5 py-0.5 mb-1">
                        SOVEREIGN β
                      </span>
                    )}
                    <p className="font-mono text-xs text-foreground/80 leading-relaxed">
                      {proactiveText}
                    </p>
                    <div className="flex items-center justify-end gap-1 mt-1.5">
                      <button
                        onClick={() => {
                          handleFeedback("proactive", proactiveText, "up");
                          setProactiveText(null);
                        }}
                        className="p-1 rounded text-muted-foreground hover:text-primary transition-colors"
                      >
                        <ThumbsUp className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => {
                          handleFeedback("proactive", proactiveText, "down");
                          setProactiveText(null);
                        }}
                        className="p-1 rounded text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <ThumbsDown className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-primary/20 rotate-45 border-r border-b border-primary/30" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Offline goal reminder bubble */}
            <AnimatePresence>
              {goalReminder && (
                <motion.div
                  className="absolute bottom-28 left-1/2 -translate-x-1/2 z-30 max-w-xs"
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                >
                  <div className="glass-surface rounded-lg px-4 py-2 border border-accent/30">
                    <p className="font-mono text-[10px] text-accent/80 leading-relaxed">
                      {goalReminder}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <CameraPreview
              stream={mediaStream}
              isActive={cameraActive}
              pointer={pointer}
              frozenFrame={frozenFrame}
              onDismissFrozen={dismissFrozen}
              zoomLevel={zoomLevel}
              gesture={activeGesture}
            />
            <VisionLoop
              ref={visionLoopRef}
              mediaStream={mediaStream}
              vision={agent.vision}
              voiceActive={isSpeaking || isListening}
              onLocalModeChange={setLocalMode}
            />
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
