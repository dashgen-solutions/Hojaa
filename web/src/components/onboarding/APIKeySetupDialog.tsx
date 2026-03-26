'use client';

import { useState, useEffect, useCallback } from 'react';
import { listIntegrations, upsertIntegration, testIntegration } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

type ProviderStatus = 'idle' | 'saving' | 'testing' | 'connected' | 'error';

export default function APIKeySetupDialog() {
  const { isAuthenticated, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState(false);

  const [openaiKey, setOpenaiKey] = useState('');
  const [anthropicKey, setAnthropicKey] = useState('');
  const [openaiStatus, setOpenaiStatus] = useState<ProviderStatus>('idle');
  const [anthropicStatus, setAnthropicStatus] = useState<ProviderStatus>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const checkIntegrations = useCallback(async () => {
    try {
      const integrations = await listIntegrations();
      const hasOpenai = integrations.some(
        (i: { integration_type: string; is_active: boolean; config?: { api_key?: string } }) =>
          i.integration_type === 'llm_openai' && i.is_active && i.config?.api_key
      );
      const hasAnthropic = integrations.some(
        (i: { integration_type: string; is_active: boolean; config?: { api_key?: string } }) =>
          i.integration_type === 'llm_anthropic' && i.is_active && i.config?.api_key
      );
      const hasGemini = integrations.some(
        (i: { integration_type: string; is_active: boolean; config?: { api_key?: string } }) =>
          i.integration_type === 'llm_gemini' && i.is_active && i.config?.api_key
      );

      if (!hasOpenai && !hasAnthropic && !hasGemini) {
        const dismissed = localStorage.getItem(`apikey_dialog_dismissed_${user?.id}`);
        if (!dismissed) {
          setOpen(true);
        }
      }
    } catch {
      // Not logged in or API error — don't show
    } finally {
      setChecked(true);
    }
  }, [user?.id]);

  useEffect(() => {
    if (isAuthenticated && user && !checked) {
      checkIntegrations();
    }
  }, [isAuthenticated, user, checked, checkIntegrations]);

  const handleSave = async (type: 'llm_openai' | 'llm_anthropic') => {
    const key = type === 'llm_openai' ? openaiKey : anthropicKey;
    const setStatus = type === 'llm_openai' ? setOpenaiStatus : setAnthropicStatus;

    if (!key.trim()) return;

    setStatus('saving');
    setErrorMsg('');
    try {
      await upsertIntegration({
        integration_type: type,
        config: { api_key: key.trim(), model: type === 'llm_openai' ? 'gpt-4o' : 'claude-sonnet-4-20250514' },
        is_active: true,
      });
      setStatus('testing');
      const res = await testIntegration(type);
      if (res.status === 'ok') {
        setStatus('connected');
      } else {
        setStatus('error');
        setErrorMsg(res.message || 'Connection test failed');
      }
    } catch (err: unknown) {
      setStatus('error');
      const axiosErr = err as { response?: { data?: { detail?: string } } }; const msg = axiosErr?.response?.data?.detail || (err instanceof Error ? err.message : 'Failed to save');
      setErrorMsg(msg);
    }
  };

  const handleSkip = () => {
    localStorage.setItem(`apikey_dialog_dismissed_${user?.id}`, 'true');
    setOpen(false);
  };

  const handleDone = () => {
    setOpen(false);
  };

  const hasAnyConnected = openaiStatus === 'connected' || anthropicStatus === 'connected';

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-neutral-900 border border-neutral-700 rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-yellow-500/10 flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-white">AI Provider Keys Missing</h2>
          <p className="text-neutral-400 text-sm mt-2">
            Most features (discovery, tree building, chat) require an AI provider.
            Add at least one API key to get started.
          </p>
        </div>

        {/* OpenAI */}
        <div className="mb-4">
          <label className="flex items-center justify-between mb-1.5">
            <span className="text-sm font-medium text-neutral-200">OpenAI</span>
            <StatusBadge status={openaiStatus} />
          </label>
          <div className="flex gap-2">
            <input
              type="password"
              placeholder="sk-proj-..."
              value={openaiKey}
              onChange={(e) => { setOpenaiKey(e.target.value); setOpenaiStatus('idle'); }}
              className="flex-1 bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-brand-lime"
            />
            <button
              onClick={() => handleSave('llm_openai')}
              disabled={!openaiKey.trim() || openaiStatus === 'saving' || openaiStatus === 'testing'}
              className="px-4 py-2 text-sm font-medium bg-neutral-800 border border-neutral-600 text-white rounded-lg hover:bg-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {openaiStatus === 'saving' || openaiStatus === 'testing' ? 'Testing...' : 'Save'}
            </button>
          </div>
        </div>

        {/* Anthropic */}
        <div className="mb-4">
          <label className="flex items-center justify-between mb-1.5">
            <span className="text-sm font-medium text-neutral-200">Anthropic (Claude)</span>
            <StatusBadge status={anthropicStatus} />
          </label>
          <div className="flex gap-2">
            <input
              type="password"
              placeholder="sk-ant-..."
              value={anthropicKey}
              onChange={(e) => { setAnthropicKey(e.target.value); setAnthropicStatus('idle'); }}
              className="flex-1 bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-brand-lime"
            />
            <button
              onClick={() => handleSave('llm_anthropic')}
              disabled={!anthropicKey.trim() || anthropicStatus === 'saving' || anthropicStatus === 'testing'}
              className="px-4 py-2 text-sm font-medium bg-neutral-800 border border-neutral-600 text-white rounded-lg hover:bg-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {anthropicStatus === 'saving' || anthropicStatus === 'testing' ? 'Testing...' : 'Save'}
            </button>
          </div>
        </div>

        {/* Error */}
        {errorMsg && (
          <p className="text-red-400 text-xs mb-4">{errorMsg}</p>
        )}

        {/* Info */}
        <p className="text-neutral-500 text-xs mb-5">
          Keys are stored securely per organization. You can update them anytime in Settings.
        </p>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleSkip}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-neutral-400 border border-neutral-700 rounded-lg hover:text-white hover:border-neutral-500 transition-colors"
          >
            Skip for now
          </button>
          {hasAnyConnected && (
            <button
              onClick={handleDone}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-brand-dark bg-brand-lime rounded-lg hover:opacity-90 transition-opacity"
            >
              Get Started
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: ProviderStatus }) {
  switch (status) {
    case 'connected':
      return <span className="text-xs text-green-400 font-medium">Connected</span>;
    case 'error':
      return <span className="text-xs text-red-400 font-medium">Error</span>;
    case 'saving':
    case 'testing':
      return <span className="text-xs text-yellow-400 font-medium">Testing...</span>;
    default:
      return null;
  }
}
