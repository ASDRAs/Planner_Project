'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';

export default function Auth() {
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [showForm, setShowAuthForm] = useState(false);

  useEffect(() => {
    // 1. 초기 세션 즉시 확인
    const initSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setUser(session.user);
      }
    };
    initSession();

    // 2. 인증 상태 실시간 감지
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log(`[Auth] Event: ${event}`, session?.user?.email);
      setUser(session?.user ?? null);
      if (session) setShowAuthForm(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        alert('Verification email sent! Please check your inbox.');
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
      // 로그아웃은 즉시 로컬 상태부터 날리고 서버에 통보
      setUser(null);
      await supabase.auth.signOut();
      window.location.reload(); // 세션 완전 초기화를 위해 강제 새로고침
    } catch {
      console.error("Logout failed, forcing reload anyway.");
      window.location.reload();
    }
  };

  if (user) {
    return (
      <div className="flex items-center gap-3 bg-zinc-50 dark:bg-zinc-900 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm max-w-[240px] animate-in fade-in duration-300 font-sans">
        <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0 animate-pulse" />
        <span className="text-[10px] font-black text-zinc-700 dark:text-zinc-300 uppercase tracking-tight truncate">
          {user.email}
        </span>
        <button
          onClick={handleLogout}
          className="flex-shrink-0 px-2.5 py-1 text-[9px] font-black text-rose-600 bg-rose-50 rounded-lg hover:bg-rose-100 hover:scale-105 active:scale-95 transition-all uppercase"
        >
          Logout
        </button>
      </div>
    );
  }

  return (
    <div className="relative font-sans">
      <button 
        onClick={() => setShowAuthForm(!showForm)}
        className="p-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-all hover:scale-110 active:scale-90"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
      </button>

      {showForm && (
        <div className="flex flex-col gap-6 p-8 bg-[var(--bg-main)] border-2 border-[var(--eva-purple)]/30 rounded-[40px] shadow-2xl w-[320px] absolute top-16 right-0 z-50 animate-in fade-in zoom-in-95 duration-200 backdrop-blur-2xl">
          <div className="space-y-1">
            <h2 className="text-2xl font-black text-[var(--text-primary)] uppercase italic tracking-tighter">
              {isLogin ? 'Pilot Access' : 'Register Unit'}
            </h2>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            <input
              type="email"
              placeholder="E-Mail Address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-5 py-3.5 bg-[var(--bg-input)] border-2 border-[var(--border-subtle)] rounded-2xl text-sm font-bold outline-none focus:border-[var(--eva-purple)] transition-all text-[var(--text-primary)] placeholder:text-[var(--text-primary)]/20"
              required
            />
            <input
              type="password"
              placeholder="Security Key"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-5 py-3.5 bg-[var(--bg-input)] border-2 border-[var(--border-subtle)] rounded-2xl text-sm font-bold outline-none focus:border-[var(--eva-purple)] transition-all text-[var(--text-primary)] placeholder:text-[var(--text-primary)]/20"
              required
            />
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 bg-[var(--eva-purple)] text-white text-[11px] font-black uppercase rounded-2xl hover:scale-[1.02] active:scale-95 shadow-xl shadow-[var(--eva-purple)]/20 transition-all italic tracking-widest"
            >
              {isLoading ? 'Accessing...' : (isLogin ? 'Initialize Sync' : 'Execute Registry')}
            </button>
          </form>

          <button onClick={() => setIsLogin(!isLogin)} className="text-[10px] font-black text-[var(--eva-purple)]/60 uppercase tracking-widest text-center hover:text-[var(--eva-purple)] transition-all">
            {isLogin ? 'New Pilot? Create Account' : 'Existing Unit? Login'}
          </button>
        </div>
      )}
    </div>
  );
}
