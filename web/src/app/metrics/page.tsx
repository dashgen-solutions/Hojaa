"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  getAllMetrics,
  getAIUsageMetrics,
  platformAdminLogin,
  platformAdminLogout,
  getPlatformToken,
} from "@/lib/api";
import {
  ChartBarIcon,
  ArrowTrendingUpIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  UserGroupIcon,
  DocumentTextIcon,
  CubeIcon,
  ServerStackIcon,
  ShieldCheckIcon,
  BoltIcon,
  ArrowPathIcon,
  SignalIcon,
  ChevronDownIcon,
  ArrowRightOnRectangleIcon,
  LockClosedIcon,
  SparklesIcon,
  CpuChipIcon,
  CurrencyDollarIcon,
  CircleStackIcon,
} from "@heroicons/react/24/outline";

/* ─── Types ──────────────────────────────────────────────────────────── */

interface FeatureAdoption { sessions: number; pct: number; }

interface ProductMetrics {
  period_days: number;
  session_completion_rate: number;
  target_session_completion_rate: number;
  total_sessions: number;
  completed_sessions: number;
  meeting_notes_avg_per_session: number;
  target_meeting_notes: number;
  total_meeting_notes: number;
  scope_changes_total: number;
  scope_changes_per_session: number;
  target_scope_changes: number;
  total_cards: number;
  cards_per_session: number;
  target_cards_per_session: number;
  avg_days_to_active: number;
  target_days_to_first_export: number;
  retention_rate: number;
  total_users: number;
  recently_active_users: number;
  feature_adoption: Record<string, FeatureAdoption>;
}

interface SatisfactionItem {
  label: string;
  pct?: number;
  sessions_with_scope?: number;
  total_sessions?: number;
  nodes_with_source?: number;
  total_nodes?: number;
  traceability_pct?: number;
  sessions_with_history?: number;
  note?: string;
  available?: boolean;
}

interface SatisfactionMetrics {
  whats_in_scope: SatisfactionItem;
  why_is_this_here: SatisfactionItem;
  what_changed: SatisfactionItem;
  scope_disputes: SatisfactionItem;
  team_alignment: SatisfactionItem;
}

interface SlowestRoute {
  route: string;
  count: number;
  p50_ms: number;
  p95_ms: number;
  p99_ms: number;
}

interface TechnicalMetrics {
  api_p95_ms: number;
  api_p50_ms: number;
  api_p99_ms: number;
  target_api_p95_ms: number;
  ai_processing_p95_ms: number;
  target_ai_processing_ms: number;
  pdf_generation_p95_ms: number;
  target_pdf_generation_ms: number;
  total_requests: number;
  total_errors: number;
  error_rate_pct: number;
  uptime_pct: number;
  target_uptime_pct: number;
  status_code_distribution: Record<string, number>;
  slowest_routes: SlowestRoute[];
  test_coverage_pct: number | null;
  target_test_coverage_pct: number;
  llm_api_costs: number | null;
}

interface TrendDay {
  date: string;
  sessions: number;
  nodes: number;
  changes: number;
  cards: number;
}

interface AITaskUsage {
  calls: number;
  tokens: number;
  cost_usd: number;
  cache_hits?: number;
}

interface AIModelUsage {
  calls: number;
  tokens: number;
  cost_usd: number;
}

interface AIDailyUsage {
  date: string;
  calls: number;
  tokens: number;
  cost_usd: number;
}

interface AIUsageData {
  period_days: number;
  total_calls: number;
  cache_hits: number;
  cache_hit_rate: number;
  total_tokens: number;
  total_prompt_tokens: number;
  total_completion_tokens: number;
  total_cost_usd: number;
  avg_cost_per_call: number;
  avg_tokens_per_call: number;
  by_task: Record<string, AITaskUsage>;
  by_model: Record<string, AIModelUsage>;
  daily: AIDailyUsage[];
}

interface AllMetrics {
  product: ProductMetrics;
  satisfaction: SatisfactionMetrics;
  technical: TechnicalMetrics;
  trends: TrendDay[];
}

/* ─── Constants ──────────────────────────────────────────────────────── */

const PERIOD_OPTIONS = [
  { label: "7 days", value: 7 },
  { label: "30 days", value: 30 },
  { label: "90 days", value: 90 },
  { label: "365 days", value: 365 },
];

const TABS = ["Overview", "Product", "Satisfaction", "Technical", "Trends", "AI Usage"] as const;
type Tab = (typeof TABS)[number];

/* ─── Small helper components ────────────────────────────────────────── */

function StatusDot({ pass }: { pass: boolean }) {
  return (
    <span className={`inline-block w-2.5 h-2.5 rounded-full ${pass ? "bg-success-500" : "bg-danger-500"}`} />
  );
}

function MetricCard({
  label, value, target, unit, icon: Icon, description, inverse,
}: {
  label: string; value: number; target?: number; unit?: string;
  icon: React.ElementType; description?: string; inverse?: boolean;
}) {
  const pass = target !== undefined ? (inverse ? value <= target : value >= target) : true;
  return (
    <div className="card p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-neutral-500">
          <Icon className="w-4 h-4" />
          <span className="text-xs font-medium uppercase tracking-wider">{label}</span>
        </div>
        {target !== undefined && <StatusDot pass={pass} />}
      </div>
      <div className="flex items-end gap-1.5">
        <span className="text-3xl font-bold text-neutral-900">{value}</span>
        {unit && <span className="text-sm text-neutral-400 mb-1">{unit}</span>}
      </div>
      {target !== undefined && (
        <p className="text-xs text-neutral-400">
          Target: {target}{unit ? ` ${unit}` : ""} —{" "}
          <span className={pass ? "text-success-600" : "text-danger-600"}>
            {pass ? "On track" : "Below target"}
          </span>
        </p>
      )}
      {description && <p className="text-xs text-neutral-400">{description}</p>}
    </div>
  );
}

function ProgressBar({ label, pct, detail }: { label: string; pct: number; detail?: string }) {
  const color = pct >= 75 ? "bg-success-500" : pct >= 40 ? "bg-warning-500" : "bg-danger-500";
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-neutral-700 font-medium">{label}</span>
        <span className="text-neutral-500">{pct}%</span>
      </div>
      <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      {detail && <p className="text-xs text-neutral-400">{detail}</p>}
    </div>
  );
}

function MiniBarChart({ data, dataKey, color }: { data: TrendDay[]; dataKey: keyof TrendDay; color: string }) {
  const values = data.map((d) => Number(d[dataKey]));
  const max = Math.max(...values, 1);
  return (
    <div className="flex items-end gap-px h-16">
      {values.map((v, i) => (
        <div
          key={i}
          className={`flex-1 rounded-t ${color} transition-all duration-300`}
          style={{ height: `${(v / max) * 100}%`, minHeight: v > 0 ? 2 : 0 }}
          title={`${data[i].date}: ${v}`}
        />
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   MAIN PAGE — handles its own auth (completely separate from the app)
   ═══════════════════════════════════════════════════════════════════════ */

export default function MetricsPage() {
  /* ── Platform admin auth state ── */
  const [isAuthed, setIsAuthed] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  /* ── Dashboard state ── */
  const [metrics, setMetrics] = useState<AllMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [days, setDays] = useState(30);
  const [activeTab, setActiveTab] = useState<Tab>("Overview");
  const [showPeriodDropdown, setShowPeriodDropdown] = useState(false);
  const [aiUsage, setAIUsage] = useState<AIUsageData | null>(null);
  const [aiUsageLoading, setAIUsageLoading] = useState(false);

  /* ── Check for existing platform token on mount ── */
  useEffect(() => {
    const token = getPlatformToken();
    if (token) {
      setIsAuthed(true);
    }
    setAuthChecking(false);
  }, []);

  /* ── Login handler ── */
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    setLoginLoading(true);
    try {
      await platformAdminLogin(loginEmail, loginPassword);
      setIsAuthed(true);
    } catch (err: any) {
      setLoginError(
        err?.response?.data?.detail || err.message || "Invalid credentials"
      );
    } finally {
      setLoginLoading(false);
    }
  };

  /* ── Logout ── */
  const handleLogout = () => {
    platformAdminLogout();
    setIsAuthed(false);
    setMetrics(null);
  };

  /* ── Fetch metrics ── */
  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getAllMetrics(days);
      setMetrics(data);
    } catch (err: any) {
      if (err?.response?.status === 401) {
        // Token expired — force re-login
        handleLogout();
        return;
      }
      setError(err?.response?.data?.detail || err.message || "Failed to load metrics");
    } finally {
      setLoading(false);
    }
  }, [days]);

  /* ── Fetch AI usage data when tab is active ── */
  const fetchAIUsage = useCallback(async () => {
    setAIUsageLoading(true);
    try {
      const data = await getAIUsageMetrics(days);
      setAIUsage(data);
    } catch (err: any) {
      if (err?.response?.status === 401) { handleLogout(); return; }
      // silently ignore — secondary data
    } finally {
      setAIUsageLoading(false);
    }
  }, [days]);

  useEffect(() => {
    if (isAuthed) fetchMetrics();
  }, [isAuthed, fetchMetrics]);

  useEffect(() => {
    if (isAuthed && activeTab === "AI Usage" && !aiUsage) fetchAIUsage();
  }, [isAuthed, activeTab, aiUsage, fetchAIUsage]);

  /* ═════════════════════════════════════════════════════════════════════
     LOGIN SCREEN (shown when NOT authenticated)
     ═════════════════════════════════════════════════════════════════════ */

  if (authChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <div className="text-center animate-fade-in">
          <div className="relative w-16 h-16 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full border-4 border-neutral-200" />
            <div className="absolute inset-0 rounded-full border-4 border-primary-500 border-t-transparent animate-spin" />
          </div>
          <p className="text-neutral-500 font-medium">Checking access…</p>
        </div>
      </div>
    );
  }

  if (!isAuthed) {
    return (
      <div className="h-screen bg-neutral-50 flex flex-col overflow-hidden">
        {/* Mini header */}
        <header className="shrink-0 p-4">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center shadow-soft-sm">
              <span className="text-white font-bold text-sm">M</span>
            </div>
            <span className="text-lg font-semibold text-neutral-900">MoMetric</span>
          </Link>
        </header>

        {/* Centre login card */}
        <div className="flex-1 flex items-center justify-center px-4 -mt-14">
          <div className="w-full max-w-md">
            <div className="text-center mb-8">
              <div className="w-14 h-14 mx-auto mb-4 bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl flex items-center justify-center shadow-soft">
                <ChartBarIcon className="w-7 h-7 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-neutral-900">Platform Metrics</h1>
              <p className="text-sm text-neutral-500 mt-1">
                App developer access only — no signup required
              </p>
            </div>

            <form onSubmit={handleLogin} className="card p-8 space-y-5">
              {loginError && (
                <div className="p-3 bg-danger-50 border border-danger-200 rounded-xl text-sm text-danger-700">
                  {loginError}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1.5">Email</label>
                <input
                  type="email"
                  className="input"
                  placeholder="admin@mometric.app"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1.5">Password</label>
                <input
                  type="password"
                  className="input"
                  placeholder="••••••••••"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loginLoading}
                className="btn-primary w-full"
              >
                {loginLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Signing in…
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <LockClosedIcon className="w-4 h-4" />
                    Sign in to Dashboard
                  </div>
                )}
              </button>
              <p className="text-xs text-center text-neutral-400">
                Credentials are configured via environment variables
              </p>
            </form>
          </div>
        </div>
      </div>
    );
  }

  /* ═════════════════════════════════════════════════════════════════════
     DASHBOARD (shown when authenticated as platform admin)
     ═════════════════════════════════════════════════════════════════════ */

  const p = metrics?.product;
  const s = metrics?.satisfaction;
  const t = metrics?.technical;
  const trends = metrics?.trends ?? [];

  /* ── Overview Tab ── */
  const renderOverview = () => (
    <div className="space-y-8">
      <div>
        <h3 className="section-title mb-4">Key Performance Indicators</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard label="Session Completion" value={p?.session_completion_rate ?? 0} target={p?.target_session_completion_rate} unit="%" icon={CheckCircleIcon} />
          <MetricCard label="User Retention" value={p?.retention_rate ?? 0} unit="%" icon={UserGroupIcon} description={`${p?.recently_active_users ?? 0} of ${p?.total_users ?? 0} active in 7d`} />
          <MetricCard label="API p95" value={t?.api_p95_ms ?? 0} target={t?.target_api_p95_ms} unit="ms" icon={BoltIcon} inverse />
          <MetricCard label="Uptime" value={t?.uptime_pct ?? 0} target={t?.target_uptime_pct} unit="%" icon={SignalIcon} />
        </div>
      </div>

      {trends.length > 0 && (
        <div>
          <h3 className="section-title mb-4">Activity Trends ({days}d)</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {([
              { key: "sessions" as const, label: "Sessions", color: "bg-primary-400" },
              { key: "nodes" as const, label: "Scope Nodes", color: "bg-success-400" },
              { key: "changes" as const, label: "Scope Changes", color: "bg-warning-400" },
              { key: "cards" as const, label: "Planning Cards", color: "bg-accent-400" },
            ] as const).map(({ key, label, color }) => {
              const total = trends.reduce((acc, d) => acc + Number(d[key]), 0);
              return (
                <div key={key} className="card p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider">{label}</span>
                    <span className="text-lg font-bold text-neutral-900">{total}</span>
                  </div>
                  <MiniBarChart data={trends} dataKey={key} color={color} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <h3 className="section-title mb-4">User Satisfaction Indicators</h3>
        <div className="card p-6 space-y-5">
          {s?.whats_in_scope && <ProgressBar label={s.whats_in_scope.label} pct={s.whats_in_scope.pct ?? 0} detail={`${s.whats_in_scope.sessions_with_scope} of ${s.whats_in_scope.total_sessions} sessions with ≥5 scope nodes`} />}
          {s?.why_is_this_here && <ProgressBar label={s.why_is_this_here.label} pct={s.why_is_this_here.traceability_pct ?? 0} detail={`${s.why_is_this_here.nodes_with_source} of ${s.why_is_this_here.total_nodes} nodes linked to sources`} />}
          {s?.what_changed && <ProgressBar label={s.what_changed.label} pct={s.what_changed.pct ?? 0} detail={`${s.what_changed.sessions_with_history} of ${s.what_changed.total_sessions} sessions with change history`} />}
        </div>
      </div>
    </div>
  );

  /* ── Product Tab ── */
  const renderProduct = () => (
    <div className="space-y-8">
      <div>
        <h3 className="section-title mb-4">Core Product Metrics (METRIC-1.x)</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <MetricCard label="Session Completion" value={p?.session_completion_rate ?? 0} target={p?.target_session_completion_rate} unit="%" icon={CheckCircleIcon} description={`${p?.completed_sessions ?? 0} of ${p?.total_sessions ?? 0} sessions`} />
          <MetricCard label="Meeting Notes / Session" value={p?.meeting_notes_avg_per_session ?? 0} target={p?.target_meeting_notes} icon={DocumentTextIcon} description={`${p?.total_meeting_notes ?? 0} total meeting notes`} />
          <MetricCard label="Scope Changes" value={p?.scope_changes_total ?? 0} target={p?.target_scope_changes} icon={ArrowPathIcon} description={`${p?.scope_changes_per_session ?? 0} per session`} />
          <MetricCard label="Cards / Session" value={p?.cards_per_session ?? 0} target={p?.target_cards_per_session} icon={CubeIcon} description={`${p?.total_cards ?? 0} total cards`} />
          <MetricCard label="Avg Days to Active" value={p?.avg_days_to_active ?? 0} target={p?.target_days_to_first_export} unit="d" icon={ClockIcon} inverse />
          <MetricCard label="User Retention (7d)" value={p?.retention_rate ?? 0} unit="%" icon={UserGroupIcon} description={`${p?.recently_active_users ?? 0} of ${p?.total_users ?? 0} active`} />
        </div>
      </div>
      <div>
        <h3 className="section-title mb-4">Feature Adoption (METRIC-1.7)</h3>
        <div className="card p-6 space-y-5">
          {p?.feature_adoption && Object.entries(p.feature_adoption).map(([key, val]) => (
            <ProgressBar key={key} label={key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())} pct={val.pct} detail={`${val.sessions} sessions`} />
          ))}
        </div>
      </div>
    </div>
  );

  /* ── Satisfaction Tab ── */
  const renderSatisfaction = () => (
    <div className="space-y-8">
      <div>
        <h3 className="section-title mb-4">User Satisfaction Proxies (METRIC-2.x)</h3>
        <div className="card p-6 space-y-6">
          {s?.whats_in_scope && (
            <div className="space-y-2">
              <ProgressBar label={`METRIC-2.1: ${s.whats_in_scope.label}`} pct={s.whats_in_scope.pct ?? 0} />
              <div className="flex gap-6 text-xs text-neutral-400 pl-1">
                <span>Sessions with scope: {s.whats_in_scope.sessions_with_scope}</span>
                <span>Total sessions: {s.whats_in_scope.total_sessions}</span>
              </div>
            </div>
          )}
          <div className="divider" />
          {s?.why_is_this_here && (
            <div className="space-y-2">
              <ProgressBar label={`METRIC-2.2: ${s.why_is_this_here.label}`} pct={s.why_is_this_here.traceability_pct ?? 0} />
              <div className="flex gap-6 text-xs text-neutral-400 pl-1">
                <span>Nodes with source: {s.why_is_this_here.nodes_with_source}</span>
                <span>Total nodes: {s.why_is_this_here.total_nodes}</span>
              </div>
            </div>
          )}
          <div className="divider" />
          {s?.what_changed && (
            <div className="space-y-2">
              <ProgressBar label={`METRIC-2.3: ${s.what_changed.label}`} pct={s.what_changed.pct ?? 0} />
              <div className="flex gap-6 text-xs text-neutral-400 pl-1">
                <span>Sessions with history: {s.what_changed.sessions_with_history}</span>
                <span>Total sessions: {s.what_changed.total_sessions}</span>
              </div>
            </div>
          )}
          <div className="divider" />
          {[s?.scope_disputes, s?.team_alignment].filter(Boolean).map((item, i) => (
            <div key={i} className="flex items-center gap-3 p-3 bg-neutral-50 rounded-xl">
              <ExclamationTriangleIcon className="w-5 h-5 text-neutral-400 shrink-0" />
              <div>
                <p className="text-sm text-neutral-600">{item!.label}</p>
                <p className="text-xs text-neutral-400">{item!.note}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  /* ── Technical Tab ── */
  const renderTechnical = () => (
    <div className="space-y-8">
      <div>
        <h3 className="section-title mb-4">API Performance (METRIC-3.x)</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <MetricCard label="API p95 Latency" value={t?.api_p95_ms ?? 0} target={t?.target_api_p95_ms} unit="ms" icon={BoltIcon} inverse />
          <MetricCard label="AI Processing p95" value={t?.ai_processing_p95_ms ?? 0} target={t?.target_ai_processing_ms} unit="ms" icon={ServerStackIcon} inverse />
          <MetricCard label="PDF Generation p95" value={t?.pdf_generation_p95_ms ?? 0} target={t?.target_pdf_generation_ms} unit="ms" icon={DocumentTextIcon} inverse />
        </div>
      </div>
      <div>
        <h3 className="section-title mb-4">Reliability</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard label="Uptime" value={t?.uptime_pct ?? 0} target={t?.target_uptime_pct} unit="%" icon={SignalIcon} />
          <MetricCard label="Error Rate" value={t?.error_rate_pct ?? 0} unit="%" icon={ExclamationTriangleIcon} description={`${t?.total_errors ?? 0} errors / ${t?.total_requests ?? 0} requests`} />
          <MetricCard label="Total Requests" value={t?.total_requests ?? 0} icon={ArrowTrendingUpIcon} />
          {t?.test_coverage_pct !== null && t?.test_coverage_pct !== undefined ? (
            <MetricCard label="Test Coverage" value={t.test_coverage_pct} target={t.target_test_coverage_pct} unit="%" icon={ShieldCheckIcon} />
          ) : (
            <div className="card p-5 flex flex-col gap-3">
              <div className="flex items-center gap-2 text-neutral-500">
                <ShieldCheckIcon className="w-4 h-4" />
                <span className="text-xs font-medium uppercase tracking-wider">Test Coverage</span>
              </div>
              <p className="text-sm text-neutral-400 mt-2">Requires CI pipeline integration</p>
            </div>
          )}
        </div>
      </div>
      <div>
        <h3 className="section-title mb-4">Latency Percentiles</h3>
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-100 text-left text-neutral-500">
                <th className="px-5 py-3 font-medium">Percentile</th>
                <th className="px-5 py-3 font-medium">Latency</th>
                <th className="px-5 py-3 font-medium">Target</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-50">
              {[
                { label: "p50 (median)", val: t?.api_p50_ms ?? 0 },
                { label: "p95", val: t?.api_p95_ms ?? 0, target: t?.target_api_p95_ms },
                { label: "p99", val: t?.api_p99_ms ?? 0 },
              ].map((row) => (
                <tr key={row.label} className="hover:bg-neutral-50 transition-colors">
                  <td className="px-5 py-3 font-medium text-neutral-700">{row.label}</td>
                  <td className="px-5 py-3 text-neutral-600">{row.val} ms</td>
                  <td className="px-5 py-3 text-neutral-400">{row.target ? `${row.target} ms` : "—"}</td>
                  <td className="px-5 py-3">{row.target ? <StatusDot pass={row.val <= row.target} /> : <span className="text-neutral-300">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {t?.status_code_distribution && Object.keys(t.status_code_distribution).length > 0 && (
        <div>
          <h3 className="section-title mb-4">Status Code Distribution</h3>
          <div className="card p-5">
            <div className="flex flex-wrap gap-3">
              {Object.entries(t.status_code_distribution).sort(([a], [b]) => a.localeCompare(b)).map(([code, count]) => {
                const codeNum = parseInt(code);
                const color = codeNum < 300 ? "bg-success-50 text-success-700 border-success-200" : codeNum < 400 ? "bg-primary-50 text-primary-700 border-primary-200" : codeNum < 500 ? "bg-warning-50 text-warning-700 border-warning-200" : "bg-danger-50 text-danger-700 border-danger-200";
                return <div key={code} className={`px-3 py-1.5 rounded-lg border text-sm font-medium ${color}`}>{code}: {count}</div>;
              })}
            </div>
          </div>
        </div>
      )}
      {t?.slowest_routes && t.slowest_routes.length > 0 && (
        <div>
          <h3 className="section-title mb-4">Slowest Routes (Top 5)</h3>
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-100 text-left text-neutral-500">
                  <th className="px-5 py-3 font-medium">Route</th>
                  <th className="px-5 py-3 font-medium text-right">Requests</th>
                  <th className="px-5 py-3 font-medium text-right">p50</th>
                  <th className="px-5 py-3 font-medium text-right">p95</th>
                  <th className="px-5 py-3 font-medium text-right">p99</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                {t.slowest_routes.map((r, i) => (
                  <tr key={i} className="hover:bg-neutral-50 transition-colors">
                    <td className="px-5 py-3 font-mono text-xs text-neutral-700 max-w-xs truncate">{r.route}</td>
                    <td className="px-5 py-3 text-right text-neutral-600">{r.count}</td>
                    <td className="px-5 py-3 text-right text-neutral-600">{r.p50_ms} ms</td>
                    <td className="px-5 py-3 text-right text-neutral-600">{r.p95_ms} ms</td>
                    <td className="px-5 py-3 text-right text-neutral-600">{r.p99_ms} ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );

  /* ── Trends Tab ── */
  const renderTrends = () => {
    const trendSeries = [
      { key: "sessions" as const, label: "Sessions Created", color: "bg-primary-400" },
      { key: "nodes" as const, label: "Scope Nodes Created", color: "bg-success-400" },
      { key: "changes" as const, label: "Scope Changes", color: "bg-warning-400" },
      { key: "cards" as const, label: "Planning Cards", color: "bg-accent-400" },
    ];
    return (
      <div className="space-y-8">
        <div>
          <h3 className="section-title mb-4">Daily Activity ({days}d)</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {trendSeries.map(({ key, label, color }) => {
              const total = trends.reduce((sum, d) => sum + Number(d[key]), 0);
              const avg = trends.length ? (total / trends.length).toFixed(1) : "0";
              const peak = Math.max(...trends.map((d) => Number(d[key])), 0);
              return (
                <div key={key} className="card p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-neutral-700">{label}</span>
                    <div className="flex items-center gap-3 text-xs text-neutral-400">
                      <span>Total: <strong className="text-neutral-600">{total}</strong></span>
                      <span>Avg: <strong className="text-neutral-600">{avg}/d</strong></span>
                      <span>Peak: <strong className="text-neutral-600">{peak}</strong></span>
                    </div>
                  </div>
                  <MiniBarChart data={trends} dataKey={key} color={color} />
                </div>
              );
            })}
          </div>
        </div>
        <div>
          <h3 className="section-title mb-4">Daily Breakdown</h3>
          <div className="card overflow-hidden max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-neutral-100 text-left text-neutral-500">
                  <th className="px-5 py-3 font-medium">Date</th>
                  <th className="px-5 py-3 font-medium text-right">Sessions</th>
                  <th className="px-5 py-3 font-medium text-right">Nodes</th>
                  <th className="px-5 py-3 font-medium text-right">Changes</th>
                  <th className="px-5 py-3 font-medium text-right">Cards</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                {[...trends].reverse().map((d) => (
                  <tr key={d.date} className="hover:bg-neutral-50 transition-colors">
                    <td className="px-5 py-2.5 text-neutral-700 font-medium">{d.date}</td>
                    <td className="px-5 py-2.5 text-right text-neutral-600">{d.sessions}</td>
                    <td className="px-5 py-2.5 text-right text-neutral-600">{d.nodes}</td>
                    <td className="px-5 py-2.5 text-right text-neutral-600">{d.changes}</td>
                    <td className="px-5 py-2.5 text-right text-neutral-600">{d.cards}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  /* ── RISK-2.3C: AI Usage / Budget tab ── */
  const renderAIUsage = () => {
    if (aiUsageLoading && !aiUsage) {
      return (
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <div className="relative w-10 h-10 mx-auto mb-3">
              <div className="absolute inset-0 rounded-full border-4 border-neutral-200" />
              <div className="absolute inset-0 rounded-full border-4 border-primary-500 border-t-transparent animate-spin" />
            </div>
            <p className="text-neutral-400 text-xs">Loading AI usage data…</p>
          </div>
        </div>
      );
    }
    if (!aiUsage) return <p className="text-neutral-500 text-sm">No AI usage data available.</p>;

    const taskEntries = Object.entries(aiUsage.by_task).sort((a, b) => b[1].cost_usd - a[1].cost_usd);
    const modelEntries = Object.entries(aiUsage.by_model).sort((a, b) => b[1].cost_usd - a[1].cost_usd);
    const dailyCosts = aiUsage.daily;
    const maxDailyCost = Math.max(...dailyCosts.map((d) => d.cost_usd), 0.001);

    return (
      <div className="space-y-8">
        {/* KPI row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard label="Total Calls" value={aiUsage.total_calls} icon={CpuChipIcon} description={`${aiUsage.cache_hits} cache hits (${(aiUsage.cache_hit_rate * 100).toFixed(1)}%)`} />
          <MetricCard label="Total Tokens" value={aiUsage.total_tokens} icon={CircleStackIcon} description={`Avg ${aiUsage.avg_tokens_per_call}/call`} />
          <div className="card p-5 flex flex-col gap-3">
            <div className="flex items-center gap-2 text-neutral-500">
              <CurrencyDollarIcon className="w-4 h-4" />
              <span className="text-xs font-medium uppercase tracking-wider">Total Cost</span>
            </div>
            <div className="flex items-end gap-1.5">
              <span className="text-3xl font-bold text-neutral-900">${aiUsage.total_cost_usd.toFixed(2)}</span>
            </div>
            <p className="text-xs text-neutral-400">Last {aiUsage.period_days} days</p>
          </div>
          <div className="card p-5 flex flex-col gap-3">
            <div className="flex items-center gap-2 text-neutral-500">
              <BoltIcon className="w-4 h-4" />
              <span className="text-xs font-medium uppercase tracking-wider">Avg Cost/Call</span>
            </div>
            <div className="flex items-end gap-1.5">
              <span className="text-3xl font-bold text-neutral-900">${aiUsage.avg_cost_per_call.toFixed(4)}</span>
            </div>
            <p className="text-xs text-neutral-400">{aiUsage.total_prompt_tokens} prompt + {aiUsage.total_completion_tokens} completion tokens</p>
          </div>
        </div>

        {/* By Task */}
        <div>
          <h3 className="section-title mb-4">Cost by Task</h3>
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50">
                <tr className="border-b border-neutral-100 text-left text-neutral-500">
                  <th className="px-5 py-3 font-medium">Task</th>
                  <th className="px-5 py-3 font-medium text-right">Calls</th>
                  <th className="px-5 py-3 font-medium text-right">Tokens</th>
                  <th className="px-5 py-3 font-medium text-right">Cache Hits</th>
                  <th className="px-5 py-3 font-medium text-right">Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                {taskEntries.map(([task, data]) => (
                  <tr key={task} className="hover:bg-neutral-50 transition-colors">
                    <td className="px-5 py-2.5 text-neutral-700 font-medium">{task}</td>
                    <td className="px-5 py-2.5 text-right text-neutral-600">{data.calls}</td>
                    <td className="px-5 py-2.5 text-right text-neutral-600">{data.tokens.toLocaleString()}</td>
                    <td className="px-5 py-2.5 text-right text-neutral-600">{data.cache_hits ?? 0}</td>
                    <td className="px-5 py-2.5 text-right font-medium text-neutral-800">${data.cost_usd.toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* By Model */}
        <div>
          <h3 className="section-title mb-4">Cost by Model</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {modelEntries.map(([model, data]) => (
              <div key={model} className="card p-5 space-y-2">
                <p className="text-xs font-mono text-neutral-500 truncate" title={model}>{model}</p>
                <div className="flex items-end gap-2">
                  <span className="text-xl font-bold text-neutral-900">${data.cost_usd.toFixed(4)}</span>
                  <span className="text-xs text-neutral-400 mb-0.5">{data.calls} calls</span>
                </div>
                <p className="text-xs text-neutral-400">{data.tokens.toLocaleString()} tokens</p>
              </div>
            ))}
          </div>
        </div>

        {/* Daily costs chart */}
        {dailyCosts.length > 0 && (
          <div>
            <h3 className="section-title mb-4">Daily Cost Trend</h3>
            <div className="card p-5 space-y-3">
              <div className="flex items-end gap-px h-24">
                {dailyCosts.map((d, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-t bg-primary-400 transition-all duration-300"
                    style={{ height: `${(d.cost_usd / maxDailyCost) * 100}%`, minHeight: d.cost_usd > 0 ? 2 : 0 }}
                    title={`${d.date}: $${d.cost_usd.toFixed(4)} (${d.calls} calls, ${d.tokens} tokens)`}
                  />
                ))}
              </div>
              <div className="flex justify-between text-[10px] text-neutral-400">
                <span>{dailyCosts[0]?.date}</span>
                <span>{dailyCosts[dailyCosts.length - 1]?.date}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  /* ── Main Render (Dashboard) ── */
  return (
    <div className="h-screen flex flex-col bg-neutral-50 overflow-hidden">
      {/* Standalone metrics header (not the main app Header) */}
      <header className="bg-white/80 backdrop-blur-xl border-b border-neutral-200/60 h-14 w-full flex-shrink-0 relative z-50">
        <div className="flex items-center justify-between px-4 h-full max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center shadow-soft-sm group-hover:shadow-glow transition-shadow duration-300">
                <span className="text-white font-bold text-base">M</span>
              </div>
              <span className="text-lg font-semibold text-neutral-900">MoMetric</span>
            </Link>
            <div className="w-px h-5 bg-neutral-200 mx-2" />
            <div className="flex items-center gap-1.5 text-sm text-neutral-500">
              <ChartBarIcon className="w-4 h-4" />
              <span className="font-medium">Platform Metrics</span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 px-3 py-2 rounded-lg transition-all"
          >
            <ArrowRightOnRectangleIcon className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Page header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-soft-sm">
                <ChartBarIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-neutral-900">Success Metrics</h1>
                <p className="text-sm text-neutral-500">Platform-wide analytics — all organisations</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative">
                <button onClick={() => setShowPeriodDropdown(!showPeriodDropdown)} className="btn-secondary flex items-center gap-2 text-sm">
                  Last {PERIOD_OPTIONS.find((o) => o.value === days)?.label ?? `${days}d`}
                  <ChevronDownIcon className="w-4 h-4" />
                </button>
                {showPeriodDropdown && (
                  <div className="absolute right-0 mt-1 w-36 bg-white border border-neutral-200 rounded-xl shadow-soft-md z-50 overflow-hidden">
                    {PERIOD_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        className={`w-full text-left px-4 py-2.5 text-sm hover:bg-neutral-50 transition-colors ${opt.value === days ? "bg-primary-50 text-primary-700 font-medium" : "text-neutral-700"}`}
                        onClick={() => { setDays(opt.value); setShowPeriodDropdown(false); }}
                      >
                        Last {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button onClick={fetchMetrics} disabled={loading} className="btn-secondary" title="Refresh">
                <ArrowPathIcon className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 border-b border-neutral-200 mb-6">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px ${activeTab === tab ? "border-primary-500 text-primary-700" : "border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300"}`}
              >
                {tab}
              </button>
            ))}
          </div>

          {error && (
            <div className="mb-6 p-4 bg-danger-50 border border-danger-200 rounded-xl text-sm text-danger-700">{error}</div>
          )}

          {loading && !metrics ? (
            <div className="flex items-center justify-center py-24">
              <div className="text-center">
                <div className="relative w-12 h-12 mx-auto mb-4">
                  <div className="absolute inset-0 rounded-full border-4 border-neutral-200" />
                  <div className="absolute inset-0 rounded-full border-4 border-primary-500 border-t-transparent animate-spin" />
                </div>
                <p className="text-neutral-400 text-sm">Loading metrics…</p>
              </div>
            </div>
          ) : metrics ? (
            <>
              {activeTab === "Overview" && renderOverview()}
              {activeTab === "Product" && renderProduct()}
              {activeTab === "Satisfaction" && renderSatisfaction()}
              {activeTab === "Technical" && renderTechnical()}
              {activeTab === "Trends" && renderTrends()}
              {activeTab === "AI Usage" && renderAIUsage()}
            </>
          ) : null}
        </div>
      </main>
    </div>
  );
}
