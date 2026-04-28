'use client';

import React, { useMemo } from 'react';
import { getLocalDateString } from '@/lib/dateUtils';
import type { Memo } from '@/lib/storage';

interface DailyQuestPanelProps {
  memos: Memo[];
  onToggle: (id: string) => void;
}

function getDailyQuests(memos: Memo[]): Memo[] {
  const today = getLocalDateString();

  return memos
    .filter((memo) => memo.category === 'TODO' && memo.targetDate === today)
    .sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      if (a.priority !== b.priority) return a.priority === 'High' ? -1 : b.priority === 'High' ? 1 : 0;
      return (a.order ?? 0) - (b.order ?? 0) || a.createdAt - b.createdAt;
    });
}

export default function DailyQuestPanel({ memos, onToggle }: DailyQuestPanelProps) {
  const dailyQuests = useMemo(() => getDailyQuests(memos), [memos]);
  const completedCount = dailyQuests.filter((quest) => quest.completed).length;
  const incompleteCount = dailyQuests.length - completedCount;
  const progress = dailyQuests.length > 0 ? Math.round((completedCount / dailyQuests.length) * 100) : 0;
  const visibleQuests = dailyQuests.slice(0, 4);

  return (
    <section className="mb-[clamp(1.5rem,4vh,2.5rem)] border-y border-[var(--eva-purple)]/15 bg-[var(--eva-purple)]/[0.03] px-[clamp(0.75rem,2vw,1.25rem)] py-[clamp(1rem,2.5vw,1.5rem)]">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-md bg-[var(--eva-green)] px-2.5 py-1 text-[8px] font-black uppercase italic tracking-[0.28em] text-black shadow-[0_0_12px_rgba(74,222,128,0.25)]">
              Daily Quest
            </span>
            <h3 className="text-[clamp(1rem,1.5vw,1.25rem)] font-black uppercase italic tracking-tighter text-[var(--text-primary)]">
              Today&apos;s Objectives
            </h3>
            <span className="text-[9px] font-black uppercase tracking-[0.24em] text-[var(--text-primary)]/35">
              {completedCount}/{dailyQuests.length} Clear
            </span>
          </div>
          <div className="h-2 max-w-xl overflow-hidden rounded-full border border-[var(--border-subtle)] bg-black/10 dark:bg-white/5">
            <div
              className={`h-full transition-all duration-700 ${progress === 100 && dailyQuests.length > 0 ? 'bg-[var(--eva-green)]' : 'bg-[var(--eva-purple)]'}`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="flex shrink-0 items-end gap-4">
          <div className="text-right">
            <div className="text-[clamp(1.75rem,3vw,2.5rem)] font-black italic leading-none text-[var(--eva-purple)]">
              {progress}%
            </div>
            <div className="text-[8px] font-black uppercase tracking-[0.28em] text-[var(--text-primary)]/35">
              Sync Ratio
            </div>
          </div>
          {incompleteCount > 0 && (
            <div className="mb-1 h-2.5 w-2.5 rounded-full bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.8)]" />
          )}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-2 md:grid-cols-2">
        {visibleQuests.length === 0 ? (
          <div className="col-span-full py-4 text-center text-[9px] font-black uppercase italic tracking-[0.3em] text-[var(--text-primary)]/25">
            No daily quests assigned
          </div>
        ) : visibleQuests.map((quest) => (
          <button
            key={quest.id}
            type="button"
            onClick={() => onToggle(quest.id)}
            className={`group flex min-h-12 items-center gap-3 rounded-xl border px-3 py-2 text-left transition-all ${
              quest.completed
                ? 'border-[var(--border-subtle)] bg-black/[0.02] text-[var(--text-primary)]/35'
                : quest.priority === 'High'
                  ? 'border-rose-500/25 bg-rose-500/[0.04] text-[var(--text-primary)] hover:border-rose-500/50'
                  : 'border-[var(--eva-purple)]/20 bg-[var(--eva-purple)]/[0.04] text-[var(--text-primary)] hover:border-[var(--eva-purple)]/45'
            }`}
          >
            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border text-[10px] font-black ${
              quest.completed
                ? 'border-[var(--eva-green)] bg-[var(--eva-green)] text-black'
                : 'border-current text-current'
            }`}>
              {quest.completed ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              ) : quest.priority === 'High' ? '!' : ''}
            </span>
            <span className={`min-w-0 flex-1 truncate text-sm font-bold ${quest.completed ? 'line-through' : ''}`}>
              {quest.content}
            </span>
            <span className="text-[8px] font-black uppercase tracking-widest text-[var(--text-primary)]/30">
              {quest.completed ? 'Clear' : quest.priority}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
