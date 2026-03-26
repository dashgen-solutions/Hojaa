'use client';

import React from 'react';
import { XMarkIcon, UserCircleIcon } from '@heroicons/react/24/outline';
import type { ChatChannelMemberInfo } from '@/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export type PeerProfileData = {
  user_id: string;
  username: string;
  email?: string;
  avatar_url?: string | null;
  custom_status?: string | null;
  status_emoji?: string | null;
  job_title?: string | null;
  org_role?: string | null;
  is_online?: boolean;
};

function toPeerFromMember(m: ChatChannelMemberInfo): PeerProfileData {
  return {
    user_id: m.user_id,
    username: m.username,
    email: m.email,
    avatar_url: m.avatar_url,
    custom_status: m.custom_status,
    status_emoji: m.status_emoji,
    job_title: m.job_title,
    org_role: m.org_role,
    is_online: m.is_online,
  };
}

interface UserProfileModalProps {
  peer: PeerProfileData | null;
  onClose: () => void;
}

/** Neutral "no photo" placeholder — outlined user silhouette */
function NoAvatar({ size = 56, className = '' }: { size?: number; className?: string }) {
  return (
    <div
      className={`rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 flex items-center justify-center flex-shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      <UserCircleIcon className="text-neutral-400 dark:text-neutral-500" style={{ width: size * 0.6, height: size * 0.6 }} />
    </div>
  );
}

/** Profile card for another user (DM header / member preview). */
export default function UserProfileModal({ peer, onClose }: UserProfileModalProps) {
  if (!peer) return null;

  const avatarSrc =
    peer.avatar_url &&
    (peer.avatar_url.startsWith('http') ? peer.avatar_url : `${API_URL}${peer.avatar_url}`);

  const roleLabel = peer.org_role
    ? peer.org_role.replace(/_/g, ' ')
    : null;

  return (
    <>
      <div className="fixed inset-0 z-[200] bg-black/40" onClick={onClose} aria-hidden />
      <div
        className="fixed z-[210] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(400px,calc(100vw-2rem))] bg-white dark:bg-[#1a1d21] rounded-xl shadow-2xl border border-neutral-200 dark:border-[#383a3f] overflow-hidden"
        role="dialog"
        aria-labelledby="peer-profile-title"
      >
        <div className="flex items-start justify-between px-5 py-4 border-b border-neutral-200 dark:border-[#383a3f]">
          <div className="flex items-center gap-3 min-w-0">
            {avatarSrc ? (
              <img
                src={avatarSrc}
                alt=""
                className="w-14 h-14 rounded-xl object-cover border border-neutral-200 dark:border-[#383a3f] flex-shrink-0"
              />
            ) : (
              <NoAvatar size={56} />
            )}
            <div className="min-w-0">
              <h2 id="peer-profile-title" className="text-lg font-semibold text-neutral-900 dark:text-white truncate">
                {peer.username}
              </h2>
              <div className="flex items-center gap-2 mt-0.5">
                {peer.is_online !== undefined && (
                  <span
                    className={`w-2 h-2 rounded-full flex-shrink-0 ${peer.is_online ? 'bg-green-500' : 'bg-neutral-400'}`}
                    title={peer.is_online ? 'Online' : 'Offline'}
                  />
                )}
                <span className="text-xs text-neutral-500 dark:text-gray-400">
                  {peer.is_online ? 'Online' : 'Offline'}
                </span>
              </div>
              {(peer.custom_status || peer.status_emoji) && (
                <p className="text-xs text-neutral-500 dark:text-gray-400 truncate mt-0.5">
                  {peer.status_emoji && <span className="mr-1">{peer.status_emoji}</span>}
                  {peer.custom_status}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-[#2a2d32]"
            aria-label="Close"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3 text-sm">
          {peer.email && (
            <div>
              <p className="text-[11px] uppercase tracking-wide text-neutral-400 dark:text-gray-500 mb-0.5">Email</p>
              <p className="text-neutral-800 dark:text-gray-200 break-all">{peer.email}</p>
            </div>
          )}
          {peer.job_title && (
            <div>
              <p className="text-[11px] uppercase tracking-wide text-neutral-400 dark:text-gray-500 mb-0.5">Job title</p>
              <p className="text-neutral-800 dark:text-gray-200">{peer.job_title}</p>
            </div>
          )}
          {roleLabel && (
            <div>
              <p className="text-[11px] uppercase tracking-wide text-neutral-400 dark:text-gray-500 mb-0.5">Organization role</p>
              <p className="text-neutral-800 dark:text-gray-200 capitalize">{roleLabel}</p>
            </div>
          )}
          {!peer.email && !peer.job_title && !roleLabel && !(peer.custom_status || peer.status_emoji) && (
            <p className="text-neutral-500 dark:text-gray-500 text-sm">No additional details added yet.</p>
          )}
        </div>
      </div>
    </>
  );
}

export function peerFromChannelMember(m: ChatChannelMemberInfo): PeerProfileData {
  return toPeerFromMember(m);
}

/** Inline no-photo placeholder for use outside the modal */
export function AvatarOrPlaceholder({
  avatarUrl,
  username,
  size = 32,
  rounded = 'lg',
}: {
  avatarUrl?: string | null;
  username: string;
  size?: number;
  rounded?: 'full' | 'lg' | 'xl';
}) {
  const [imgError, setImgError] = React.useState(false);
  const src =
    !imgError &&
    avatarUrl &&
    (avatarUrl.startsWith('http') ? avatarUrl : `${API_URL}${avatarUrl}`);

  const roundedCls = rounded === 'full' ? 'rounded-full' : rounded === 'xl' ? 'rounded-xl' : 'rounded-lg';

  const placeholder = (
    <div
      className={`${roundedCls} bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 flex items-center justify-center flex-shrink-0`}
      style={{ width: size, height: size }}
    >
      <UserCircleIcon
        className="text-neutral-400 dark:text-neutral-500"
        style={{ width: size * 0.65, height: size * 0.65 }}
      />
    </div>
  );

  if (src) {
    return (
      <img
        src={src}
        alt={username}
        className={`${roundedCls} object-cover flex-shrink-0 border border-neutral-200 dark:border-[#383a3f]`}
        style={{ width: size, height: size }}
        onError={() => setImgError(true)}
      />
    );
  }

  return placeholder;
}
