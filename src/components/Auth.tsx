'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';
import {
  fetchGmailStatus,
  GMAIL_STATUS_UPDATED_EVENT,
  notifyGmailStatusUpdated,
  setActiveGmailAccount,
} from '@/lib/gmail/client';
import { EMPTY_GMAIL_STATUS, type GmailStatus } from '@/lib/gmail/shared';

const GMAIL_POPUP_NAME = 'planner-gmail-auth';
const GMAIL_POPUP_WIDTH = 520;
const GMAIL_POPUP_HEIGHT = 720;

type GmailPopupStatus = 'linked' | 'denied' | 'invalid' | 'error';

function GmailControlPanel({
  gmailStatus,
  isLoading,
  onLinkAction,
  onRelinkAction,
  onSwitchAccount,
}: {
  gmailStatus: GmailStatus;
  isLoading: boolean;
  onLinkAction: () => void;
  onRelinkAction: () => void;
  onSwitchAccount: (emailAddress: string) => void;
}) {
  const activeAccount =
    gmailStatus.accounts.find((account) => account.isActive) ?? gmailStatus.accounts[0] ?? null;
  const summaryText = !gmailStatus.configured
    ? 'Server-side Gmail config is required.'
    : activeAccount
      ? activeAccount.requiresRelink
        ? 'Active Gmail needs relinking before unread sync resumes.'
        : `${gmailStatus.accounts.length} linked inbox${gmailStatus.accounts.length > 1 ? 'es' : ''}`
      : 'Link a Gmail account to control the floating bubble inbox shortcut.';

  return (
    <div className="space-y-3 rounded-2xl border border-[var(--eva-purple)]/15 bg-[var(--eva-purple)]/5 p-3">
      <div className="rounded-2xl border border-white/50 bg-white/60 px-3 py-3 dark:border-zinc-800/80 dark:bg-zinc-950/60">
        <div className="text-[9px] font-black uppercase tracking-[0.3em] text-[var(--eva-purple)]/70">
          Gmail Relay
        </div>
        <div className="mt-2 truncate text-sm font-black text-[var(--text-primary)]">
          {activeAccount?.emailAddress ?? 'No linked Gmail account'}
        </div>
        <div className="mt-1 text-[10px] font-semibold text-zinc-500 dark:text-zinc-400">
          {summaryText}
        </div>
      </div>

      <div className={`grid gap-2 ${activeAccount ? 'sm:grid-cols-2' : ''}`}>
        <button
          type="button"
          onClick={onLinkAction}
          disabled={isLoading}
          className="rounded-2xl border border-[var(--eva-purple)]/25 bg-white/70 px-3 py-3 text-[10px] font-black uppercase tracking-[0.25em] text-[var(--eva-purple)] transition-all hover:bg-white disabled:opacity-60 dark:bg-zinc-950/70"
        >
          {gmailStatus.accounts.length > 0 ? 'Link Another Gmail' : 'Link Gmail'}
        </button>

        {activeAccount && (
          <button
            type="button"
            onClick={onRelinkAction}
            disabled={isLoading}
            className="rounded-2xl border border-[var(--eva-purple)]/15 bg-[var(--eva-purple)] px-3 py-3 text-[10px] font-black uppercase tracking-[0.25em] text-white transition-all hover:brightness-110 disabled:opacity-60"
          >
            {activeAccount.requiresRelink ? 'Relink Active Gmail' : 'Reauth Active Gmail'}
          </button>
        )}
      </div>

      {gmailStatus.accounts.length > 0 && (
        <div className="space-y-2">
          {gmailStatus.accounts.map((account) => (
            <button
              key={account.emailAddress}
              type="button"
              onClick={() => onSwitchAccount(account.emailAddress)}
              disabled={isLoading || account.isActive}
              className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition-all disabled:cursor-default disabled:opacity-70 ${
                account.isActive
                  ? 'border-[var(--eva-purple)]/30 bg-[var(--eva-purple)]/10'
                  : 'border-zinc-200/70 bg-white/70 hover:border-[var(--eva-purple)]/30 hover:bg-white dark:border-zinc-800 dark:bg-zinc-950/60'
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="truncate text-[11px] font-black uppercase tracking-tight text-[var(--text-primary)]">
                  {account.emailAddress}
                </div>
                <div className="mt-1 text-[10px] font-semibold text-zinc-500 dark:text-zinc-400">
                  {account.requiresRelink
                    ? 'Needs relink'
                    : account.isActive
                      ? 'Active inbox'
                      : 'Switch to this inbox'}
                  {account.unreadCount > 0 ? ` - ${account.unreadCount} unread` : ''}
                </div>
              </div>

              <div
                className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.22em] ${
                  account.isActive
                    ? 'bg-[var(--eva-purple)] text-white'
                    : 'bg-zinc-200/80 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'
                }`}
              >
                {account.isActive ? 'Active' : 'Use'}
              </div>
            </button>
          ))}
        </div>
      )}

      {gmailStatus.error && activeAccount?.requiresRelink && (
        <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
          {gmailStatus.error}
        </div>
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

  const loadGmailStatus = useCallback(async (shouldNotify = false) => {
    setIsGmailLoading(true);

    try {
      const nextStatus = await fetchGmailStatus();
      setGmailStatus(nextStatus);
      if (shouldNotify) {
        notifyGmailStatusUpdated();
      }
      return nextStatus;
    } catch (error) {
      console.error('Auth Gmail status refresh failed:', error);
      setGmailStatus((current) => {
        if (!current.configured) return current;
        return {
          ...current,
          error: 'Unable to refresh Gmail status.',
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

  useEffect(() => {
    const handleGmailStatusUpdated = () => {
      void loadGmailStatus();
    };

    window.addEventListener(GMAIL_STATUS_UPDATED_EVENT, handleGmailStatusUpdated);
    return () => window.removeEventListener(GMAIL_STATUS_UPDATED_EVENT, handleGmailStatusUpdated);
  }, [loadGmailStatus]);

  useEffect(() => {
    const handleGmailOAuthMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (typeof event.data !== 'object' || event.data === null) return;
      if (!('type' in event.data) || event.data.type !== 'planner-gmail-oauth-result') return;

      const status = event.data.status as GmailPopupStatus | undefined;
      if (!status) return;

      if (status === 'linked') {
        void loadGmailStatus(true);
        return;
      }

      if (status === 'denied') {
        alert('Gmail linking was canceled.');
        return;
      }

      alert('A Gmail linking error occurred. Please try again.');
    };

    window.addEventListener('message', handleGmailOAuthMessage);
    return () => window.removeEventListener('message', handleGmailOAuthMessage);
  }, [loadGmailStatus]);

  const openGmailPopup = useCallback(() => {
    const left = window.screenX + Math.max(0, (window.outerWidth - GMAIL_POPUP_WIDTH) / 2);
    const top = window.screenY + Math.max(0, (window.outerHeight - GMAIL_POPUP_HEIGHT) / 2);
    const features = [
      'popup=yes',
      `width=${GMAIL_POPUP_WIDTH}`,
      `height=${GMAIL_POPUP_HEIGHT}`,
      `left=${Math.round(left)}`,
      `top=${Math.round(top)}`,
      'resizable=yes',
      'scrollbars=yes',
    ].join(',');
    const popup = window.open('/api/gmail/connect?popup=1', GMAIL_POPUP_NAME, features);

    if (!popup) {
      window.location.assign('/api/gmail/connect');
      return;
    }

    popup.focus();
  }, []);

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

  const handleLinkGmail = useCallback(() => {
    if (!gmailStatus.configured) {
      alert(
        'Gmail linking is not configured yet.\n' +
          'GOOGLE_GMAIL_CLIENT_ID, GOOGLE_GMAIL_CLIENT_SECRET, and GMAIL_COOKIE_SECRET are required.'
      );
      return;
    }

    setIsOpen(false);
    openGmailPopup();
  }, [gmailStatus.configured, openGmailPopup]);

  const handleSwitchGmailAccount = useCallback(async (emailAddress: string) => {
    setIsGmailLoading(true);

    try {
      const nextStatus = await setActiveGmailAccount(emailAddress);
      setGmailStatus(nextStatus);
      notifyGmailStatusUpdated();
    } catch (error) {
      console.error('Gmail account switch failed:', error);
      alert('Unable to switch the active Gmail account right now.');
    } finally {
      setIsGmailLoading(false);
    }
  }, []);

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

              <GmailControlPanel
                gmailStatus={gmailStatus}
                isLoading={isGmailLoading}
                onLinkAction={handleLinkGmail}
                onRelinkAction={handleLinkGmail}
                onSwitchAccount={(emailAddress) => void handleSwitchGmailAccount(emailAddress)}
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

              <GmailControlPanel
                gmailStatus={gmailStatus}
                isLoading={isGmailLoading}
                onLinkAction={handleLinkGmail}
                onRelinkAction={handleLinkGmail}
                onSwitchAccount={(emailAddress) => void handleSwitchGmailAccount(emailAddress)}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
