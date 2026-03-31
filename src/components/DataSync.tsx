'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { exportMemosToJson, importMemosFromJson, syncMemos } from '@/lib/storage';
import { getLocalDateString } from '@/lib/dateUtils';
import {
  acknowledgeActiveGmailAccount,
  fetchGmailStatus,
  GMAIL_STATUS_UPDATED_EVENT,
  notifyGmailStatusUpdated,
  openGmailInboxWindow,
} from '@/lib/gmail/client';
import { EMPTY_GMAIL_STATUS, type GmailStatus } from '@/lib/gmail/shared';

export type SyncStatus = 'idle' | 'syncing' | 'ready' | 'error';

interface DataSyncProps {
  onSyncComplete: () => void;
  userId?: string;
  isEnabled?: boolean;
  onSyncStateChange?: (isSyncing: boolean) => void;
}

const POLLING_INTERVAL_MS = 60_000;

export default function DataSync({
  onSyncComplete,
  userId,
  isEnabled = true,
  onSyncStateChange,
}: DataSyncProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [gmailStatus, setGmailStatus] = useState<GmailStatus>(EMPTY_GMAIL_STATUS);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const isSyncingRef = useRef(false);
  const pollingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const gmailPollingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onSyncCompleteRef = useRef(onSyncComplete);

  useEffect(() => {
    if (onSyncStateChange) {
      onSyncStateChange(syncStatus === 'syncing');
    }
  }, [syncStatus, onSyncStateChange]);

  useEffect(() => {
    onSyncCompleteRef.current = onSyncComplete;
  }, [onSyncComplete]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const refreshGmailStatus = useCallback(async () => {
    try {
      setGmailStatus(await fetchGmailStatus());
    } catch (error) {
      console.error('Gmail status refresh failed:', error);
      setGmailStatus((current) => {
        if (!current.configured) return current;
        return {
          ...current,
          error: 'Unable to refresh Gmail status.',
        };
      });
    }
  }, []);

  const stopPolling = useCallback(() => {
    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }
  }, []);

  const performSync = useCallback(async () => {
    if (!userId || !isEnabled || isSyncingRef.current) return;

    isSyncingRef.current = true;
    setSyncStatus('syncing');

    try {
      const result = await syncMemos(userId);
      if (result.ok) {
        setSyncStatus('ready');
        onSyncCompleteRef.current();
      } else {
        setSyncStatus('error');
        console.warn('Sync failed. If this persists, re-login may be required.');
      }
    } catch (err) {
      console.error('Sync orchestration error:', err);
      setSyncStatus('error');
    } finally {
      isSyncingRef.current = false;
    }
  }, [userId, isEnabled]);

  const startPolling = useCallback(() => {
    stopPolling();
    if (userId && isEnabled) {
      pollingTimerRef.current = setInterval(() => {
        void performSync();
      }, POLLING_INTERVAL_MS);
    }
  }, [userId, isEnabled, performSync, stopPolling]);

  const stopGmailPolling = useCallback(() => {
    if (gmailPollingTimerRef.current) {
      clearInterval(gmailPollingTimerRef.current);
      gmailPollingTimerRef.current = null;
    }
  }, []);

  const startGmailPolling = useCallback(() => {
    stopGmailPolling();
    gmailPollingTimerRef.current = setInterval(() => {
      void refreshGmailStatus();
    }, POLLING_INTERVAL_MS);
  }, [refreshGmailStatus, stopGmailPolling]);

  useEffect(() => {
    if (isEnabled && userId) {
      void performSync();
      startPolling();
    } else {
      stopPolling();
    }

    return () => stopPolling();
  }, [isEnabled, userId, performSync, startPolling, stopPolling]);

  useEffect(() => {
    if (!mounted) return;

    void refreshGmailStatus();
    startGmailPolling();

    return () => stopGmailPolling();
  }, [mounted, refreshGmailStatus, startGmailPolling, stopGmailPolling]);

  useEffect(() => {
    const handleGmailStatusUpdated = () => {
      void refreshGmailStatus();
    };

    window.addEventListener(GMAIL_STATUS_UPDATED_EVENT, handleGmailStatusUpdated);
    return () => window.removeEventListener(GMAIL_STATUS_UPDATED_EVENT, handleGmailStatusUpdated);
  }, [refreshGmailStatus]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        if (isEnabled && userId) {
          void performSync();
          startPolling();
        }
        void refreshGmailStatus();
        startGmailPolling();
      } else {
        stopPolling();
        stopGmailPolling();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [
    isEnabled,
    userId,
    performSync,
    startPolling,
    stopPolling,
    refreshGmailStatus,
    startGmailPolling,
    stopGmailPolling,
  ]);

  useEffect(() => {
    const handleClickOutside = (event: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('pointerdown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('pointerdown', handleClickOutside);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!mounted) return;

    const params = new URLSearchParams(window.location.search);
    const gmailResult = params.get('gmail');
    if (!gmailResult) return;

    if (gmailResult === 'denied') {
      alert('Gmail linking was canceled.');
    } else if (gmailResult !== 'linked') {
      alert('A Gmail linking error occurred. Please try again.');
    }

    void refreshGmailStatus();
    params.delete('gmail');
    const nextQuery = params.toString();
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}${window.location.hash}`;
    window.history.replaceState({}, '', nextUrl);
  }, [mounted, refreshGmailStatus]);

  const handleExport = () => {
    const json = exportMemosToJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `memos-backup-${getLocalDateString()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setIsOpen(false);
  };

  const handleOpenGmail = () => {
    if (!gmailStatus.redirectUrl) return;
    const acknowledgedStatus = acknowledgeActiveGmailAccount(gmailStatus);
    setGmailStatus(acknowledgedStatus);
    notifyGmailStatusUpdated();
    openGmailInboxWindow(gmailStatus.redirectUrl);
    setIsOpen(false);
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (loadEvent) => {
      const content = loadEvent.target?.result as string;

      try {
        const success = await importMemosFromJson(content, userId);
        if (success) {
          onSyncCompleteRef.current();
        } else {
          alert('The selected backup file is not valid.');
        }
      } catch (err: unknown) {
        if (err instanceof Error) {
          alert(`Import failed: ${err.message}`);
        }
      }
    };

    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setIsOpen(false);
  };

  if (!mounted) return null;

  const floatingContainerStyle: React.CSSProperties = {
    transform: 'translateZ(0)',
    bottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)',
    right: 'calc(env(safe-area-inset-right, 0px) + 1rem)',
  };

  const floatingMenuStyle: React.CSSProperties = {
    width: 'min(16rem, calc(100vw - 2rem))',
    maxWidth: 'calc(100vw - 2rem)',
    maxHeight: 'calc(100dvh - 7rem - env(safe-area-inset-bottom, 0px))',
  };

  return createPortal(
    <div
      className="fixed z-[9999] font-sans pointer-events-auto"
      ref={menuRef}
      style={floatingContainerStyle}
    >
      {isOpen && (
        <div
          className="absolute bottom-16 right-0 mb-2 overflow-y-auto overscroll-contain rounded-[24px] border border-zinc-100 bg-white p-2 shadow-2xl animate-in fade-in zoom-in-95 duration-200 dark:border-zinc-800 dark:bg-zinc-900"
          style={floatingMenuStyle}
        >
          <button
            onClick={handleOpenGmail}
            disabled={!gmailStatus.linked || !gmailStatus.redirectUrl}
            className="relative flex w-full touch-manipulation select-none items-center gap-3 rounded-2xl px-4 py-3 text-left text-[11px] font-black uppercase tracking-widest text-zinc-600 transition-all hover:bg-zinc-50 hover:text-[var(--eva-purple)] disabled:cursor-not-allowed disabled:opacity-45 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
          >
            {gmailStatus.activeHasNewMail && (
              <span className="absolute right-3 top-2 block h-2.5 w-2.5 rounded-full bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.9)]" />
            )}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="m3 7 9 6 9-6" />
            </svg>
            <div className="min-w-0 flex-1">
              <div>Open Gmail</div>
              <div className="mt-1 truncate text-[9px] font-semibold normal-case tracking-normal text-zinc-500 dark:text-zinc-400">
                {gmailStatus.linked
                  ? gmailStatus.activeEmailAddress || gmailStatus.emailAddress || 'Active linked Gmail'
                  : 'Link Gmail from Pilot Access first.'}
              </div>
            </div>
          </button>

          <button
            onClick={handleExport}
            className="flex w-full touch-manipulation select-none items-center gap-3 rounded-2xl px-4 py-3 text-[11px] font-black uppercase tracking-widest text-zinc-600 transition-all hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export Backup
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex w-full touch-manipulation select-none items-center gap-3 rounded-2xl px-4 py-3 text-[11px] font-black uppercase tracking-widest text-zinc-600 transition-all hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Import Backup
          </button>

          {userId && (
            <button
              onClick={() => void performSync()}
              disabled={syncStatus === 'syncing'}
              className="flex w-full touch-manipulation select-none items-center gap-3 rounded-2xl px-4 py-3 text-[11px] font-black uppercase tracking-widest text-zinc-600 transition-all hover:bg-zinc-50 hover:text-[var(--eva-purple)] disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={syncStatus === 'syncing' ? 'animate-spin' : ''}
              >
                <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                <path d="M21 3v5h-5" />
              </svg>
              {syncStatus === 'syncing' ? 'Syncing...' : 'Sync Now'}
            </button>
          )}
        </div>
      )}

      <div className="relative group">
        <div
          className={`absolute inset-[-8px] rounded-full border-2 border-dashed border-[var(--eva-purple)]/40 eva-spin-slow transition-opacity duration-500 sm:inset-[-10px] ${
            isOpen ? 'opacity-45' : 'opacity-80'
          }`}
        />

          {gmailStatus.hasNewMail && (
            <span className="pointer-events-none absolute right-1.5 top-1.5 z-30 block h-3 w-3 rounded-full border-2 border-[var(--bg-main)] bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.9)]" />
          )}

        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`relative z-10 flex h-14 w-14 touch-manipulation items-center justify-center rounded-full shadow-2xl transition-all duration-500 active:scale-90 sm:h-16 sm:w-16 ${
            isOpen
              ? 'rotate-45 border-2 border-purple-400 bg-purple-600 text-white shadow-[0_0_35px_var(--eva-purple-glow)]'
              : syncStatus === 'syncing'
                ? 'animate-pulse bg-[var(--eva-purple)] text-white shadow-[0_0_25px_var(--eva-purple-glow)]'
                : 'eva-glass border-2 border-[var(--eva-purple)]/60 text-[var(--eva-purple)] shadow-[0_0_25px_var(--eva-purple-glow)] hover:scale-110'
          }`}
        >
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[var(--eva-purple)]/20 to-transparent opacity-50" />

          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`relative z-20 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`}
          >
            {syncStatus === 'syncing' ? (
              <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
            ) : (
              <>
                <line
                  x1="12"
                  y1="5"
                  x2="12"
                  y2="19"
                  className={`transition-all duration-500 ${isOpen ? 'text-white' : 'text-[var(--eva-purple)]'}`}
                />
                <line
                  x1="5"
                  y1="12"
                  x2="19"
                  y2="12"
                  className={`transition-all duration-500 ${isOpen ? 'text-white' : 'text-[var(--eva-purple)]'}`}
                />
              </>
            )}

            {!isOpen && syncStatus !== 'syncing' && (
              <circle
                cx="12"
                cy="12"
                r="3"
                className={`${
                  syncStatus === 'error'
                    ? 'fill-rose-500/30 stroke-rose-500'
                    : 'fill-[var(--eva-green)]/30 stroke-[var(--eva-green)]'
                } animate-pulse`}
              />
            )}
          </svg>
        </button>
      </div>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImport}
        accept=".json"
        className="hidden"
      />
    </div>,
    document.body
  );
}
