'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import MemoInput from "@/components/MemoInput";
import Dashboard from "@/components/Dashboard";
import MemoList from "@/components/MemoList";
import DataSync from "@/components/DataSync";
import Auth from "@/components/Auth";
import ConfirmModal from "@/components/ConfirmModal";
import { fetchMemos, deleteMemo, updateMemo, syncToCloud, Memo } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [memos, setMemos] = useState<Memo[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showSyncing, setShowSyncing] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isSyncEnabled, setIsSyncEnabled] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  
  // Use a ref to track the last sync start time
  const syncStartTimeRef = useRef<number>(0);

  const loadData = useCallback(async (userId?: string) => {
    setIsSyncing(true);
    setShowSyncing(true);
    syncStartTimeRef.current = Date.now();

    try {
      const data = await fetchMemos(userId);
      setMemos(data);
    } catch (e: unknown) {
      if (e instanceof Error) {
        console.error("[Data] Fetch failed:", e.message);
      }
    } finally {
      setIsSyncing(false);
      // Ensure the indicator stays visible for at least 2 seconds for animation
      const elapsed = Date.now() - syncStartTimeRef.current;
      const remaining = Math.max(0, 2000 - elapsed);
      
      setTimeout(() => {
        setShowSyncing(false);
      }, remaining);
    }
  }, []);

  // Listen for auth changes from Supabase (standard behavior)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      setIsAuthReady(true);
      if (event === 'SIGNED_OUT') {
        setIsSyncEnabled(false);
        loadData();
      }
    });
    return () => subscription.unsubscribe();
  }, [loadData]);

  const handleAuthChange = useCallback((isValid: boolean, userId: string | null) => {
    setIsSyncEnabled(isValid);
    if (isValid && userId) {
      loadData(userId);
    }
  }, [loadData]);

  const handleSyncComplete = useCallback(() => {
    loadData(user?.id);
  }, [loadData, user?.id]);

  const handleDelete = useCallback(async (id: string) => {
    await deleteMemo(id, user?.id);
    await loadData(user?.id);
  }, [user?.id, loadData]);

  const handleToggle = useCallback(async (id: string) => {
    const memo = memos.find(m => m.id === id);
    if (!memo) return;
    await updateMemo(id, { completed: !memo.completed }, user?.id);
    await loadData(user?.id);
  }, [memos, user?.id, loadData]);

  const todoMemos = useMemo(() => memos.filter(m => m.category === 'TODO'), [memos]);
  const archiveMemos = useMemo(() => memos.filter(m => m.category !== 'TODO'), [memos]);

  if (!isAuthReady) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="flex flex-col items-center gap-6">
          <div className="w-12 h-12 border-4 border-[var(--eva-purple)] border-t-[var(--eva-green)] rounded-full animate-spin shadow-[0_0_15px_var(--eva-purple)]" />
          <p className="text-[10px] font-black text-[var(--eva-purple)] uppercase tracking-[0.5em] animate-pulse italic">Neural Link established...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center w-full">
      {/* Navigation: Responsive height and padding */}
      <nav className="w-full border-b border-[var(--border-subtle)] py-[clamp(1rem,3vh,1.5rem)] px-[clamp(1rem,5vw,6rem)] flex items-center justify-between sticky top-0 bg-[var(--bg-main)]/80 backdrop-blur-2xl z-40 force-layer">
        <div className="flex items-center gap-4 md:gap-8">
          <div className="flex flex-col items-start leading-none group cursor-default">
            <span className="eva-title-main text-[clamp(6px,0.6vw,9px)] text-[var(--eva-purple)] opacity-60 tracking-[0.5em] mb-0.5 italic">
              NEON GENESIS
            </span>
            <div className="flex items-end gap-1.5 md:gap-2">
              <h1 className="eva-title-hero text-[clamp(1.5rem,3vw,2.5rem)] text-[var(--text-primary)] tracking-tighter leading-none drop-shadow-[0_0_15px_rgba(167,139,250,0.2)]">
                ARCHIVE
              </h1>
              <span className="bg-[var(--eva-green)] text-black text-[clamp(6px,0.5vw,8px)] font-black px-1.5 py-0.5 rounded-sm italic mb-0.5 shadow-md shadow-[var(--eva-green)]/20">
                EVA-01
              </span>
            </div>
          </div>
            <div 
              className={`flex items-center gap-2 px-3 py-1 bg-[var(--eva-purple)]/10 rounded-full border border-[var(--eva-purple)]/20 transition-all duration-1000 ease-in-out ${
                showSyncing ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1 pointer-events-none'
              }`}
            >
              <div className="w-1.5 h-1.5 bg-[var(--eva-green)] rounded-full shadow-[0_0_8px_var(--eva-green)] animate-pulse" />
              <span className="text-[8px] font-black text-[var(--eva-purple)] uppercase tracking-[0.3em]">Syncing</span>
            </div>
        </div>
        <div className="flex items-center gap-3 scale-[clamp(0.8,1vw,1)]">
          <Auth />
        </div>
      </nav>

      {/* Main Content: Adaptive max-width and internal padding */}
      <main className="w-full max-w-[min(1600px,95vw)] flex flex-col gap-[clamp(2rem,5vh,4rem)] p-[clamp(1rem,4vw,4rem)] animate-in fade-in duration-1000 relative z-10">
        <section className="eva-glass p-[clamp(1.5rem,5vw,4rem)] rounded-[clamp(2rem,5vw,4rem)] shadow-2xl border-2">
          <div className="max-w-[1000px] mx-auto">
            <MemoInput onSave={() => loadData(user?.id)} user={user} />
          </div>
        </section>

        <section className="bg-[var(--eva-purple)]/[0.02] dark:bg-[var(--eva-purple)]/[0.06] p-[clamp(1.5rem,5vw,4rem)] rounded-[clamp(2rem,5vw,3.5rem)] border border-[var(--border-subtle)] shadow-sm transition-all group relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-[var(--eva-purple)] opacity-30 shadow-[0_0_20px_var(--eva-purple)]" />
          <h2 className="text-[clamp(1rem,1.5vw,1.25rem)] font-black text-[var(--text-primary)] uppercase italic tracking-tighter mb-[clamp(1.5rem,4vh,2.5rem)] flex items-center gap-4 font-sans">
            <span className="p-[clamp(0.5rem,1vw,0.75rem)] bg-purple-700 rounded-2xl text-white shadow-2xl shadow-purple-500/40 group-hover:scale-110 transition-transform duration-500">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-[clamp(14px,1.2vw,18px)] h-[clamp(14px,1.2vw,18px)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
            </span>
            Quest Log
            <span className="text-[clamp(8px,0.7vw,10px)] text-[var(--eva-green)] font-black ml-2 animate-pulse tracking-[0.3em] bg-[var(--eva-green)]/10 px-2.5 py-1 rounded-lg border border-[var(--eva-green)]/20 shadow-[0_0_10px_rgba(74,222,128,0.1)] uppercase italic">Established</span>
          </h2>
          <Dashboard 
            memos={todoMemos} 
            onToggle={handleToggle} 
            onDelete={setDeleteTargetId} 
            onRefresh={() => loadData(user?.id)} 
            userId={user?.id} 
            onAuthChange={handleAuthChange}
          />
        </section>

        <section className="bg-[var(--eva-green)]/[0.01] dark:bg-[var(--eva-green)]/[0.03] p-[clamp(1.5rem,5vw,4rem)] rounded-[clamp(2rem,5vw,3.5rem)] border border-[var(--border-subtle)] transition-all relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-[var(--eva-green)] opacity-20 shadow-[0_0_20px_var(--eva-green)]" />
          <h2 className="text-[clamp(1rem,1.5vw,1.25rem)] font-black text-[var(--text-primary)] uppercase italic tracking-tighter mb-[clamp(1.5rem,4vh,2.5rem)] flex items-center gap-4 font-sans">
            <span className="p-[clamp(0.5rem,1vw,0.75rem)] bg-green-600 rounded-2xl text-white shadow-2xl shadow-green-500/40 font-sans">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-[clamp(14px,1.2vw,18px)] h-[clamp(14px,1.2vw,18px)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
            </span>
            Archive Base
          </h2>
          <MemoList memos={archiveMemos} onDelete={setDeleteTargetId} onRefresh={() => loadData(user?.id)} userId={user?.id} />
        </section>
      </main>

      <footer className="mt-auto py-[clamp(2rem,8vh,5rem)] border-t border-[var(--border-subtle)] w-full text-center text-[var(--eva-purple)]/30 dark:text-zinc-800 font-black uppercase tracking-[0.5em] text-[clamp(8px,0.7vw,10px)] italic">
        MAGI SYSTEM STATUS: OPTIMAL • SECURITY LEVEL: AA
      </footer>

      <ConfirmModal 
        isOpen={!!deleteTargetId}
        title="Purge Fragment"
        message="Permanently erase this data from MAGI memory core?"
        onConfirm={() => {
          if (deleteTargetId) handleDelete(deleteTargetId);
          setDeleteTargetId(null);
        }}
        onCancel={() => setDeleteTargetId(null)}
      />
      <DataSync onSyncComplete={handleSyncComplete} userId={user?.id} isEnabled={isSyncEnabled} />
    </div>
  );
}
