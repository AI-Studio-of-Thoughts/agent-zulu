/**
 * Sovereign Analytics Dashboard — Visualizes session_logs data
 * and Community Data Flywheel stats.
 */

import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Activity, Globe, Zap, Brain, Cpu, Users, Heart, Sparkles, BookOpen } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, LineChart, Line,
  ResponsiveContainer,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { fetchCommunityStats, type CommunityStats } from "@/lib/community-flywheel";

interface SessionLog {
  id: string;
  event_type: string;
  payload: any;
  created_at: string;
  session_id: string;
}

const CHART_COLORS = [
  "hsl(185, 100%, 50%)", // primary cyan
  "hsl(280, 80%, 60%)",  // purple
  "hsl(45, 90%, 55%)",   // gold
  "hsl(140, 70%, 45%)",  // green
  "hsl(10, 80%, 55%)",   // red
];

const Analytics = () => {
  const navigate = useNavigate();
  const [logs, setLogs] = useState<SessionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [communityStats, setCommunityStats] = useState<CommunityStats | null>(null);

  useEffect(() => {
    const fetchAll = async () => {
      const [logsResult, community] = await Promise.all([
        supabase
          .from("session_logs")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(500),
        fetchCommunityStats(),
      ]);

      if (!logsResult.error && logsResult.data) {
        setLogs(logsResult.data as SessionLog[]);
      }
      setCommunityStats(community);
      setLoading(false);
    };
    fetchAll();
  }, []);

  // Computed analytics
  const stats = useMemo(() => {
    const sovereignLogs = logs.filter((l) => l.event_type === "sovereign_inference");
    const fallbackLogs = logs.filter((l) => l.event_type === "sovereign_fallback");
    const onDeviceLogs = logs.filter((l) => l.event_type === "on_device_inference");
    const shadowLogs = logs.filter((l) => l.event_type === "shadow_comparison");
    const gestureLogs = logs.filter((l) => l.event_type === "gesture_detected");
    const feedbackLogs = logs.filter((l) => l.event_type === "user_feedback");
    const toggleLogs = logs.filter((l) => l.event_type === "sovereign_toggle");
    const latencyGuardLogs = logs.filter((l) => l.event_type === "sovereign_latency_guard");
    const reflectionLogs = logs.filter((l) => l.event_type === "reflection_triggered");

    // Latency data
    const sovereignLatencies = sovereignLogs
      .map((l) => l.payload?.latency)
      .filter((l): l is number => typeof l === "number");
    const avgSovereignLatency = sovereignLatencies.length
      ? Math.round(sovereignLatencies.reduce((a, b) => a + b, 0) / sovereignLatencies.length)
      : 0;

    // Source distribution
    const sourceData = [
      { name: "Sovereign", value: sovereignLogs.length, color: CHART_COLORS[0] },
      { name: "Gemini Fallback", value: fallbackLogs.length, color: CHART_COLORS[1] },
      { name: "On-Device", value: onDeviceLogs.length, color: CHART_COLORS[2] },
    ].filter((d) => d.value > 0);

    // Event type breakdown
    const eventCounts: Record<string, number> = {};
    logs.forEach((l) => {
      eventCounts[l.event_type] = (eventCounts[l.event_type] || 0) + 1;
    });
    const eventData = Object.entries(eventCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    // Latency over time (last 20 sovereign calls)
    const latencyTimeline = sovereignLogs
      .slice(0, 20)
      .reverse()
      .map((l, i) => ({
        idx: i + 1,
        latency: l.payload?.latency || 0,
        emotion: l.payload?.emotion || "neutral",
      }));

    // Cultural depth signals
    const withNotesZu = sovereignLogs.filter((l) => l.payload?.has_notes_zu).length;
    const withSovereigntySignal = sovereignLogs.filter((l) => l.payload?.has_sovereignty_signal).length;

    // Feedback
    const thumbsUp = feedbackLogs.filter((l) => l.payload?.rating === "up").length;
    const thumbsDown = feedbackLogs.filter((l) => l.payload?.rating === "down").length;

    // Reflection moments — last 10
    const reflectionMoments = reflectionLogs.slice(0, 10).map((l) => ({
      id: l.id,
      proverb: l.payload?.proverb || "—",
      has_poem: !!l.payload?.has_poem,
      has_community: !!l.payload?.has_community,
      has_prediction: !!l.payload?.has_prediction,
      prediction_confidence: l.payload?.prediction_confidence || 0,
      overlay_count: l.payload?.overlay_count || 0,
      created_at: l.created_at,
    }));

    return {
      total: logs.length,
      sovereign: sovereignLogs.length,
      fallback: fallbackLogs.length,
      onDevice: onDeviceLogs.length,
      shadow: shadowLogs.length,
      gestures: gestureLogs.length,
      toggles: toggleLogs.length,
      latencyGuards: latencyGuardLogs.length,
      reflections: reflectionLogs.length,
      avgSovereignLatency,
      sourceData,
      eventData,
      latencyTimeline,
      withNotesZu,
      withSovereigntySignal,
      thumbsUp,
      thumbsDown,
      reflectionMoments,
    };
  }, [logs]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <motion.header
        className="border-b border-border/30 px-6 py-4 flex items-center gap-4"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <button
          onClick={() => navigate("/")}
          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="font-display text-lg tracking-[0.15em] text-foreground">
            SOVEREIGN ANALYTICS
          </h1>
          <p className="font-mono text-[10px] tracking-[0.3em] text-muted-foreground uppercase">
            Agent Zulu Intelligence Dashboard
          </p>
        </div>
      </motion.header>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="font-mono text-sm text-muted-foreground animate-pulse">
              Loading analytics...
            </div>
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <Activity className="w-8 h-8 text-muted-foreground" />
            <p className="font-mono text-sm text-muted-foreground">
              No session data yet. Start a session with Sovereign Beta ON to generate analytics.
            </p>
          </div>
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard icon={Activity} label="Total Events" value={stats.total} />
              <StatCard icon={Zap} label="Sovereign Calls" value={stats.sovereign} accent />
              <StatCard icon={Brain} label="Gemini Fallbacks" value={stats.fallback} />
              <StatCard icon={Cpu} label="On-Device" value={stats.onDevice} />
            </div>

            {/* Latency + Source row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Sovereign Latency Over Time */}
              <ChartCard title="Sovereign Latency (ms)" subtitle="Last 20 calls">
                {stats.latencyTimeline.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={stats.latencyTimeline}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(185 20% 20%)" />
                      <XAxis dataKey="idx" tick={{ fontSize: 10, fill: "hsl(185 20% 50%)" }} />
                      <YAxis tick={{ fontSize: 10, fill: "hsl(185 20% 50%)" }} />
                      <Tooltip
                        contentStyle={{
                          background: "hsl(220 20% 10%)",
                          border: "1px solid hsl(185 40% 30%)",
                          borderRadius: 8,
                          fontSize: 11,
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="latency"
                        stroke="hsl(185, 100%, 50%)"
                        strokeWidth={2}
                        dot={{ fill: "hsl(185, 100%, 50%)", r: 3 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <NoData />
                )}
              </ChartCard>

              {/* Source Distribution */}
              <ChartCard title="Inference Source" subtitle="Sovereign vs Fallback vs On-Device">
                {stats.sourceData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={stats.sourceData}
                        cx="50%"
                        cy="50%"
                        outerRadius={70}
                        innerRadius={35}
                        dataKey="value"
                        label={({ name, percent }) =>
                          `${name} ${(percent * 100).toFixed(0)}%`
                        }
                        labelLine={false}
                      >
                        {stats.sourceData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <NoData />
                )}
              </ChartCard>
            </div>

            {/* Event Breakdown + Cultural Depth */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Event Type Breakdown */}
              <ChartCard title="Event Types" subtitle="Top 8 by frequency">
                {stats.eventData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={stats.eventData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(185 20% 20%)" />
                      <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(185 20% 50%)" }} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={130}
                        tick={{ fontSize: 9, fill: "hsl(185 20% 50%)" }}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "hsl(220 20% 10%)",
                          border: "1px solid hsl(185 40% 30%)",
                          borderRadius: 8,
                          fontSize: 11,
                        }}
                      />
                      <Bar dataKey="value" fill="hsl(185, 100%, 50%)" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <NoData />
                )}
              </ChartCard>

              {/* Cultural Depth Metrics */}
              <ChartCard title="Cultural Depth" subtitle="Sovereign quality signals">
                <div className="space-y-4 py-4">
                  <MetricBar
                    label="isiZulu Notes (notes_zu)"
                    value={stats.withNotesZu}
                    total={stats.sovereign}
                  />
                  <MetricBar
                    label="Sovereignty Signal"
                    value={stats.withSovereigntySignal}
                    total={stats.sovereign}
                  />
                  <MetricBar
                    label="Avg Latency"
                    value={stats.avgSovereignLatency}
                    total={10000}
                    suffix="ms"
                    invert
                  />
                  <div className="flex gap-6 pt-2">
                    <div className="font-mono text-xs text-muted-foreground">
                      👍 {stats.thumbsUp}
                    </div>
                    <div className="font-mono text-xs text-muted-foreground">
                      👎 {stats.thumbsDown}
                    </div>
                    <div className="font-mono text-xs text-muted-foreground">
                      🖐 {stats.gestures} gestures
                    </div>
                    <div className="font-mono text-xs text-muted-foreground">
                      ⚡ {stats.latencyGuards} guards
                    </div>
                  </div>
                </div>
              </ChartCard>
            </div>
          </>
        )}

        {/* Community Data Flywheel Section */}
        {communityStats && (
          <div className="space-y-6 pt-4">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="border-t border-border/30 pt-6"
            >
              <div className="flex items-center gap-3 mb-6">
                <Users className="w-5 h-5 text-primary" />
                <div>
                  <h2 className="font-display text-sm tracking-[0.15em] text-foreground">
                    UBUNTU DATA FLYWHEEL
                  </h2>
                  <p className="font-mono text-[9px] tracking-[0.2em] text-muted-foreground uppercase">
                    Umuntu ngumuntu ngabantu — Collective sovereign intelligence
                  </p>
                </div>
              </div>

              {/* Community KPIs */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <StatCard icon={Heart} label="Contributions" value={communityStats.totalContributions} accent />
                <StatCard icon={Users} label="Unique Devices" value={communityStats.uniqueDevices} />
                <StatCard icon={Activity} label="Sessions" value={communityStats.uniqueSessions} />
                <StatCard icon={Zap} label="Last 24h" value={communityStats.recentActivity} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Language Distribution */}
                <ChartCard title="Language Distribution" subtitle="Community language diversity">
                  {communityStats.languageDistribution.length > 0 ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={communityStats.languageDistribution}
                          cx="50%"
                          cy="50%"
                          outerRadius={70}
                          innerRadius={35}
                          dataKey="value"
                          label={({ name, percent }) =>
                            `${name} ${(percent * 100).toFixed(0)}%`
                          }
                          labelLine={false}
                        >
                          {communityStats.languageDistribution.map((_, i) => (
                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <NoData />
                  )}
                </ChartCard>

                {/* Community Event Types */}
                <ChartCard title="Community Events" subtitle="What the collective is sharing">
                  {communityStats.topEventTypes.length > 0 ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={communityStats.topEventTypes} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(185 20% 20%)" />
                        <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(185 20% 50%)" }} />
                        <YAxis
                          type="category"
                          dataKey="name"
                          width={130}
                          tick={{ fontSize: 9, fill: "hsl(185 20% 50%)" }}
                        />
                        <Tooltip
                          contentStyle={{
                            background: "hsl(220 20% 10%)",
                            border: "1px solid hsl(185 40% 30%)",
                            borderRadius: 8,
                            fontSize: 11,
                          }}
                        />
                        <Bar dataKey="value" fill="hsl(280, 80%, 60%)" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <NoData />
                  )}
                </ChartCard>
              </div>

              {/* Region map */}
              {communityStats.regionDistribution.length > 0 && (
                <ChartCard title="Regional Distribution" subtitle="Where the community shares from">
                  <div className="flex flex-wrap gap-3 py-4">
                    {communityStats.regionDistribution.map((r, i) => (
                      <div
                        key={r.name}
                        className="glass-surface rounded-lg px-3 py-2 border border-border/30"
                      >
                        <div className="font-mono text-[10px] text-muted-foreground">{r.name}</div>
                        <div className="font-display text-lg text-primary">{r.value}</div>
                      </div>
                    ))}
                  </div>
                </ChartCard>
              )}
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
};

// Sub-components

const StatCard = ({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof Activity;
  label: string;
  value: number;
  accent?: boolean;
}) => (
  <motion.div
    className="glass-surface rounded-xl p-4 border border-border/30"
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
  >
    <div className="flex items-center gap-2 mb-2">
      <Icon className={`w-4 h-4 ${accent ? "text-primary" : "text-muted-foreground"}`} />
      <span className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
        {label}
      </span>
    </div>
    <div className={`font-display text-2xl tracking-wider ${accent ? "text-primary" : "text-foreground"}`}>
      {value.toLocaleString()}
    </div>
  </motion.div>
);

const ChartCard = ({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) => (
  <motion.div
    className="glass-surface rounded-xl p-5 border border-border/30"
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
  >
    <h3 className="font-display text-sm tracking-[0.1em] text-foreground/80 mb-0.5">{title}</h3>
    <p className="font-mono text-[9px] tracking-wider text-muted-foreground uppercase mb-4">
      {subtitle}
    </p>
    {children}
  </motion.div>
);

const MetricBar = ({
  label,
  value,
  total,
  suffix = "",
  invert = false,
}: {
  label: string;
  value: number;
  total: number;
  suffix?: string;
  invert?: boolean;
}) => {
  const pct = total > 0 ? Math.min(100, (value / total) * 100) : 0;
  const displayPct = invert ? Math.max(0, 100 - pct) : pct;

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="font-mono text-[10px] text-muted-foreground">{label}</span>
        <span className="font-mono text-[10px] text-primary">
          {value.toLocaleString()}{suffix} {!invert && total > 0 ? `(${pct.toFixed(0)}%)` : ""}
        </span>
      </div>
      <div className="h-1.5 bg-muted/30 rounded-full overflow-hidden">
        <div
          className="h-full bg-primary/60 rounded-full transition-all"
          style={{ width: `${displayPct}%` }}
        />
      </div>
    </div>
  );
};

const NoData = () => (
  <div className="flex items-center justify-center h-[200px]">
    <span className="font-mono text-[10px] text-muted-foreground">No data yet</span>
  </div>
);

export default Analytics;
