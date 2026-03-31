'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';
import { fetchGmailStatus } from '@/lib/gmail/client';
import { EMPTY_GMAIL_STATUS, type GmailStatus } from '@/lib/gmail/shared';

function GmailActionRow({
  gmailStatus,
  isLoading,
  onPrimaryAction,
  onRelinkAction,
}: {
  gmailStatus: GmailStatus;
  isLoading: boolean;
  onPrimaryAction: () => void;
  onRelinkAction: () => void;
}) {
  const primaryLabel = gmailStatus.linked && !gmailStatus.requiresRelink ? 'Open Gmail' : 'Link Gmail';
  const secondaryLabel = gmailStatus.requiresRelink
    ? 'Connection expired. Please relink.'
    : gmailStatus.linked
      ? gmailStatus.emailAddress || 'Linked Gmail account'
      : gmailStatus.configured
        ? 'Connect Gmail and jump into inbox.'
        : 'Server-side Gmail config is required.';

  return (
    <div className="space-y-2 rounded-2xl border border-[var(--eva-purple)]/15 bg-[var(--eva-purple)]/5 p-3">
      <button
        type="button"
        onClick={onPrimaryAction}
        disabled={isLoading}
        className="flex w-full touch-manipulation select-none items-center gap-3 rounded-2xl px-3 py-3 text-left text-[11px] font-black uppercase tracking-widest text-[var(--text-primary)] transition-all hover:bg-white/60 disabled:opacity-60 dark:hover:bg-zinc-900/60"
      >
        <div className="relative flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-2xl bg-white/70 text-[var(--eva-purple)] shadow-sm dark:bg-zinc-950/70">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <path d="m3 7 9 6 9-6" />
          </svg>
          {gmailStatus.hasUnread && (
            <span className="absolute -right-0.5 -top-0.5 block h-2.5 w-2.5 rounded-full bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.9)]" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div>{isLoading ? 'Checking Gmail' : primaryLabel}</div>
          <div className="mt-1 truncate text-[9px] font-semibold normal-case tracking-normal text-zinc-500 dark:text-zinc-400">
            {secondaryLabel}
          </div>
        </div>
      </button>

      {(gmailStatus.linked || gmailStatus.requiresRelink) && (
        <button
          type="button"
          onClick={onRelinkAction}
          disabled={isLoading}
          className="w-full touch-manipulation select-none rounded-xl border border-[var(--eva-purple)]/20 px-3 py-2 text-[10px] font-black uppercase tracking-[0.25em] text-[var(--eva-purple)] transition-all hover:bg-[var(--eva-purple)]/8 disabled:opacity-60"
        >
          Change Gmail Account
        </button>
      )}
    </div>
  );
}

export default function Auth() {
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [gmailStatus, setGmailStatus] = useState<GmailStatus>(EMPTY_GMAIL_STATUS);
  const [isGmailLoading, setIsGmailLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const initSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        setUser(session.user);
      }
    };

    void initSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log(`[Auth] Event: ${event}`, session?.user?.email);
      setUser(session?.user ?? null);
      if (session) setIsOpen(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
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

  const loadGmailStatus = useCallback(async () => {
    setIsGmailLoading(true);

    try {
      const nextStatus = await fetchGmailStatus();
      setGmailStatus(nextStatus);
      return nextStatus;
    } catch (error) {
      console.error('Auth Gmail status refresh failed:', error);
      setGmailStatus((current) => {
        if (!current.configured) return current;
        return {
          ...current,
          error: 'Gmail 상태를 확인하지 못했습니다.',
        };
      });
      return null;
    } finally {
      setIsGmailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      void loadGmailStatus();
    }
  }, [isOpen, loadGmailStatus]);

  const handleAuth = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        alert('Verification email sent. Please check your inbox.');
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        alert(`Auth Error: ${error.message}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      setUser(null);
      setIsOpen(false);
      await supabase.auth.signOut();
      window.location.reload();
    } catch {
      console.error('Logout failed, forcing reload anyway.');
      window.location.reload();
    }
  };

  const resolveGmailAction = useCallback(
    async (forceRelink = false) => {
      const nextStatus = (await loadGmailStatus()) ?? gmailStatus;

      if (!nextStatus.configured) {
        alert(
          'Gmail 연동이 아직 설정되지 않았습니다.\n' +
            'GOOGLE_GMAIL_CLIENT_ID, GOOGLE_GMAIL_CLIENT_SECRET, GMAIL_COOKIE_SECRET 환경변수가 필요합니다.'
        );
        return;
      }

      setIsOpen(false);

      if (!forceRelink && nextStatus.linked && nextStatus.redirectUrl && !nextStatus.requiresRelink) {
        window.location.assign(nextStatus.redirectUrl);
        return;
      }

      window.location.assign('/api/gmail/connect');
    },
    [gmailStatus, loadGmailStatus]
  );

  const triggerLabel = user?.email ?? 'Pilot Access';

  return (
    <div className="relative font-sans" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className={`flex touch-manipulation select-none items-center gap-3 rounded-xl border px-3 py-1.5 shadow-sm transition-all ${
          user
            ? 'max-w-[260px] border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300'
            : 'border-zinc-200 bg-white/70 text-zinc-500 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950/70 dark:hover:text-white'
        }`}
      >
        <div className="relative flex-shrink-0">
          {user ? (
            <div className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.8)]" />
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          )}
          {gmailStatus.hasUnread && (
            <span className="absolute -right-1 -top-1 block h-2.5 w-2.5 rounded-full bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.9)]" />
          )}
        </div>

        {user && (
          <span className="truncate text-[10px] font-black uppercase tracking-tight">
            {triggerLabel}
          </span>
        )}

        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-16 z-50 w-[min(22rem,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] rounded-[32px] border-2 border-[var(--eva-purple)]/30 bg-[var(--bg-main)] p-5 shadow-2xl animate-in fade-in zoom-in-95 duration-200 backdrop-blur-2xl">
          {user ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-[var(--border-subtle)] bg-white/40 px-4 py-3 dark:bg-zinc-950/40">
                <div className="text-[9px] font-black uppercase tracking-[0.35em] text-[var(--eva-purple)]/60">
                  Current Pilot
                </div>
                <div className="mt-2 truncate text-sm font-black text-[var(--text-primary)]">
                  {user.email}
                </div>
              </div>

              <GmailActionRow
                gmailStatus={gmailStatus}
                isLoading={isGmailLoading}
                onPrimaryAction={() => void resolveGmailAction(false)}
                onRelinkAction={() => void resolveGmailAction(true)}
              />

              <button
                type="button"
                onClick={handleLogout}
                className="w-full touch-manipulation select-none rounded-2xl bg-rose-50 px-4 py-3 text-[10px] font-black uppercase tracking-[0.3em] text-rose-600 transition-all hover:bg-rose-100"
              >
                Logout
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="space-y-1">
                <h2 className="text-2xl font-black uppercase italic tracking-tighter text-[var(--text-primary)]">
                  {isLogin ? 'Pilot Access' : 'Register Unit'}
                </h2>
              </div>

              <form onSubmit={handleAuth} className="space-y-4">
                <input
                  type="email"
                  placeholder="E-Mail Address"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full rounded-2xl border-2 border-[var(--border-subtle)] bg-[var(--bg-input)] px-5 py-3.5 text-sm font-bold text-[var(--text-primary)] outline-none transition-all placeholder:text-[var(--text-primary)]/20 focus:border-[var(--eva-purple)]"
                  required
                />
                <input
                  type="password"
                  placeholder="Security Key"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-2xl border-2 border-[var(--border-subtle)] bg-[var(--bg-input)] px-5 py-3.5 text-sm font-bold text-[var(--text-primary)] outline-none transition-all placeholder:text-[var(--text-primary)]/20 focus:border-[var(--eva-purple)]"
                  required
                />
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full rounded-2xl bg-[var(--eva-purple)] py-4 text-[11px] font-black uppercase italic tracking-widest text-white shadow-xl shadow-[var(--eva-purple)]/20 transition-all hover:scale-[1.02] active:scale-95"
                >
                  {isLoading ? 'Accessing...' : isLogin ? 'Initialize Sync' : 'Execute Registry'}
                </button>
              </form>

              <button
                type="button"
                onClick={() => setIsLogin((current) => !current)}
                className="w-full text-center text-[10px] font-black uppercase tracking-widest text-[var(--eva-purple)]/60 transition-all hover:text-[var(--eva-purple)]"
              >
                {isLogin ? 'New Pilot? Create Account' : 'Existing Unit? Login'}
              </button>

              <GmailActionRow
                gmailStatus={gmailStatus}
                isLoading={isGmailLoading}
                onPrimaryAction={() => void resolveGmailAction(false)}
                onRelinkAction={() => void resolveGmailAction(true)}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
