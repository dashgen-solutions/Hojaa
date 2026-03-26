"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Cog6ToothIcon,
  LinkIcon,
  PaintBrushIcon,
  KeyIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClipboardDocumentIcon,
  TrashIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";
import {
  listIntegrations,
  upsertIntegration,
  deleteIntegration,
  testIntegration,
  getIntegrationSyncs,
  getBrandSettings,
  updateBrandSettings,
  listAPIKeys,
  createAPIKey,
  revokeAPIKey,
  type BrandSettings,
  type APIKeyInfo,
} from "@/lib/api";

type Tab = "integrations" | "branding" | "api-keys" | "ai";

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("integrations");

  const TABS: { key: Tab; label: string; icon: typeof LinkIcon }[] = [
    { key: "integrations", label: "Integrations", icon: LinkIcon },
    { key: "branding", label: "Branding", icon: PaintBrushIcon },
    { key: "api-keys", label: "API Keys", icon: KeyIcon },
    { key: "ai", label: "AI", icon: SparklesIcon },
  ];

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-8 pb-20">
        <div className="flex items-center gap-3 mb-8">
          <Cog6ToothIcon className="w-7 h-7 text-neutral-700 dark:text-neutral-300" />
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">Settings</h1>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-neutral-200/60 dark:bg-neutral-800 rounded-md p-1 mb-8 w-fit">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                tab === t.key
                  ? "bg-brand-lime text-brand-dark shadow-sm"
                  : "text-neutral-600 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200"
              }`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </div>

        {tab === "integrations" && <IntegrationsTab />}
        {tab === "branding" && <BrandingTab />}
        {tab === "api-keys" && <APIKeysTab />}
        {tab === "ai" && <AIProvidersTab />}
        </div>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════
//  Integrations Tab
// ═══════════════════════════════════════════════════════════

function IntegrationsTab() {
  const [integrations, setIntegrations] = useState<any[]>([]);
  const [syncs, setSyncs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [testResult, setTestResult] = useState<{ type: string; status: string; message?: string } | null>(null);

  // Jira form
  const [jiraUrl, setJiraUrl] = useState("");
  const [jiraEmail, setJiraEmail] = useState("");
  const [jiraToken, setJiraToken] = useState("");
  const [jiraProject, setJiraProject] = useState("");
  const [jiraActive, setJiraActive] = useState(true);

  // Slack form
  const [slackWebhook, setSlackWebhook] = useState("");
  const [slackBotToken, setSlackBotToken] = useState("");
  const [slackChannel, setSlackChannel] = useState("");
  const [slackActive, setSlackActive] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [intRes, syncRes] = await Promise.all([listIntegrations(), getIntegrationSyncs(20)]);
      setIntegrations(intRes);
      setSyncs(syncRes);

      const jira = intRes.find((i: any) => i.integration_type === "jira");
      if (jira) {
        setJiraUrl(jira.config.base_url || "");
        setJiraEmail(jira.config.email || "");
        setJiraProject(jira.config.project_key || "");
        setJiraActive(jira.is_active);
      }

      const slack = intRes.find((i: any) => i.integration_type === "slack");
      if (slack) {
        setSlackChannel(slack.config.channel_id || "");
        setSlackActive(slack.is_active);
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveJira = async () => {
    await upsertIntegration({
      integration_type: "jira",
      config: { base_url: jiraUrl, email: jiraEmail, api_token: jiraToken, project_key: jiraProject },
      is_active: jiraActive,
    });
    await load();
  };

  const saveSlack = async () => {
    await upsertIntegration({
      integration_type: "slack",
      config: { webhook_url: slackWebhook, bot_token: slackBotToken, channel_id: slackChannel },
      is_active: slackActive,
    });
    await load();
  };

  const doTest = async (type: string) => {
    setTestResult(null);
    try {
      const res = await testIntegration(type);
      setTestResult({ type, ...res });
    } catch (e: any) {
      setTestResult({ type, status: "error", message: e.message });
    }
  };

  if (loading) return <div className="text-neutral-500 dark:text-neutral-400">Loading integrations...</div>;

  return (
    <div className="space-y-8">
      {/* Jira */}
      <div className="bg-white dark:bg-neutral-900 rounded-md border border-neutral-200 dark:border-neutral-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/40 rounded-md flex items-center justify-center">
              <span className="text-blue-600 dark:text-blue-400 font-bold text-sm">J</span>
            </div>
            <div>
              <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">Jira</h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">Export cards as Jira issues, sync status</p>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm dark:text-neutral-300">
            <input type="checkbox" checked={jiraActive} onChange={(e) => setJiraActive(e.target.checked)} className="rounded" />
            Active
          </label>
        </div>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <input value={jiraUrl} onChange={(e) => setJiraUrl(e.target.value)} placeholder="Base URL (e.g. https://company.atlassian.net)" className="col-span-2 border dark:border-neutral-700 rounded-md px-3 py-2 text-sm dark:bg-neutral-800 dark:text-neutral-200 dark:placeholder-neutral-500" />
          <input value={jiraEmail} onChange={(e) => setJiraEmail(e.target.value)} placeholder="Email" className="border dark:border-neutral-700 rounded-md px-3 py-2 text-sm dark:bg-neutral-800 dark:text-neutral-200 dark:placeholder-neutral-500" />
          <input value={jiraToken} onChange={(e) => setJiraToken(e.target.value)} placeholder="API Token" type="password" className="border dark:border-neutral-700 rounded-md px-3 py-2 text-sm dark:bg-neutral-800 dark:text-neutral-200 dark:placeholder-neutral-500" />
          <input value={jiraProject} onChange={(e) => setJiraProject(e.target.value)} placeholder="Project Key (e.g. REQ)" className="border dark:border-neutral-700 rounded-md px-3 py-2 text-sm dark:bg-neutral-800 dark:text-neutral-200 dark:placeholder-neutral-500" />
        </div>
        <div className="flex gap-2">
          <button onClick={saveJira} className="px-4 py-2 bg-brand-lime text-brand-dark text-sm font-medium rounded-md hover:bg-brand-lime/90 shadow-sm hover:shadow-[0_0_16px_-4px_rgba(228,255,26,0.4)] transition-colors">Save</button>
          <button onClick={() => doTest("jira")} className="px-4 py-2 border dark:border-neutral-700 text-sm rounded-md hover:bg-neutral-50 dark:text-neutral-300 dark:hover:bg-neutral-800">Test Connection</button>
        </div>
        {testResult?.type === "jira" && (
          <div className={`mt-3 flex items-center gap-2 text-sm ${testResult.status === "ok" ? "text-green-600" : "text-red-600"}`}>
            {testResult.status === "ok" ? <CheckCircleIcon className="w-4 h-4" /> : <XCircleIcon className="w-4 h-4" />}
            {testResult.status === "ok" ? `Connected as ${(testResult as any).user || "user"}` : testResult.message || "Connection failed"}
          </div>
        )}
      </div>

      {/* Slack */}
      <div className="bg-white dark:bg-neutral-900 rounded-md border border-neutral-200 dark:border-neutral-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/40 rounded-md flex items-center justify-center">
              <span className="text-purple-600 dark:text-purple-400 font-bold text-sm">S</span>
            </div>
            <div>
              <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">Slack</h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">Send notifications to Slack channels</p>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm dark:text-neutral-300">
            <input type="checkbox" checked={slackActive} onChange={(e) => setSlackActive(e.target.checked)} className="rounded" />
            Active
          </label>
        </div>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <input value={slackWebhook} onChange={(e) => setSlackWebhook(e.target.value)} placeholder="Webhook URL" type="password" className="col-span-2 border dark:border-neutral-700 rounded-md px-3 py-2 text-sm dark:bg-neutral-800 dark:text-neutral-200 dark:placeholder-neutral-500" />
          <input value={slackBotToken} onChange={(e) => setSlackBotToken(e.target.value)} placeholder="Bot Token (optional)" type="password" className="border dark:border-neutral-700 rounded-md px-3 py-2 text-sm dark:bg-neutral-800 dark:text-neutral-200 dark:placeholder-neutral-500" />
          <input value={slackChannel} onChange={(e) => setSlackChannel(e.target.value)} placeholder="Channel ID (for bot)" className="border dark:border-neutral-700 rounded-md px-3 py-2 text-sm dark:bg-neutral-800 dark:text-neutral-200 dark:placeholder-neutral-500" />
        </div>
        <div className="flex gap-2">
          <button onClick={saveSlack} className="px-4 py-2 bg-brand-lime text-brand-dark text-sm font-medium rounded-md hover:bg-brand-lime/90 shadow-sm hover:shadow-[0_0_16px_-4px_rgba(228,255,26,0.4)] transition-colors">Save</button>
          <button onClick={() => doTest("slack")} className="px-4 py-2 border dark:border-neutral-700 text-sm rounded-md hover:bg-neutral-50 dark:text-neutral-300 dark:hover:bg-neutral-800">Test Connection</button>
        </div>
        {testResult?.type === "slack" && (
          <div className={`mt-3 flex items-center gap-2 text-sm ${testResult.status === "ok" ? "text-green-600" : "text-red-600"}`}>
            {testResult.status === "ok" ? <CheckCircleIcon className="w-4 h-4" /> : <XCircleIcon className="w-4 h-4" />}
            {testResult.status === "ok" ? "Message sent successfully" : "Failed to send test message"}
          </div>
        )}
      </div>

      {/* Recent Sync Log */}
      {syncs.length > 0 && (
        <div className="bg-white dark:bg-neutral-900 rounded-md border border-neutral-200 dark:border-neutral-700 p-6">
          <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-4">Recent Sync Activity</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {syncs.map((s: any) => (
              <div key={s.id} className="flex items-center justify-between text-sm py-2 border-b border-neutral-100 dark:border-neutral-800 last:border-0">
                <div className="flex items-center gap-2">
                  {s.status === "success" ? (
                    <CheckCircleIcon className="w-4 h-4 text-green-500" />
                  ) : (
                    <XCircleIcon className="w-4 h-4 text-red-500" />
                  )}
                  <span className="font-medium dark:text-neutral-200">{s.action}</span>
                  {s.external_id && <span className="text-neutral-500 dark:text-neutral-400">→ {s.external_id}</span>}
                </div>
                <span className="text-neutral-400 dark:text-neutral-500 text-xs">{new Date(s.created_at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════
//  Branding Tab
// ═══════════════════════════════════════════════════════════

function BrandingTab() {
  const [brand, setBrand] = useState<BrandSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await getBrandSettings();
        setBrand(data);
      } catch {}
      setLoading(false);
    })();
  }, []);

  const update = (key: keyof BrandSettings, value: string) => {
    setBrand((prev) => prev ? { ...prev, [key]: value } : prev);
    setSaved(false);
  };

  const save = async () => {
    if (!brand) return;
    setSaving(true);
    try {
      const res = await updateBrandSettings(brand);
      setBrand(res);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {}
    setSaving(false);
  };

  if (loading || !brand) return <div className="text-neutral-500 dark:text-neutral-400">Loading brand settings...</div>;

  return (
    <div className="space-y-8">
      {/* Identity */}
      <div className="bg-white dark:bg-neutral-900 rounded-md border border-neutral-200 dark:border-neutral-700 p-6">
        <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-4">Identity</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1 block">App Name</label>
            <input value={brand.app_name} onChange={(e) => update("app_name", e.target.value)} className="w-full border dark:border-neutral-700 rounded-md px-3 py-2 text-sm dark:bg-neutral-800 dark:text-neutral-200" />
          </div>
          <div>
            <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1 block">Tagline</label>
            <input value={brand.tagline || ""} onChange={(e) => update("tagline", e.target.value)} className="w-full border dark:border-neutral-700 rounded-md px-3 py-2 text-sm dark:bg-neutral-800 dark:text-neutral-200" />
          </div>
          <div>
            <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1 block">Logo URL</label>
            <input value={brand.logo_url || ""} onChange={(e) => update("logo_url", e.target.value)} className="w-full border dark:border-neutral-700 rounded-md px-3 py-2 text-sm dark:bg-neutral-800 dark:text-neutral-200 dark:placeholder-neutral-500" placeholder="https://..." />
          </div>
          <div>
            <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1 block">Favicon URL</label>
            <input value={brand.favicon_url || ""} onChange={(e) => update("favicon_url", e.target.value)} className="w-full border dark:border-neutral-700 rounded-md px-3 py-2 text-sm dark:bg-neutral-800 dark:text-neutral-200 dark:placeholder-neutral-500" placeholder="https://..." />
          </div>
        </div>
      </div>

      {/* Colors */}
      <div className="bg-white dark:bg-neutral-900 rounded-md border border-neutral-200 dark:border-neutral-700 p-6">
        <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-4">Colors</h3>
        <div className="grid grid-cols-5 gap-4">
          {(["primary_color", "secondary_color", "accent_color", "background_color", "text_color"] as const).map((key) => (
            <div key={key}>
              <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1 block capitalize">{key.replace("_", " ")}</label>
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  value={brand[key]}
                  onChange={(e) => update(key, e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer border-0"
                />
                <input
                  value={brand[key]}
                  onChange={(e) => update(key, e.target.value)}
                  className="w-full border dark:border-neutral-700 rounded-md px-2 py-1.5 text-xs font-mono dark:bg-neutral-800 dark:text-neutral-200"
                />
              </div>
            </div>
          ))}
        </div>

        {/* Preview */}
        <div className="mt-6 p-4 rounded-md border dark:bg-neutral-800" style={{ backgroundColor: brand.background_color, color: brand.text_color, fontFamily: brand.font_family }}>
          <div className="flex items-center gap-3 mb-3">
            {brand.logo_url ? (
              <img src={brand.logo_url} alt="Logo" className="h-8 w-8 rounded" />
            ) : (
              <div className="w-8 h-8 rounded-md flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: brand.primary_color }}>
                {brand.app_name.charAt(0)}
              </div>
            )}
            <span className="font-semibold">{brand.app_name}</span>
          </div>
          <div className="flex gap-2">
            <span className="px-3 py-1 rounded text-white text-xs" style={{ backgroundColor: brand.primary_color }}>Primary</span>
            <span className="px-3 py-1 rounded text-white text-xs" style={{ backgroundColor: brand.secondary_color }}>Secondary</span>
            <span className="px-3 py-1 rounded text-white text-xs" style={{ backgroundColor: brand.accent_color }}>Accent</span>
          </div>
        </div>
      </div>

      {/* Typography & Export */}
      <div className="bg-white dark:bg-neutral-900 rounded-md border border-neutral-200 dark:border-neutral-700 p-6">
        <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-4">Typography & Export</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1 block">Font Family</label>
            <input value={brand.font_family} onChange={(e) => update("font_family", e.target.value)} className="w-full border dark:border-neutral-700 rounded-md px-3 py-2 text-sm dark:bg-neutral-800 dark:text-neutral-200" />
          </div>
          <div>
            <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1 block">Email From Name</label>
            <input value={brand.email_from_name || ""} onChange={(e) => update("email_from_name", e.target.value)} className="w-full border dark:border-neutral-700 rounded-md px-3 py-2 text-sm dark:bg-neutral-800 dark:text-neutral-200" />
          </div>
          <div>
            <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1 block">PDF Header Text</label>
            <input value={brand.pdf_header_text || ""} onChange={(e) => update("pdf_header_text", e.target.value)} className="w-full border dark:border-neutral-700 rounded-md px-3 py-2 text-sm dark:bg-neutral-800 dark:text-neutral-200" />
          </div>
          <div>
            <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1 block">PDF Footer Text</label>
            <input value={brand.pdf_footer_text || ""} onChange={(e) => update("pdf_footer_text", e.target.value)} className="w-full border dark:border-neutral-700 rounded-md px-3 py-2 text-sm dark:bg-neutral-800 dark:text-neutral-200" />
          </div>
          <div>
            <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1 block">Custom Domain</label>
            <input value={brand.custom_domain || ""} onChange={(e) => update("custom_domain", e.target.value)} className="w-full border dark:border-neutral-700 rounded-md px-3 py-2 text-sm dark:bg-neutral-800 dark:text-neutral-200 dark:placeholder-neutral-500" placeholder="app.yourdomain.com" />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={saving} className="px-6 py-2.5 bg-brand-lime text-brand-dark text-sm font-medium rounded-md hover:bg-brand-lime/90 shadow-sm hover:shadow-[0_0_16px_-4px_rgba(228,255,26,0.4)] transition-colors disabled:opacity-50">
          {saving ? "Saving..." : "Save Branding"}
        </button>
        {saved && (
          <span className="flex items-center gap-1 text-green-600 text-sm">
            <CheckCircleIcon className="w-4 h-4" /> Saved
          </span>
        )}
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════
//  API Keys Tab
// ═══════════════════════════════════════════════════════════

function APIKeysTab() {
  const [keys, setKeys] = useState<APIKeyInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [newKeyName, setNewKeyName] = useState("");
  const [newRawKey, setNewRawKey] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [showDocs, setShowDocs] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listAPIKeys();
      setKeys(data);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!newKeyName.trim()) return;
    setCreating(true);
    try {
      const res = await createAPIKey({ name: newKeyName.trim() });
      setNewRawKey(res.raw_key);
      setNewKeyName("");
      await load();
    } catch {}
    setCreating(false);
  };

  const handleRevoke = async (keyId: string) => {
    if (!confirm("Revoke this API key? This cannot be undone.")) return;
    try {
      await revokeAPIKey(keyId);
      await load();
    } catch {}
  };

  const copyKey = () => {
    if (newRawKey) {
      navigator.clipboard.writeText(newRawKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const copySnippet = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSnippet(id);
    setTimeout(() => setCopiedSnippet(null), 2000);
  };

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
  const displayKey = newRawKey || "mk_your_key_here";

  if (loading) return <div className="text-neutral-500 dark:text-neutral-400">Loading API keys...</div>;

  return (
    <div className="space-y-6">
      {/* New key warning */}
      {newRawKey && (
        <div className="bg-amber-50 border border-amber-200 dark:bg-amber-900/20 dark:border-amber-800 rounded-md p-5">
          <div className="flex items-start gap-3">
            <ExclamationTriangleIcon className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-amber-900 dark:text-amber-200 text-sm mb-1">Copy your API key now — it won&apos;t be shown again</p>
              <div className="flex items-center gap-2 bg-white dark:bg-neutral-800 rounded-md border border-amber-300 dark:border-amber-700 px-3 py-2 mt-2">
                <code className="text-sm font-mono flex-1 break-all select-all dark:text-neutral-200">{newRawKey}</code>
                <button onClick={copyKey} className="flex-shrink-0 p-1.5 hover:bg-amber-100 dark:hover:bg-amber-900/40 rounded">
                  <ClipboardDocumentIcon className="w-4 h-4 text-amber-700" />
                </button>
              </div>
              {copied && <p className="text-xs text-green-600 mt-1">Copied!</p>}
              <div className="flex items-center gap-3 mt-3">
                <button onClick={() => { setShowDocs(true); setNewRawKey(null); }} className="text-xs font-medium text-indigo-600 hover:underline">Show API usage examples &rarr;</button>
                <button onClick={() => setNewRawKey(null)} className="text-xs text-amber-600 hover:underline">Dismiss</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create new key */}
      <div className="bg-white dark:bg-neutral-900 rounded-md border border-neutral-200 dark:border-neutral-700 p-6">
        <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-4">Create API Key</h3>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-4">
          API keys allow third-party tools to access your Hojaa data programmatically.
          Use the <code className="bg-neutral-100 dark:bg-neutral-800 dark:text-neutral-300 px-1 rounded">X-API-Key</code> header in requests.
        </p>
        <div className="flex gap-3">
          <input
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            placeholder="Key name (e.g. CI Pipeline, Jira Sync)"
            className="flex-1 border dark:border-neutral-700 rounded-md px-3 py-2 text-sm dark:bg-neutral-800 dark:text-neutral-200 dark:placeholder-neutral-500"
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          />
          <button
            onClick={handleCreate}
            disabled={creating || !newKeyName.trim()}
            className="px-5 py-2 bg-brand-lime text-brand-dark text-sm font-medium rounded-md hover:bg-brand-lime/90 shadow-sm hover:shadow-[0_0_16px_-4px_rgba(228,255,26,0.4)] transition-colors disabled:opacity-50"
          >
            {creating ? "Creating..." : "Create Key"}
          </button>
        </div>
      </div>

      {/* Key list */}
      <div className="bg-white dark:bg-neutral-900 rounded-md border border-neutral-200 dark:border-neutral-700 p-6">
        <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-4">Your API Keys</h3>
        {keys.length === 0 ? (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">No API keys created yet.</p>
        ) : (
          <div className="space-y-3">
            {keys.map((k) => (
              <div key={k.id} className={`flex items-center justify-between p-4 rounded-md border ${k.is_active ? "border-neutral-200 dark:border-neutral-700" : "border-neutral-100 dark:border-neutral-800 opacity-60"}`}>
                <div className="flex items-center gap-4">
                  <div className="w-9 h-9 bg-neutral-100 dark:bg-neutral-800 rounded-md flex items-center justify-center">
                    <KeyIcon className="w-4 h-4 text-neutral-500 dark:text-neutral-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-neutral-900 dark:text-neutral-100">{k.name}</span>
                      <code className="text-xs bg-neutral-100 dark:bg-neutral-800 dark:text-neutral-300 px-1.5 py-0.5 rounded font-mono">{k.key_prefix}••••</code>
                      {!k.is_active && (
                        <span className="text-xs bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 px-1.5 py-0.5 rounded">Revoked</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                      <span>Created: {new Date(k.created_at).toLocaleDateString()}</span>
                      {k.last_used_at && <span>Last used: {new Date(k.last_used_at).toLocaleDateString()}</span>}
                      <span>{k.request_count.toLocaleString()} requests</span>
                      {k.expires_at && <span>Expires: {new Date(k.expires_at).toLocaleDateString()}</span>}
                    </div>
                  </div>
                </div>
                {k.is_active && (
                  <button onClick={() => handleRevoke(k.id)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md" title="Revoke key">
                    <TrashIcon className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* API docs preview */}
      <div className="bg-white dark:bg-neutral-900 rounded-md border border-neutral-200 dark:border-neutral-700 p-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">API Usage Guide</h3>
          <button onClick={() => setShowDocs(!showDocs)} className="text-xs text-indigo-600 hover:underline">
            {showDocs ? "Collapse" : "Expand"}
          </button>
        </div>

        {!showDocs ? (
          <div className="bg-neutral-900 text-neutral-100 rounded-md p-4 text-sm font-mono overflow-x-auto relative group">
            <button
              onClick={() => copySnippet(`curl -H "X-API-Key: ${displayKey}" ${baseUrl}/api/sessions`, "quick")}
              className="absolute top-2 right-2 p-1.5 bg-neutral-700 hover:bg-neutral-600 rounded text-neutral-300 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              {copiedSnippet === "quick" ? <CheckCircleIcon className="w-4 h-4 text-green-400" /> : <ClipboardDocumentIcon className="w-4 h-4" />}
            </button>
            <pre>{`# Authenticate with your API key
curl -H "X-API-Key: ${displayKey}" \\
     ${baseUrl}/api/sessions`}</pre>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Authentication */}
            <div>
              <h4 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200 mb-2">Authentication</h4>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-3">Include your API key in the <code className="bg-neutral-100 dark:bg-neutral-800 dark:text-neutral-300 px-1 rounded">X-API-Key</code> header with every request.</p>
              <div className="bg-neutral-900 text-neutral-100 rounded-md p-4 text-sm font-mono overflow-x-auto relative group">
                <button
                  onClick={() => copySnippet(`curl -H "X-API-Key: ${displayKey}" ${baseUrl}/api/sessions`, "auth")}
                  className="absolute top-2 right-2 p-1.5 bg-neutral-700 hover:bg-neutral-600 rounded text-neutral-300 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  {copiedSnippet === "auth" ? <CheckCircleIcon className="w-4 h-4 text-green-400" /> : <ClipboardDocumentIcon className="w-4 h-4" />}
                </button>
                <pre className="text-green-400 mb-1">{`# Using API Key (recommended for integrations)`}</pre>
                <pre>{`curl -H "X-API-Key: ${displayKey}" \\
     ${baseUrl}/api/sessions`}</pre>
              </div>
            </div>

            {/* List Sessions */}
            <div>
              <h4 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200 mb-2">List Projects</h4>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-3">Retrieve all projects in your workspace.</p>
              <div className="bg-neutral-900 text-neutral-100 rounded-md p-4 text-sm font-mono overflow-x-auto relative group">
                <button
                  onClick={() => copySnippet(`curl -H "X-API-Key: ${displayKey}" ${baseUrl}/api/sessions`, "sessions")}
                  className="absolute top-2 right-2 p-1.5 bg-neutral-700 hover:bg-neutral-600 rounded text-neutral-300 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  {copiedSnippet === "sessions" ? <CheckCircleIcon className="w-4 h-4 text-green-400" /> : <ClipboardDocumentIcon className="w-4 h-4" />}
                </button>
                <pre className="text-green-400 mb-1">{`# GET /api/sessions`}</pre>
                <pre>{`curl -H "X-API-Key: ${displayKey}" \\
     ${baseUrl}/api/sessions`}</pre>
                <pre className="text-neutral-500 mt-3 mb-1">{`# Response (200 OK)`}</pre>
                <pre className="text-amber-300">{`[
  {
    "id": "uuid-string",
    "name": "Discovery Project 1",
    "status": "active",
    "created_at": "2026-02-16T10:00:00",
    "updated_at": "2026-02-16T12:30:00"
  }
]`}</pre>
              </div>
            </div>

            {/* Get Requirement Tree */}
            <div>
              <h4 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200 mb-2">Get Requirement Tree</h4>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-3">Fetch the full requirement tree for a project.</p>
              <div className="bg-neutral-900 text-neutral-100 rounded-md p-4 text-sm font-mono overflow-x-auto relative group">
                <button
                  onClick={() => copySnippet(`curl -H "X-API-Key: ${displayKey}" ${baseUrl}/api/tree/{session_id}`, "tree")}
                  className="absolute top-2 right-2 p-1.5 bg-neutral-700 hover:bg-neutral-600 rounded text-neutral-300 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  {copiedSnippet === "tree" ? <CheckCircleIcon className="w-4 h-4 text-green-400" /> : <ClipboardDocumentIcon className="w-4 h-4" />}
                </button>
                <pre className="text-green-400 mb-1">{`# GET /api/tree/{session_id}`}</pre>
                <pre>{`curl -H "X-API-Key: ${displayKey}" \\
     ${baseUrl}/api/tree/{session_id}`}</pre>
                <pre className="text-neutral-500 mt-3 mb-1">{`# Response (200 OK)`}</pre>
                <pre className="text-amber-300">{`{
  "nodes": [
    {
      "id": "uuid",
      "title": "User Authentication",
      "type": "functional",
      "status": "approved",
      "children": [...]
    }
  ],
  "stats": {
    "total_nodes": 24,
    "max_depth": 4
  }
}`}</pre>
              </div>
            </div>

            {/* Export */}
            <div>
              <h4 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200 mb-2">Export Project</h4>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-3">Export the full project as JSON, CSV, or PDF.</p>
              <div className="bg-neutral-900 text-neutral-100 rounded-md p-4 text-sm font-mono overflow-x-auto relative group">
                <button
                  onClick={() => copySnippet(`curl -H "X-API-Key: ${displayKey}" "${baseUrl}/api/export/{session_id}?format=json"`, "export")}
                  className="absolute top-2 right-2 p-1.5 bg-neutral-700 hover:bg-neutral-600 rounded text-neutral-300 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  {copiedSnippet === "export" ? <CheckCircleIcon className="w-4 h-4 text-green-400" /> : <ClipboardDocumentIcon className="w-4 h-4" />}
                </button>
                <pre className="text-green-400 mb-1">{`# GET /api/export/{session_id}?format=json`}</pre>
                <pre>{`curl -H "X-API-Key: ${displayKey}" \\
     "${baseUrl}/api/export/{session_id}?format=json"`}</pre>
                <pre className="text-neutral-500 mt-3 mb-1">{`# Response (200 OK)`}</pre>
                <pre className="text-amber-300">{`{
  "session": { "name": "...", "status": "active" },
  "tree": { "nodes": [...] },
  "cards": [
    {
      "title": "Implement OAuth2",
      "priority": "high",
      "status": "in_progress"
    }
  ]
}`}</pre>
              </div>
            </div>

            {/* Planning Cards */}
            <div>
              <h4 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200 mb-2">List Planning Cards</h4>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-3">Retrieve all planning cards for a project.</p>
              <div className="bg-neutral-900 text-neutral-100 rounded-md p-4 text-sm font-mono overflow-x-auto relative group">
                <button
                  onClick={() => copySnippet(`curl -H "X-API-Key: ${displayKey}" ${baseUrl}/api/planning/cards/{session_id}`, "cards")}
                  className="absolute top-2 right-2 p-1.5 bg-neutral-700 hover:bg-neutral-600 rounded text-neutral-300 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  {copiedSnippet === "cards" ? <CheckCircleIcon className="w-4 h-4 text-green-400" /> : <ClipboardDocumentIcon className="w-4 h-4" />}
                </button>
                <pre className="text-green-400 mb-1">{`# GET /api/planning/cards/{session_id}`}</pre>
                <pre>{`curl -H "X-API-Key: ${displayKey}" \\
     ${baseUrl}/api/planning/cards/{session_id}`}</pre>
                <pre className="text-neutral-500 mt-3 mb-1">{`# Response (200 OK)`}</pre>
                <pre className="text-amber-300">{`[
  {
    "id": "uuid",
    "title": "Implement OAuth2 Login",
    "description": "...",
    "priority": "high",
    "status": "in_progress",
    "story_points": 8,
    "assigned_to": "user@example.com"
  }
]`}</pre>
              </div>
            </div>

            {/* Python example */}
            <div>
              <h4 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200 mb-2">Python Example</h4>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-3">Use the API from Python with the <code className="bg-neutral-100 dark:bg-neutral-800 dark:text-neutral-300 px-1 rounded">requests</code> library.</p>
              <div className="bg-neutral-900 text-neutral-100 rounded-md p-4 text-sm font-mono overflow-x-auto relative group">
                <button
                  onClick={() => copySnippet(`import requests\n\nAPI_KEY = "${displayKey}"\nBASE_URL = "${baseUrl}"\n\nheaders = {"X-API-Key": API_KEY}\n\n# List all sessions\nresp = requests.get(f"{BASE_URL}/api/sessions", headers=headers)\nprint(resp.json())\n\n# Get tree for a session\nsession_id = resp.json()[0]["id"]\ntree = requests.get(f"{BASE_URL}/api/tree/{session_id}", headers=headers)\nprint(tree.json())`, "python")}
                  className="absolute top-2 right-2 p-1.5 bg-neutral-700 hover:bg-neutral-600 rounded text-neutral-300 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  {copiedSnippet === "python" ? <CheckCircleIcon className="w-4 h-4 text-green-400" /> : <ClipboardDocumentIcon className="w-4 h-4" />}
                </button>
                <pre className="text-blue-400 mb-1">{`# Python — pip install requests`}</pre>
                <pre>{`import requests

API_KEY = "${displayKey}"
BASE_URL = "${baseUrl}"

headers = {"X-API-Key": API_KEY}

# List all projects
resp = requests.get(f"{BASE_URL}/api/sessions", headers=headers)
print(resp.json())

# Get tree for a project
session_id = resp.json()[0]["id"]
tree = requests.get(
    f"{BASE_URL}/api/tree/{'{'}session_id{'}'}",
    headers=headers
)
print(tree.json())`}</pre>
              </div>
            </div>

            {/* JavaScript/Node example */}
            <div>
              <h4 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200 mb-2">JavaScript / Node.js Example</h4>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-3">Use <code className="bg-neutral-100 dark:bg-neutral-800 dark:text-neutral-300 px-1 rounded">fetch</code> (built-in for Node 18+ and browsers).</p>
              <div className="bg-neutral-900 text-neutral-100 rounded-md p-4 text-sm font-mono overflow-x-auto relative group">
                <button
                  onClick={() => copySnippet(`const API_KEY = "${displayKey}";\nconst BASE_URL = "${baseUrl}";\n\nconst res = await fetch(\`\${BASE_URL}/api/sessions\`, {\n  headers: { "X-API-Key": API_KEY }\n});\nconst sessions = await res.json();\nconsole.log(sessions);`, "js")}
                  className="absolute top-2 right-2 p-1.5 bg-neutral-700 hover:bg-neutral-600 rounded text-neutral-300 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  {copiedSnippet === "js" ? <CheckCircleIcon className="w-4 h-4 text-green-400" /> : <ClipboardDocumentIcon className="w-4 h-4" />}
                </button>
                <pre className="text-yellow-400 mb-1">{`// JavaScript / Node.js`}</pre>
                <pre>{`const API_KEY = "${displayKey}";
const BASE_URL = "${baseUrl}";

const res = await fetch(\`\${BASE_URL}/api/sessions\`, {
  headers: { "X-API-Key": API_KEY }
});
const sessions = await res.json();
console.log(sessions);`}</pre>
              </div>
            </div>

            {/* Error responses */}
            <div>
              <h4 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200 mb-2">Error Responses</h4>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-3">Common error codes and their meaning.</p>
              <div className="overflow-x-auto">
                <table className="text-xs w-full">
                  <thead>
                    <tr className="border-b border-neutral-200 dark:border-neutral-700 text-left">
                      <th className="py-2 pr-4 font-semibold text-neutral-700 dark:text-neutral-300">Status</th>
                      <th className="py-2 pr-4 font-semibold text-neutral-700 dark:text-neutral-300">Meaning</th>
                      <th className="py-2 font-semibold text-neutral-700 dark:text-neutral-300">Example Response</th>
                    </tr>
                  </thead>
                  <tbody className="text-neutral-600 dark:text-neutral-400">
                    <tr className="border-b border-neutral-100 dark:border-neutral-800">
                      <td className="py-2 pr-4 font-mono text-red-600 dark:text-red-400">401</td>
                      <td className="py-2 pr-4">Invalid or missing API key</td>
                      <td className="py-2 font-mono text-neutral-500 dark:text-neutral-400">{`{"detail": "Not authenticated"}`}</td>
                    </tr>
                    <tr className="border-b border-neutral-100 dark:border-neutral-800">
                      <td className="py-2 pr-4 font-mono text-red-600 dark:text-red-400">403</td>
                      <td className="py-2 pr-4">Insufficient scopes for this action</td>
                      <td className="py-2 font-mono text-neutral-500 dark:text-neutral-400">{`{"detail": "Forbidden"}`}</td>
                    </tr>
                    <tr className="border-b border-neutral-100 dark:border-neutral-800">
                      <td className="py-2 pr-4 font-mono text-amber-600 dark:text-amber-400">404</td>
                      <td className="py-2 pr-4">Resource not found</td>
                      <td className="py-2 font-mono text-neutral-500 dark:text-neutral-400">{`{"detail": "Session not found"}`}</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4 font-mono text-amber-600 dark:text-amber-400">429</td>
                      <td className="py-2 pr-4">Rate limit exceeded</td>
                      <td className="py-2 font-mono text-neutral-500 dark:text-neutral-400">{`{"detail": "Too many requests"}`}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════
//  AI Providers Tab
// ═══════════════════════════════════════════════════════════

interface ModelOption {
  id: string;
  label: string;
  hint: string;
}

const OPENAI_MODELS: ModelOption[] = [
  { id: "gpt-4.1",       label: "GPT-4.1",       hint: "$2.00 / $8.00 per 1M tokens" },
  { id: "gpt-4.1-mini",  label: "GPT-4.1 Mini",  hint: "$0.40 / $1.60 per 1M tokens" },
  { id: "gpt-4.1-nano",  label: "GPT-4.1 Nano",  hint: "$0.10 / $0.40 per 1M tokens" },
  { id: "gpt-4o",        label: "GPT-4o",         hint: "$2.50 / $10.00 per 1M tokens" },
  { id: "gpt-4o-mini",   label: "GPT-4o Mini",   hint: "$0.15 / $0.60 per 1M tokens" },
  { id: "o3",            label: "o3 (Reasoning)", hint: "$2.00 / $8.00 per 1M tokens" },
  { id: "o4-mini",       label: "o4-mini (Reasoning)", hint: "$1.10 / $4.40 per 1M tokens" },
  { id: "o1",            label: "o1 (Legacy)",    hint: "$15.00 / $60.00 per 1M tokens" },
  { id: "o1-mini",       label: "o1-mini",        hint: "$3.00 / $12.00 per 1M tokens" },
  { id: "gpt-4-turbo",   label: "GPT-4 Turbo (Legacy)", hint: "$10.00 / $30.00 per 1M tokens" },
];

const ANTHROPIC_MODELS: ModelOption[] = [
  { id: "claude-opus-4-20250514",    label: "Claude Opus 4",    hint: "$5.00 / $25.00 per 1M tokens" },
  { id: "claude-sonnet-4-20250514",  label: "Claude Sonnet 4",  hint: "$3.00 / $15.00 per 1M tokens" },
  { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5", hint: "$1.00 / $5.00 per 1M tokens" },
  { id: "claude-3-5-sonnet-20241022",label: "Claude 3.5 Sonnet",hint: "$3.00 / $15.00 per 1M tokens" },
  { id: "claude-3-5-haiku-20241022", label: "Claude 3.5 Haiku", hint: "$0.80 / $4.00 per 1M tokens" },
  { id: "claude-3-haiku-20240307",   label: "Claude 3 Haiku",   hint: "$0.25 / $1.25 per 1M tokens" },
];

const GEMINI_MODELS: ModelOption[] = [
  { id: "gemini-2.5-pro",       label: "Gemini 2.5 Pro",        hint: "$1.25 / $10.00 per 1M tokens" },
  { id: "gemini-2.5-flash",     label: "Gemini 2.5 Flash",      hint: "$0.30 / $2.50 per 1M tokens" },
  { id: "gemini-2.5-flash-lite",label: "Gemini 2.5 Flash-Lite", hint: "$0.10 / $0.40 per 1M tokens" },
  { id: "gemini-2.0-flash",     label: "Gemini 2.0 Flash",      hint: "$0.10 / $0.40 per 1M tokens" },
  { id: "gemini-2.0-flash-lite",label: "Gemini 2.0 Flash-Lite", hint: "$0.075 / $0.30 per 1M tokens" },
];

type ProviderType = "llm_openai" | "llm_anthropic" | "llm_gemini";

interface AIProviderState {
  integrationId: string | null;
  apiKey: string;
  maskedKey: string;
  model: string;
  status: "connected" | "not_configured" | "error";
  statusMessage: string;
  saving: boolean;
  testing: boolean;
}

function makeInitialState(defaultModel: string): AIProviderState {
  return {
    integrationId: null,
    apiKey: "",
    maskedKey: "",
    model: defaultModel,
    status: "not_configured",
    statusMessage: "",
    saving: false,
    testing: false,
  };
}

/** Extract a human-readable error string from an Axios error or plain Error. */
function extractErrorMessage(e: any): string {
  // FastAPI returns { detail: "..." } or { detail: [...] }
  const detail = e?.response?.data?.detail;
  if (typeof detail === "string" && detail) return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    return detail.map((d: any) => d?.msg || JSON.stringify(d)).join("; ");
  }
  // Generic Axios message fallback
  return e?.message || "Unknown error";
}

function AIProvidersTab() {
  const [loading, setLoading] = useState(true);
  const [openai, setOpenai] = useState<AIProviderState>(makeInitialState(OPENAI_MODELS[0].id));
  const [anthropic, setAnthropic] = useState<AIProviderState>(makeInitialState(ANTHROPIC_MODELS[1].id));
  const [gemini, setGemini] = useState<AIProviderState>(makeInitialState(GEMINI_MODELS[0].id));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const integrations = await listIntegrations();

      const loadProvider = (
        intType: string,
        models: ModelOption[],
        defaultIdx: number,
        setState: React.Dispatch<React.SetStateAction<AIProviderState>>
      ) => {
        const integ = integrations.find((i: any) => i.integration_type === intType);
        if (integ) {
          const key = integ.config?.api_key || "";
          const hasKey = Boolean(key);
          setState((prev) => ({
            ...prev,
            integrationId: integ.id,
            apiKey: "",
            maskedKey: hasKey ? `\u2022\u2022\u2022\u2022 ${key.slice(-4)}` : "",
            model: integ.config?.model || models[defaultIdx].id,
            // Don't override status/message if the user just saw a test result
            status: prev.status === "error" ? prev.status : (integ.is_active && hasKey ? "connected" : "not_configured"),
            statusMessage: prev.status === "error" ? prev.statusMessage : (integ.is_active && hasKey ? "Connected" : ""),
          }));
        } else {
          setState(makeInitialState(models[defaultIdx].id));
        }
      };

      loadProvider("llm_openai", OPENAI_MODELS, 0, setOpenai);
      loadProvider("llm_anthropic", ANTHROPIC_MODELS, 1, setAnthropic);
      loadProvider("llm_gemini", GEMINI_MODELS, 0, setGemini);
    } catch {
      // silently handle load errors
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async (
    type: ProviderType,
    state: AIProviderState,
    setState: React.Dispatch<React.SetStateAction<AIProviderState>>
  ) => {
    if (!state.apiKey && !state.maskedKey) {
      setState((prev) => ({ ...prev, status: "error", statusMessage: "Please enter an API key." }));
      return;
    }
    setState((prev) => ({ ...prev, saving: true, status: "not_configured", statusMessage: "Saving and verifying key…" }));
    try {
      await upsertIntegration({
        integration_type: type,
        config: { api_key: state.apiKey || "", model: state.model },
        is_active: true,
      });
      // Auto-test the key — never show "Connected" for an invalid key
      const res = await testIntegration(type);
      if (res.status === "ok") {
        setState((prev) => ({
          ...prev,
          saving: false,
          apiKey: "",
          status: "connected",
          statusMessage: res.message || "Connected",
        }));
        await load();
      } else {
        // Key is bad — mark integration as inactive so it won't show "connected" on reload
        try { await upsertIntegration({ integration_type: type, config: { api_key: state.apiKey || "", model: state.model }, is_active: false }); } catch {}
        setState((prev) => ({
          ...prev,
          saving: false,
          status: "error",
          statusMessage: res.message || "API key is invalid. Please check and try again.",
        }));
      }
    } catch (e: any) {
      setState((prev) => ({
        ...prev,
        saving: false,
        status: "error",
        statusMessage: extractErrorMessage(e),
      }));
    }
  };

  const handleTest = async (
    type: ProviderType,
    setState: React.Dispatch<React.SetStateAction<AIProviderState>>
  ) => {
    setState((prev) => ({ ...prev, testing: true, statusMessage: "" }));
    try {
      const res = await testIntegration(type);
      if (res.status === "ok") {
        setState((prev) => ({
          ...prev,
          status: "connected",
          statusMessage: res.message || "Connected",
        }));
      } else {
        setState((prev) => ({
          ...prev,
          status: "error",
          statusMessage: res.message || "Connection failed. Check your API key.",
        }));
      }
    } catch (e: any) {
      setState((prev) => ({
        ...prev,
        status: "error",
        statusMessage: extractErrorMessage(e),
      }));
    }
    setState((prev) => ({ ...prev, testing: false }));
  };

  const handleRemove = async (
    integrationId: string,
    defaultModel: string,
    setState: React.Dispatch<React.SetStateAction<AIProviderState>>
  ) => {
    try {
      await deleteIntegration(integrationId);
      setState(makeInitialState(defaultModel));
    } catch (e: any) {
      setState((prev) => ({
        ...prev,
        status: "error",
        statusMessage: extractErrorMessage(e),
      }));
    }
  };

  if (loading) return <div className="text-neutral-500 dark:text-neutral-400">Loading AI providers...</div>;

  const renderProviderCard = (
    label: string,
    icon: string,
    type: ProviderType,
    models: ModelOption[],
    state: AIProviderState,
    setState: React.Dispatch<React.SetStateAction<AIProviderState>>,
    bgColor: string,
    textColor: string,
    keyHint: string
  ) => {
    const isConnected = state.status === "connected";
    const isError = state.status === "error";
    const statusDotColor = isConnected ? "bg-green-500" : isError ? "bg-red-500" : "bg-yellow-500";
    const selectedModelHint = models.find((m) => m.id === state.model)?.hint || "";

    return (
      <div className="bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-700 p-5">
        {/* Provider header */}
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-10 h-10 ${bgColor} rounded-md flex items-center justify-center flex-shrink-0`}>
            <span className={`${textColor} font-bold text-sm`}>{icon}</span>
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">{label}</h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${statusDotColor}`} />
              <span className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                {isConnected ? "Connected" : isError ? "Error" : "Not configured"}
              </span>
            </div>
          </div>
        </div>

        {/* Error / success message */}
        {state.statusMessage && (
          <div className={`mb-3 p-2.5 rounded text-xs ${
            isError
              ? "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800"
              : "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800"
          }`}>
            {state.statusMessage}
          </div>
        )}

        {/* API Key */}
        <div className="mb-3">
          <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1 block">
            API Key
          </label>
          <input
            type="password"
            value={state.apiKey}
            onChange={(e) => setState((prev) => ({ ...prev, apiKey: e.target.value }))}
            placeholder={state.maskedKey || keyHint}
            className="w-full border dark:border-neutral-700 rounded-md px-3 py-2 text-sm dark:bg-neutral-800 dark:text-neutral-200 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-brand-lime/40"
          />
        </div>

        {/* Model selector */}
        <div className="mb-4">
          <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1 block">
            Model
          </label>
          <select
            value={state.model}
            onChange={(e) => setState((prev) => ({ ...prev, model: e.target.value }))}
            className="w-full border dark:border-neutral-700 rounded-md px-3 py-2 text-sm bg-white dark:bg-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-brand-lime/40"
          >
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
          {selectedModelHint && (
            <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
              Pricing: {selectedModelHint} (input / output)
            </p>
          )}
        </div>

        {/* Usage limit note */}
        <div className="mb-4 p-2 bg-amber-50 dark:bg-amber-900/10 rounded text-xs text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
          Free-tier users on the platform key are limited to <strong>$0.10</strong> total usage.
          Configuring your own key removes this limit.
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => handleSave(type, state, setState)}
            disabled={state.saving}
            className="px-4 py-2 bg-brand-lime text-brand-dark text-sm font-medium rounded-md hover:bg-brand-lime/90 shadow-sm hover:shadow-[0_0_16px_-4px_rgba(228,255,26,0.4)] transition-colors disabled:opacity-50"
          >
            {state.saving ? "Saving..." : "Save"}
          </button>
          {state.integrationId && (
            <button
              onClick={() => handleTest(type, setState)}
              disabled={state.testing}
              className="px-4 py-2 border dark:border-neutral-700 text-sm rounded-md hover:bg-neutral-50 dark:text-neutral-300 dark:hover:bg-neutral-800 disabled:opacity-50"
            >
              {state.testing ? (
                <span className="flex items-center gap-1.5">
                  <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" />
                  Testing...
                </span>
              ) : (
                "Test Connection"
              )}
            </button>
          )}
          {state.integrationId && (
            <button
              onClick={() => handleRemove(state.integrationId!, models[0].id, setState)}
              className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md ml-auto"
              title={`Remove ${label}`}
            >
              <TrashIcon className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {renderProviderCard(
          "OpenAI",
          "AI",
          "llm_openai",
          OPENAI_MODELS,
          openai,
          setOpenai,
          "bg-green-100 dark:bg-green-900/40",
          "text-green-700 dark:text-green-400",
          "sk-..."
        )}
        {renderProviderCard(
          "Anthropic",
          "An",
          "llm_anthropic",
          ANTHROPIC_MODELS,
          anthropic,
          setAnthropic,
          "bg-amber-100 dark:bg-amber-900/40",
          "text-amber-700 dark:text-amber-400",
          "sk-ant-..."
        )}
        {renderProviderCard(
          "Google Gemini",
          "G",
          "llm_gemini",
          GEMINI_MODELS,
          gemini,
          setGemini,
          "bg-blue-100 dark:bg-blue-900/40",
          "text-blue-700 dark:text-blue-400",
          "AIza..."
        )}
      </div>
      <div className="text-xs text-neutral-500 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-800 rounded p-3 border border-neutral-200 dark:border-neutral-700">
        <strong>How it works:</strong> When you configure your own API key, all AI features (document generation,
        requirement trees, conversation summaries, etc.) use your key directly — with no platform spending limit.
        The first provider with a valid key is used. Priority order: OpenAI → Anthropic → Google Gemini.
      </div>
    </div>
  );
}
