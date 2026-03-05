'use client';

import React from 'react';
import { Memo } from '@/lib/storage';

interface TodayTodoProps {
  memos: Memo[];
  onToggle: (id: string) => void;
}

export default function TodayTodo({ memos, onToggle }: TodayTodoProps) {
  const today = new Date().setHours(0, 0, 0, 0);
  
  const todayTodos = memos.filter(m => {
    const memoDate = new Date(m.createdAt).setHours(0, 0, 0, 0);
    return m.category === 'TODO' && memoDate === today;
  });

  if (todayTodos.length === 0) return null;

  const mainQuests = todayTodos.filter(m => m.priority === 'High');
  const sideQuests = todayTodos.filter(m => m.priority !== 'High');
  
  const incompleteCount = todayTodos.filter(m => !m.completed).length;
  const completedCount = todayTodos.filter(m => m.completed).length;
  const progress = Math.round((completedCount / todayTodos.length) * 100);
  const hasIncomplete = incompleteCount > 0;

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 mb-12 animate-in fade-in slide-in-from-top-4 duration-700">
      {/* Quest Header */}
      <div className="flex items-end justify-between px-2">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="relative">
              <span className="text-[10px] font-black bg-zinc-900 text-white px-2 py-0.5 rounded tracking-tighter uppercase">Daily Mission</span>
              {hasIncomplete && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-zinc-50 animate-bounce" />
              )}
            </div>
            <h2 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tighter uppercase italic flex items-center gap-2">
              Today&apos;s Objectives
              {hasIncomplete && (
                <span className="inline-block w-2 h-2 bg-rose-500 rounded-full shadow-[0_0_8px_rgba(244,63,94,0.8)]" />
              )}
            </h2>
          </div>
          <p className="text-sm text-zinc-500 font-medium italic">
            {hasIncomplete 
              ? `잔여 목표가 ${incompleteCount}개 남았습니다.` 
              : "오늘의 모든 목표를 완수했습니다! 100% Clear!"}
          </p>
        </div>
        <div className="text-right">
          <div className={`text-3xl font-black italic leading-none transition-colors duration-500 ${progress === 100 ? 'text-green-500' : 'text-blue-600'}`}>
            {progress}%
          </div>
          <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Progress</div>
        </div>
      </div>

      {/* Progress Bar (Goal Style) */}
      <div className="relative w-full h-3 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden border border-white/10">
        <div 
          className={`absolute inset-y-0 left-0 transition-all duration-1000 ease-out shadow-sm ${
            progress === 100 ? 'bg-green-500' : 'bg-blue-600'
          }`}
          style={{ width: `${progress}%` }}
        >
          {progress > 0 && progress < 100 && (
            <div className="absolute inset-0 bg-white/20 animate-[shimmer_2s_infinite]" />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8">
        {/* Main Quests Section */}
        {mainQuests.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-xs font-black text-rose-500 uppercase tracking-[0.2em] flex items-center gap-2 px-2">
              Critical Objectives
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {mainQuests.map((quest) => (
                <QuestItem key={quest.id} quest={quest} onToggle={onToggle} isMain />
              ))}
            </div>
          </div>
        )}

        {/* Side Quests Section */}
        {sideQuests.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-xs font-black text-zinc-400 uppercase tracking-[0.2em] px-2">
              Standard Objectives
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {sideQuests.map((quest) => (
                <QuestItem key={quest.id} quest={quest} onToggle={onToggle} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function QuestItem({ quest, onToggle, isMain = false }: { quest: Memo, onToggle: (id: string) => void, isMain?: boolean }) {
  return (
    <div 
      onClick={() => onToggle(quest.id)}
      className={`relative group cursor-pointer overflow-hidden rounded-2xl border transition-all duration-300 ${
        quest.completed 
          ? 'bg-zinc-50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 opacity-60' 
          : isMain 
            ? 'bg-white dark:bg-zinc-900 border-rose-200 dark:border-rose-900/50 shadow-md hover:shadow-rose-100 dark:hover:shadow-rose-900/20 hover:-translate-y-1'
            : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 shadow-sm hover:border-blue-300 dark:hover:border-blue-900 hover:-translate-y-1'
      }`}
    >
      <div className="p-4 flex items-center gap-4">
        {/* Check Icon with Red Dot for incomplete */}
        <div className="relative">
          <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center border-2 transition-all duration-500 ${
            quest.completed 
              ? 'bg-zinc-900 border-zinc-900 text-white' 
              : isMain 
                ? 'bg-rose-50 border-rose-100 text-rose-500 group-hover:scale-110' 
                : 'bg-blue-50 border-blue-100 text-blue-500 group-hover:scale-110'
          }`}>
            {quest.completed ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
            ) : (
              isMain 
                ? <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                : <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/></svg>
            )}
          </div>
          {!quest.completed && (
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-rose-500 rounded-full border-2 border-white shadow-sm" />
          )}
        </div>

        {/* Quest Info */}
        <div className="flex-grow min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className={`text-[9px] font-black uppercase tracking-widest ${quest.completed ? 'text-zinc-400' : isMain ? 'text-rose-500' : 'text-blue-500'}`}>
              {quest.completed ? 'Complete' : isMain ? 'High Priority' : 'Objective'}
            </span>
          </div>
          <h4 className={`text-sm font-bold truncate transition-all ${
            quest.completed ? 'text-zinc-400 line-through' : 'text-zinc-800 dark:text-zinc-100'
          }`}>
            {quest.content}
          </h4>
        </div>

        {/* Completion Status Label */}
        {quest.completed && (
          <div className="hidden sm:block flex-shrink-0">
            <div className="text-[9px] font-black text-green-600 border border-green-200 bg-green-50 px-2 py-1 rounded-md uppercase">
              Clear
            </div>
          </div>
        )}
      </div>
      
      {/* Animated progress underline for active quests */}
      {!quest.completed && (
        <div className={`absolute bottom-0 left-0 h-0.5 transition-all duration-500 ${isMain ? 'bg-rose-500' : 'bg-blue-500'} w-0 group-hover:w-full`} />
      )}
    </div>
  );
}
