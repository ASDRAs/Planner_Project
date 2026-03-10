'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { exportMemosToJson, importMemosFromJson, syncMemos } from '@/lib/storage';
import { getLocalDateString } from '@/lib/dateUtils';

export type SyncStatus = "idle" | "syncing" | "ready" | "error";

interface DataSyncProps {
  onSyncComplete: () => void;
  userId?: string;
  isEnabled?: boolean;
  onAuthFailure?: () => void;
}

export default function DataSync({ onSyncComplete, userId, isEnabled = true, onAuthFailure }: DataSyncProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  
  const isSyncingRef = useRef(false);
  const pollingTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const performSync = useCallback(async () => {
    if (!userId || !isEnabled || isSyncingRef.current) return;

    isSyncingRef.current = true;
    setSyncStatus("syncing");

    try {
      const result = await syncMemos(userId);
      if (result.ok) {
        setSyncStatus("ready");
        onSyncComplete();
      } else {
        setSyncStatus("error");
        // Check if it's an auth failure (simplistic check for now)
        // In a real app, we'd check the error code from Supabase
        // If we get an error but we're supposed to be logged in, it might be auth
        console.warn("Sync failed. If this persists, re-login may be required.");
      }
    } catch (err) {
      console.error("Sync orchestration error:", err);
      setSyncStatus("error");
    } finally {
      isSyncingRef.current = false;
    }
  }, [userId, isEnabled, onSyncComplete]);

  const startPolling = useCallback(() => {
    stopPolling();
    if (userId && isEnabled) {
      pollingTimerRef.current = setInterval(() => {
        performSync();
      }, 60000); // 60 seconds
    }
  }, [userId, isEnabled, performSync]);

  const stopPolling = () => {
    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }
  };

  // Initial Sync and Polling Setup
  useEffect(() => {
    if (isEnabled && userId) {
      performSync();
      startPolling();
    } else {
      stopPolling();
    }
    return () => stopPolling();
  }, [isEnabled, userId, performSync, startPolling]);

  // Visibility Handling
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        if (isEnabled && userId) {
          performSync();
          startPolling();
        }
      } else {
        stopPolling();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isEnabled, userId, performSync, startPolling]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  if (!mounted) return null;

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

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const content = e.target?.result as string;
      try {
        const success = await importMemosFromJson(content, userId);
        if (success) {
          onSyncComplete();
        } else {
          alert('데이터 형식이 올바르지 않습니다.');
        }
      } catch (err: unknown) {
        if (err instanceof Error) {
          alert(`가져오기 실패: ${err.message}`);
        }
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setIsOpen(false);
  };

  return createPortal(
    <div className="fixed bottom-6 right-6 z-[9999] font-sans pointer-events-auto" ref={menuRef} style={{ transform: 'translateZ(0)' }}>
      {/* 팝업 메뉴 */}
      {isOpen && (
        <div className="absolute bottom-16 right-0 mb-2 w-48 bg-white dark:bg-zinc-900 rounded-[24px] shadow-2xl border border-zinc-100 dark:border-zinc-800 p-2 animate-in fade-in zoom-in-95 duration-200">
          <button
            onClick={handleExport}
            className="w-full flex items-center gap-3 px-4 py-3 text-[11px] font-black text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-2xl transition-all uppercase tracking-widest"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Export Backup
          </button>
          
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center gap-3 px-4 py-3 text-[11px] font-black text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-2xl transition-all uppercase tracking-widest"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            Import Backup
          </button>

          {userId && (
            <button
              onClick={() => performSync()}
              disabled={syncStatus === "syncing"}
              className="w-full flex items-center gap-3 px-4 py-3 text-[11px] font-black text-zinc-600 dark:text-zinc-400 hover:text-[var(--eva-purple)] dark:hover:text-white hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-2xl transition-all uppercase tracking-widest disabled:opacity-50"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={syncStatus === "syncing" ? "animate-spin" : ""}><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>
              {syncStatus === "syncing" ? "Syncing..." : "Sync Now"}
            </button>
          )}
        </div>
      )}

      {/* 메인 플로팅 버튼 */}
      <div className="relative group">
        <div className={`absolute inset-[-10px] border-2 border-dashed border-[var(--eva-purple)]/40 rounded-full eva-spin-slow transition-opacity duration-500 ${isOpen || syncStatus === "syncing" ? 'opacity-0' : 'opacity-100'}`} />
        
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`w-16 h-16 flex items-center justify-center rounded-full shadow-2xl transition-all duration-500 active:scale-90 relative z-10 ${
            isOpen 
              ? 'bg-purple-600 text-white rotate-45 shadow-[0_0_35px_var(--eva-purple-glow)] border-2 border-purple-400' 
              : syncStatus === "syncing"
                ? 'bg-[var(--eva-purple)] text-white shadow-[0_0_25px_var(--eva-purple-glow)] animate-pulse'
                : 'eva-glass text-[var(--eva-purple)] border-2 border-[var(--eva-purple)]/60 hover:scale-110 shadow-[0_0_25px_var(--eva-purple-glow)]'
          }`}
        >
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[var(--eva-purple)]/20 to-transparent opacity-50" />
          
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={`relative z-20 ${syncStatus === "syncing" ? "animate-spin" : ""}`}>
            {syncStatus === "syncing" ? (
               <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
            ) : (
              <>
                <line x1="12" y1="5" x2="12" y2="19" className={`transition-all duration-500 ${isOpen ? 'text-white' : 'text-[var(--eva-purple)]'}`} />
                <line x1="5" y1="12" x2="19" y2="12" className={`transition-all duration-500 ${isOpen ? 'text-white' : 'text-[var(--eva-purple)]'}`} />
              </>
            )}
            
            {!isOpen && syncStatus !== "syncing" && (
              <circle cx="12" cy="12" r="3" className={`${syncStatus === "error" ? "fill-rose-500/30 stroke-rose-500" : "fill-[var(--eva-green)]/30 stroke-[var(--eva-green)]"} animate-pulse`} />
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
