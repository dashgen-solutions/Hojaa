'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  ArrowLeftIcon,
  BuildingOffice2Icon,
  CameraIcon,
  TrashIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '@/contexts/AuthContext';
import {
  getMyStatus,
  updateMyStatus,
  patchMyProfile,
  uploadMyAvatar,
  deleteMyAvatar,
} from '@/lib/api';
import StatusPicker from '@/components/messaging/StatusPicker';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

/** Dialog shown when the chosen file doesn't meet requirements */
function FileErrorDialog({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <>
      <div className="fixed inset-0 z-[300] bg-black/40" onClick={onClose} aria-hidden />
      <div className="fixed z-[310] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(380px,calc(100vw-2rem))] bg-white dark:bg-[#1a1d21] rounded-xl shadow-2xl border border-neutral-200 dark:border-neutral-700 p-6">
        <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100 mb-2">Cannot upload file</h3>
        <p className="text-sm text-neutral-700 dark:text-neutral-300 mb-5">{message}</p>
        <div className="text-xs text-neutral-500 dark:text-neutral-400 space-y-1 mb-5 bg-neutral-50 dark:bg-neutral-800 rounded-lg p-3">
          <p className="font-medium text-neutral-700 dark:text-neutral-300">Requirements:</p>
          <p>• Formats: JPEG, PNG, WebP, GIF</p>
          <p>• Max file size: 5 MB</p>
          <p>• Recommended dimensions: at least 128 × 128 px</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-full py-2 rounded-md bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 text-sm font-medium hover:opacity-90"
        >
          OK
        </button>
      </div>
    </>
  );
}

export default function ProfilePage() {
  const { user, isAuthenticated, refreshUser, isOrgAdmin } = useAuth();
  const [jobTitle, setJobTitle] = useState('');
  const [statusText, setStatusText] = useState<string | null>(null);
  const [statusEmoji, setStatusEmoji] = useState<string | null>(null);
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    setJobTitle(user.job_title || '');
    setStatusText(user.custom_status ?? null);
    setStatusEmoji(user.status_emoji ?? null);
  }, [user]);

  useEffect(() => {
    if (!isAuthenticated) return;
    getMyStatus()
      .then((s) => {
        setStatusText(s.custom_status || null);
        setStatusEmoji(s.status_emoji || null);
      })
      .catch(() => {});
  }, [isAuthenticated]);

  const [avatarLoadError, setAvatarLoadError] = useState(false);
  const avatarSrc =
    !avatarLoadError &&
    user?.avatar_url &&
    (user.avatar_url.startsWith('http') ? user.avatar_url : `${API_URL}${user.avatar_url}`);

  const saveJobTitle = async () => {
    if (!user) return;
    setSaving(true);
    setMessage(null);
    try {
      await patchMyProfile({ job_title: jobTitle || null });
      await refreshUser();
      setMessage('Profile saved.');
    } catch {
      setMessage('Could not save job title.');
    } finally {
      setSaving(false);
    }
  };

  const onAvatarSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (fileInputRef.current) fileInputRef.current.value = '';

    // Client-side validation before uploading
    if (!ALLOWED_TYPES.includes(file.type as typeof ALLOWED_TYPES[number])) {
      setFileError(
        `"${file.name}" has an unsupported file type (${file.type || 'unknown'}). Please use JPEG, PNG, WebP, or GIF.`,
      );
      return;
    }
    if (file.size > MAX_BYTES) {
      const mb = (file.size / 1024 / 1024).toFixed(1);
      setFileError(`"${file.name}" is ${mb} MB. The maximum allowed size is 5 MB.`);
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      await uploadMyAvatar(file);
      setAvatarLoadError(false);
      await refreshUser();
      setMessage('Photo updated.');
    } catch {
      setMessage('Could not upload image. Use JPEG, PNG, WebP, or GIF under 5 MB.');
    } finally {
      setSaving(false);
    }
  };

  const onRemoveAvatar = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await deleteMyAvatar();
      await refreshUser();
      setMessage('Photo removed.');
    } catch {
      setMessage('Could not remove photo.');
    } finally {
      setSaving(false);
    }
  };

  const onStatusSaved = useCallback(
    async (status: string | null, emoji: string | null) => {
      setSaving(true);
      setMessage(null);
      try {
        const res = await updateMyStatus({ custom_status: status, status_emoji: emoji });
        setStatusText(res.custom_status || null);
        setStatusEmoji(res.status_emoji || null);
        await refreshUser();
        setMessage('Status updated.');
        setShowStatusPicker(false);
      } catch {
        setMessage('Could not save status.');
      } finally {
        setSaving(false);
      }
    },
    [refreshUser],
  );

  if (!isAuthenticated || !user) {
    return (
      <div className="h-full flex items-center justify-center text-neutral-500 dark:text-neutral-400">
        Please sign in to view your profile.
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      {fileError && <FileErrorDialog message={fileError} onClose={() => setFileError(null)} />}
      <div className="max-w-2xl mx-auto px-6 py-8 pb-24">
        <Link
          href="/messages"
          className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 mb-6"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          Back to Messages
        </Link>

        {message && (
          <p className="mb-4 text-sm text-neutral-600 dark:text-neutral-400">{message}</p>
        )}

        {/* Name + status (same pattern as Messages sidebar) */}
        <div className="flex items-start gap-3 mb-8">
          {avatarSrc ? (
            <img
              src={avatarSrc}
              alt=""
              className="w-14 h-14 rounded-xl object-cover border border-neutral-200 dark:border-neutral-600 flex-shrink-0"
              onError={() => setAvatarLoadError(true)}
            />
          ) : (
            <div className="w-14 h-14 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 flex items-center justify-center flex-shrink-0">
              <UserCircleIcon className="w-9 h-9 text-neutral-400 dark:text-neutral-500" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 truncate">{user.username}</h1>
            <div className="mt-1">
              {!showStatusPicker ? (
                <button
                  type="button"
                  onClick={() => setShowStatusPicker(true)}
                  className="text-left w-full rounded-md px-0 py-0.5 hover:bg-neutral-100 dark:hover:bg-neutral-800/80 transition-colors"
                >
                  {(statusText || statusEmoji) ? (
                    <p className="text-[13px] text-neutral-600 dark:text-gray-400">
                      {statusEmoji && <span className="mr-1">{statusEmoji}</span>}
                      {statusText}
                    </p>
                  ) : (
                    <p className="text-[13px] text-neutral-400 dark:text-gray-600">Set a status</p>
                  )}
                </button>
              ) : (
                <div className="relative z-20 mt-1">
                  <StatusPicker
                    currentStatus={statusText}
                    currentEmoji={statusEmoji}
                    onSave={onStatusSaved}
                    onClose={() => setShowStatusPicker(false)}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Photo */}
        <section className="bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-700 p-6 mb-6">
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-4">Profile photo</h2>
          <div className="flex flex-wrap items-center gap-4">
            {avatarSrc ? (
              <img
                src={avatarSrc}
                alt=""
                className="w-24 h-24 rounded-xl object-cover border border-neutral-200 dark:border-neutral-600"
                onError={() => setAvatarLoadError(true)}
              />
            ) : (
              <div className="w-24 h-24 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 flex items-center justify-center">
                <UserCircleIcon className="w-16 h-16 text-neutral-400 dark:text-neutral-500" />
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={onAvatarSelected}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={saving}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 text-sm font-medium hover:opacity-90 disabled:opacity-50"
              >
                <CameraIcon className="w-4 h-4" />
                Upload photo
              </button>
              {user.avatar_url && (
                <button
                  type="button"
                  onClick={onRemoveAvatar}
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-neutral-300 dark:border-neutral-600 text-sm text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-50"
                >
                  <TrashIcon className="w-4 h-4" />
                  Remove
                </button>
              )}
            </div>
          </div>
          <p className="text-xs text-neutral-500 mt-3">JPEG, PNG, WebP, or GIF · Max 5 MB · Recommended: at least 128 × 128 px</p>
        </section>

        {/* Account */}
        <section className="bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-700 p-6 mb-6">
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-4">Account</h2>
          <div className="space-y-3 text-sm">
            <div>
              <span className="text-neutral-500 dark:text-neutral-400">Email</span>
              <p className="font-medium text-neutral-900 dark:text-neutral-100">{user.email}</p>
            </div>
            <div>
              <label className="block text-neutral-500 dark:text-neutral-400 mb-1">Job title</label>
              <input
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="e.g. Product Manager"
                className="w-full max-w-md border border-neutral-200 dark:border-neutral-600 rounded-md px-3 py-2 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
              />
              <button
                type="button"
                onClick={saveJobTitle}
                disabled={saving}
                className="mt-2 px-3 py-1.5 text-sm rounded-md bg-brand-lime text-brand-dark font-medium hover:opacity-90 disabled:opacity-50"
              >
                Save job title
              </button>
            </div>
          </div>
        </section>

        {/* Organization */}
        {user.organization && (
          <section className="bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-700 p-6 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <BuildingOffice2Icon className="w-5 h-5 text-neutral-600 dark:text-neutral-300" />
              <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Organization</h2>
            </div>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-neutral-500 dark:text-neutral-400">Name</span>
                <p className="font-medium text-neutral-900 dark:text-neutral-100">{user.organization.name}</p>
              </div>
              <div>
                <span className="text-neutral-500 dark:text-neutral-400">Your role</span>
                <p className="font-medium text-neutral-900 dark:text-neutral-100 capitalize">
                  {user.org_role || '—'}
                </p>
              </div>
              {user.organization.logo_url && (
                <div className="pt-2">
                  <span className="text-neutral-500 dark:text-neutral-400 text-xs block mb-1">Logo</span>
                  <img
                    src={
                      user.organization.logo_url.startsWith('http')
                        ? user.organization.logo_url
                        : `${API_URL}${user.organization.logo_url}`
                    }
                    alt=""
                    className="h-12 object-contain rounded border border-neutral-200 dark:border-neutral-600"
                  />
                </div>
              )}
              {(isOrgAdmin || user.org_role === 'owner') && (
                <Link
                  href="/settings"
                  className="inline-block mt-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Organization branding &amp; settings →
                </Link>
              )}
            </div>
          </section>
        )}

        <p className="text-xs text-neutral-400 dark:text-neutral-500">
          Workspace settings (integrations, API keys, AI) are under{' '}
          <Link href="/settings" className="text-blue-600 dark:text-blue-400 hover:underline">
            Settings
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
