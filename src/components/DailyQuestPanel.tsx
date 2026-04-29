'use client';

import React, { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  addDailyQuest,
  deleteDailyQuest,
  getDailyQuests,
  isDailyQuestCompleted,
  toggleDailyQuest,
  type DailyQuest,
} from '@/lib/dailyQuests';
import { getLocalDateString } from '@/lib/dateUtils';

export default function DailyQuestPanel() {
  const [quests, setQuests] = useState<DailyQuest[]>([]);
  const [draftTitle, setDraftTitle] = useState('');
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const today = getLocalDateString();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQuests(getDailyQuests());
  }, []);

  useEffect(() => {
    if (isComposerOpen) {
      inputRef.current?.focus();
    }
  }, [isComposerOpen]);

  const completedCount = useMemo(
    () => quests.filter((quest) => isDailyQuestCompleted(quest, today)).length,
    [quests, today]
  );
  const incompleteCount = quests.length - completedCount;
  const progress = quests.length > 0 ? Math.round((completedCount / quests.length) * 100) : 0;

  const handleAdd = useCallback((event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanTitle = draftTitle.trim();
    const nextQuests = addDailyQuest(draftTitle);
    setQuests(nextQuests);
    if (cleanTitle) {
      setDraftTitle('');
      setIsComposerOpen(false);
    }
  }, [draftTitle]);

  const handleToggle = useCallback((id: string) => {
    setQuests(toggleDailyQuest(id, today));
  }, [today]);

  const handleDelete = useCallback((id: string) => {
    setQuests(deleteDailyQuest(id));
  }, []);

  return (
    <section className="mb-[clamp(1.5rem,4vh,2.5rem)] border-y border-[var(--eva-purple)]/15 bg-[var(--eva-purple)]/[0.03] px-[clamp(0.75rem,2vw,1.25rem)] py-[clamp(1rem,2.5vw,1.5rem)]">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-md bg-[var(--eva-green)] px-2.5 py-1 text-[8px] font-black uppercase italic tracking-[0.28em] text-black shadow-[0_0_12px_rgba(74,222,128,0.25)]">
              Daily Quest
            </span>
            <h3 className="text-[clamp(1rem,1.5vw,1.25rem)] font-black uppercase italic tracking-tighter text-[var(--text-primary)]">
              Routine Objectives
            </h3>
            <span className="text-[9px] font-black uppercase tracking-[0.24em] text-[var(--text-primary)]/35">
              {completedCount}/{quests.length} Clear
            </span>
          </div>
          <div className="h-2 max-w-xl overflow-hidden rounded-full border border-[var(--border-subtle)] bg-black/10 dark:bg-white/5">
            <div
              className={`h-full transition-all duration-700 ${progress === 100 && quests.length > 0 ? 'bg-[var(--eva-green)]' : 'bg-[var(--eva-purple)]'}`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="relative flex shrink-0 items-end gap-3">
          <button
            type="button"
            aria-label={isComposerOpen ? 'Close daily quest add form' : 'Open daily quest add form'}
            aria-expanded={isComposerOpen}
            title="Add daily quest"
            onClick={() => setIsComposerOpen((open) => !open)}
            className={`mb-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border text-sm transition-all ${
              isComposerOpen
                ? 'border-[var(--eva-green)] bg-[var(--eva-green)] text-black shadow-[0_0_18px_rgba(74,222,128,0.25)]'
                : 'border-[var(--eva-green)]/30 bg-[var(--eva-green)]/15 text-[var(--eva-green)] hover:bg-[var(--eva-green)] hover:text-black'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14" />
              <path d="M5 12h14" />
            </svg>
          </button>

          {isComposerOpen && (
            <form
              onSubmit={handleAdd}
              className="absolute right-0 top-[calc(100%+0.75rem)] z-30 flex w-[min(18rem,calc(100vw-2rem))] gap-2 rounded-2xl border border-[var(--eva-purple)]/25 bg-[var(--bg-primary)]/95 p-2 shadow-[0_18px_45px_rgba(0,0,0,0.28)] backdrop-blur-xl"
            >
              <input
                ref={inputRef}
                aria-label="New daily quest"
                value={draftTitle}
                onChange={(event) => setDraftTitle(event.target.value)}
                className="min-w-0 flex-1 rounded-xl border border-[var(--eva-purple)]/20 bg-black/[0.03] px-3 py-2 text-sm font-bold text-[var(--text-primary)] outline-none transition-all placeholder:text-[var(--text-primary)]/25 focus:border-[var(--eva-purple)]/60 dark:bg-white/[0.04]"
                placeholder="New daily quest"
              />
              <button
                type="submit"
                aria-label="Add daily quest"
                title="Confirm"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--eva-green)]/30 bg-[var(--eva-green)]/15 text-[var(--eva-green)] transition-all hover:bg-[var(--eva-green)] hover:text-black"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </button>
            </form>
          )}

          <div className="text-right">
            <div className="text-[clamp(1.75rem,3vw,2.5rem)] font-black italic leading-none text-[var(--eva-purple)]">
              {progress}%
            </div>
            <div className="text-[8px] font-black uppercase tracking-[0.28em] text-[var(--text-primary)]/35">
              Clear Rate
            </div>
          </div>
          {incompleteCount > 0 && (
            <div className="mb-1 h-2.5 w-2.5 rounded-full bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.8)]" />
          )}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-2 md:grid-cols-2">
        {quests.length === 0 ? (
          <div className="col-span-full py-4 text-center text-[9px] font-black uppercase italic tracking-[0.3em] text-[var(--text-primary)]/25">
            No daily quests assigned
          </div>
        ) : quests.map((quest) => {
          const completed = isDailyQuestCompleted(quest, today);

          return (
            <div
              key={quest.id}
              className={`group flex min-h-12 items-center gap-2 rounded-xl border px-3 py-2 transition-all ${
                completed
                  ? 'border-[var(--border-subtle)] bg-black/[0.02] text-[var(--text-primary)]/35'
                  : 'border-[var(--eva-purple)]/20 bg-[var(--eva-purple)]/[0.04] text-[var(--text-primary)] hover:border-[var(--eva-purple)]/45'
              }`}
            >
              <button
                type="button"
                aria-label={`Toggle ${quest.title}`}
                aria-pressed={completed}
                onClick={() => handleToggle(quest.id)}
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
              >
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border text-[10px] font-black ${
                  completed
                    ? 'border-[var(--eva-green)] bg-[var(--eva-green)] text-black'
                    : 'border-current text-current'
                }`}>
                  {completed && (
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  )}
                </span>
                <span className={`min-w-0 flex-1 truncate text-sm font-bold ${completed ? 'line-through' : ''}`}>
                  {quest.title}
                </span>
                <span className="text-[8px] font-black uppercase tracking-widest text-[var(--text-primary)]/30">
                  {completed ? 'Clear' : 'Open'}
                </span>
              </button>
              <button
                type="button"
                aria-label={`Delete ${quest.title}`}
                onClick={() => handleDelete(quest.id)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--text-primary)]/25 transition-all hover:bg-rose-500/10 hover:text-rose-500"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18" />
                  <path d="M8 6V4h8v2" />
                  <path d="M19 6l-1 14H6L5 6" />
                </svg>
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
