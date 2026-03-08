import { motion, AnimatePresence } from "framer-motion";
import { Settings, X, Brain, MessageSquare, Trash2, Database, Languages, FlaskConical, Shield, Globe } from "lucide-react";
import { useState, useCallback } from "react";
import {
  loadSettings,
  saveSettings,
  clearMemories,
  clearGoals,
  loadMemories,
  loadGoals,
  type AgentSettings,
  type AfricanLanguage,
} from "@/lib/agent-memory";

interface SettingsPanelProps {
  onSettingsChange?: (settings: AgentSettings) => void;
}

const SettingsPanel = ({ onSettingsChange }: SettingsPanelProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [settings, setSettings] = useState<AgentSettings>(loadSettings);
  const [memCount] = useState(() => loadMemories().length);
  const [goalCount] = useState(() => loadGoals().length);

  const update = useCallback(
    (patch: Partial<AgentSettings>) => {
      const next = { ...settings, ...patch };
      setSettings(next);
      saveSettings(patch);
      onSettingsChange?.(next);
    },
    [settings, onSettingsChange]
  );

  const handleClearMemory = useCallback(() => {
    clearMemories();
    clearGoals();
  }, []);

  const proactivityOptions: { value: AgentSettings["proactivityLevel"]; label: string }[] = [
    { value: "off", label: "Off" },
    { value: "low", label: "Low" },
    { value: "medium", label: "Medium" },
    { value: "high", label: "High" },
  ];

  const Toggle = ({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) => (
    <button
      onClick={onToggle}
      className={`relative w-10 h-5 rounded-full transition-colors ${
        enabled ? "bg-primary/40" : "bg-muted"
      }`}
    >
      <div
        className={`absolute top-0.5 w-4 h-4 rounded-full transition-all ${
          enabled ? "left-5.5 bg-primary" : "left-0.5 bg-muted-foreground"
        }`}
      />
    </button>
  );

  return (
    <>
      <motion.button
        onClick={() => setIsOpen(true)}
        className="absolute top-6 left-6 glass-surface rounded-full p-3 text-muted-foreground hover:text-foreground transition-colors z-20"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
      >
        <Settings className="w-4 h-4" />
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="absolute inset-0 z-40 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div
              className="absolute inset-0 bg-background/60 backdrop-blur-sm"
              onClick={() => setIsOpen(false)}
            />

            <motion.div
              className="relative glass-surface rounded-2xl p-6 w-80 max-w-[90vw] max-h-[80vh] overflow-y-auto border border-border/50"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-display text-sm tracking-[0.2em] text-foreground/80">
                  SETTINGS
                </h3>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-5">
                {/* Memory Toggle */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Brain className="w-4 h-4 text-primary" />
                    <span className="font-mono text-xs text-foreground/70">Memory</span>
                  </div>
                  <Toggle
                    enabled={settings.memoryEnabled}
                    onToggle={() => update({ memoryEnabled: !settings.memoryEnabled })}
                  />
                </div>

                {settings.memoryEnabled && (
                  <div className="pl-6 font-mono text-[10px] text-muted-foreground">
                    {memCount} memories · {goalCount} goals stored
                  </div>
                )}

                {/* Proactivity Level */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <MessageSquare className="w-4 h-4 text-primary" />
                    <span className="font-mono text-xs text-foreground/70">Proactivity</span>
                  </div>
                  <div className="flex gap-1.5">
                    {proactivityOptions.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => update({ proactivityLevel: opt.value })}
                        className={`flex-1 py-1.5 rounded-lg font-mono text-[10px] tracking-wider transition-all ${
                          settings.proactivityLevel === opt.value
                            ? "bg-primary/20 text-primary border border-primary/40"
                            : "bg-muted/50 text-muted-foreground border border-transparent hover:border-border"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* isiZulu Immersion */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Languages className="w-4 h-4 text-primary" />
                    <div>
                      <span className="font-mono text-xs text-foreground/70">isiZulu Immersion</span>
                      <p className="font-mono text-[9px] text-muted-foreground mt-0.5">
                        Responses in isiZulu first
                      </p>
                    </div>
                  </div>
                  <Toggle
                    enabled={settings.isiZuluImmersion}
                    onToggle={() => update({ isiZuluImmersion: !settings.isiZuluImmersion })}
                  />
                </div>

                {/* Sovereign Training Toggle */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-primary" />
                    <div>
                      <span className="font-mono text-xs text-foreground/70">Sovereign Training</span>
                      <p className="font-mono text-[9px] text-muted-foreground mt-0.5">
                        Contribute anonymized data
                      </p>
                    </div>
                  </div>
                  <Toggle
                    enabled={settings.sovereignTraining}
                    onToggle={() => update({ sovereignTraining: !settings.sovereignTraining })}
                  />
                </div>

                {/* Shadow Comparison Toggle */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FlaskConical className="w-4 h-4 text-primary" />
                    <div>
                      <span className="font-mono text-xs text-foreground/70">Shadow Comparison</span>
                      <p className="font-mono text-[9px] text-muted-foreground mt-0.5">
                        Compare AI models silently
                      </p>
                    </div>
                  </div>
                  <Toggle
                    enabled={settings.shadowComparison}
                    onToggle={() => update({ shadowComparison: !settings.shadowComparison })}
                  />
                </div>

                {/* Sovereign Beta Toggle */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-primary" />
                    <div>
                      <span className="font-mono text-xs text-foreground/70">Sovereign Beta</span>
                      <p className="font-mono text-[9px] text-muted-foreground mt-0.5">
                        Heritage-first isiZulu vision
                      </p>
                    </div>
                  </div>
                  <Toggle
                    enabled={settings.sovereignBeta}
                    onToggle={() => update({ sovereignBeta: !settings.sovereignBeta })}
                  />
                </div>

                {settings.sovereignBeta && (
                  <div className="pl-6 font-mono text-[9px] text-primary/60 border-l border-primary/20 ml-2">
                    ⚡ Vision routed through sovereign heritage engine.
                    <br />
                    Requires reconnect to take effect.
                  </div>
                )}

                {/* Pan-African Mode */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-primary" />
                    <div>
                      <span className="font-mono text-xs text-foreground/70">Pan-African Mode</span>
                      <p className="font-mono text-[9px] text-muted-foreground mt-0.5">
                        Multi-language African immersion
                      </p>
                    </div>
                  </div>
                  <Toggle
                    enabled={settings.panAfricanMode}
                    onToggle={() => update({ panAfricanMode: !settings.panAfricanMode })}
                  />
                </div>

                {settings.panAfricanMode && (
                  <div className="pl-6 space-y-2">
                    <div className="flex gap-1.5 flex-wrap">
                      {([
                        { value: "auto" as AfricanLanguage, label: "Auto" },
                        { value: "isizulu" as AfricanLanguage, label: "isiZulu" },
                        { value: "swahili" as AfricanLanguage, label: "Kiswahili" },
                        { value: "xhosa" as AfricanLanguage, label: "isiXhosa" },
                        { value: "yoruba" as AfricanLanguage, label: "Yorùbá" },
                      ]).map((lang) => (
                        <button
                          key={lang.value}
                          onClick={() => update({ panAfricanLanguage: lang.value })}
                          className={`py-1 px-2 rounded-lg font-mono text-[10px] tracking-wider transition-all ${
                            settings.panAfricanLanguage === lang.value
                              ? "bg-primary/20 text-primary border border-primary/40"
                              : "bg-muted/50 text-muted-foreground border border-transparent hover:border-border"
                          }`}
                        >
                          {lang.label}
                        </button>
                      ))}
                    </div>
                    <p className="font-mono text-[9px] text-primary/60 border-l border-primary/20 pl-2">
                      🌍 Sovereign vision adapts proverbs & symbolism to selected culture.
                    </p>
                  </div>
                )}

                {/* Clear Data */}
                <button
                  onClick={handleClearMemory}
                  className="flex items-center gap-2 w-full py-2 px-3 rounded-lg bg-destructive/10 text-destructive/70 hover:text-destructive hover:bg-destructive/20 transition-colors font-mono text-[10px] tracking-wider"
                >
                  <Trash2 className="w-3 h-3" />
                  CLEAR ALL MEMORIES & GOALS
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default SettingsPanel;
