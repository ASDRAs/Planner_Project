'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Memo, updateMemo } from '@/lib/storage';
import { Category } from '@/lib/classifier';
import { CATEGORY_VALUES_TODO_FIRST } from '@/lib/constants';
import { getLocalDateString, getRelativeDateString, parseLocalDate } from '@/lib/dateUtils';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  defaultDropAnimationSideEffects,
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { validateSession } from '@/lib/supabase';

const QUEST_LOG_START_OFFSET = -1;
const QUEST_LOG_END_OFFSET = 3;

interface DateSectionConfig {
  title: string;
  date: string;
  accentColor: string;
  isYesterday?: boolean;
  isToday?: boolean;
}

interface DateSection extends DateSectionConfig {
  memos: Memo[];
}

interface DashboardProps {
  memos: Memo[];
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onRefresh: () => void;
  userId?: string;
  onAuthChange?: (isValid: boolean, userId: string | null) => void;
}

function sortMemosForSchedule(memos: Memo[]): Memo[] {
  return [...memos].sort((a, b) => {
    const orderDiff = (a.order ?? 0) - (b.order ?? 0);
    if (orderDiff !== 0) return orderDiff;
    return a.createdAt - b.createdAt;
  });
}

function groupMemosByDate(memos: Memo[]): Map<string, Memo[]> {
  const grouped = new Map<string, Memo[]>();

  for (const memo of sortMemosForSchedule(memos)) {
    const existing = grouped.get(memo.targetDate) ?? [];
    grouped.set(memo.targetDate, [...existing, memo]);
  }

  return grouped;
}

function formatDisplayDate(dateStr: string) {
  const d = parseLocalDate(dateStr);
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}.(${days[d.getDay()]})`;
}

export default function Dashboard({ memos, onToggle, onDelete, onRefresh, userId, onAuthChange }: DashboardProps) {
  const [activeMemo, setActiveMemo] = useState<Memo | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showFullSchedule, setShowFullSchedule] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    
    const bootstrap = async () => {
      const { isValid, userId: validatedId } = await validateSession();
      if (onAuthChange) onAuthChange(isValid, validatedId);
    };
    
    bootstrap();
  }, [onAuthChange]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const mainDateConfigs = useMemo<DateSectionConfig[]>(() => [
    {
      title: 'Yesterday',
      date: getRelativeDateString(QUEST_LOG_START_OFFSET),
      accentColor: 'bg-rose-100 dark:bg-rose-900/30 text-rose-600',
      isYesterday: true,
    },
    {
      title: 'Today',
      date: getLocalDateString(),
      accentColor: 'bg-purple-600 text-white shadow-purple-500/20',
      isToday: true,
    },
    {
      title: 'Tomorrow',
      date: getRelativeDateString(1),
      accentColor: 'bg-green-500 text-white shadow-green-500/20',
    },
    {
      title: 'D+2',
      date: getRelativeDateString(2),
      accentColor: 'bg-zinc-800 text-white',
    },
    {
      title: 'D+3',
      date: getRelativeDateString(QUEST_LOG_END_OFFSET),
      accentColor: 'bg-zinc-800 text-white',
    },
  ], []);

  const memosByDate = useMemo(() => groupMemosByDate(memos), [memos]);
  const mainDateSections = useMemo<DateSection[]>(
    () => mainDateConfigs.map((section) => ({
      ...section,
      memos: memosByDate.get(section.date) ?? [],
    })),
    [mainDateConfigs, memosByDate]
  );
  const fullScheduleSections = useMemo<DateSection[]>(() => {
    const visibleDateSet = new Set(mainDateConfigs.map((section) => section.date));
    const windowEndDate = getRelativeDateString(QUEST_LOG_END_OFFSET);
    const futureScheduleSections = Array.from(memosByDate.entries())
      .filter(([date]) => date > windowEndDate && !visibleDateSet.has(date))
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, sectionMemos]) => ({
        title: 'Future',
        date,
        memos: sectionMemos,
        accentColor: 'bg-zinc-800 text-white',
      }));

    return [...mainDateSections, ...futureScheduleSections];
  }, [mainDateConfigs, mainDateSections, memosByDate]);
  const visibleDateSections = showFullSchedule ? fullScheduleSections : mainDateSections;
  const historyDateSections = useMemo<DateSection[]>(() => {
    const windowStartDate = getRelativeDateString(QUEST_LOG_START_OFFSET);

    return Array.from(memosByDate.entries())
      .filter(([date]) => date < windowStartDate)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, sectionMemos]) => ({
        title: 'Past',
        date,
        memos: sectionMemos,
        accentColor: 'bg-rose-100 dark:bg-rose-900/30 text-rose-600',
      }));
  }, [memosByDate]);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveMemo(null);

    if (over) {
      const activeId = active.id as string;
      const overId = over.id as string;

      if (overId.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const draggedMemo = memos.find(m => m.id === activeId);
        if (draggedMemo && draggedMemo.targetDate !== overId) {
          await updateMemo(activeId, { targetDate: overId }, userId);
          onRefresh();
        }
      } else if (activeId !== overId) {
        const draggedMemo = memos.find(m => m.id === activeId);
        const overMemo = memos.find(m => m.id === overId);
        if (draggedMemo && overMemo && draggedMemo.targetDate !== overMemo.targetDate) {
          await updateMemo(activeId, { targetDate: overMemo.targetDate }, userId);
          onRefresh();
        }
      }
    }
  }, [memos, userId, onRefresh]);

  return (
    <div className="w-full max-w-5xl mx-auto space-y-8 md:space-y-10 pb-10 font-sans text-[var(--text-primary)]">
      <div className="flex justify-end px-1">
        <button onClick={() => setShowHistory(true)} className="flex items-center gap-2 px-4 md:px-5 py-2 md:py-2.5 rounded-full bg-[var(--eva-purple)]/10 text-[var(--eva-purple)] hover:bg-[var(--eva-purple)] hover:text-white transition-all text-[9px] md:text-[10px] font-black uppercase tracking-widest border border-[var(--eva-purple)]/20 shadow-lg shadow-[var(--eva-purple)]/5">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8v4l3 3"/><circle cx="12" cy="12" r="10"/></svg>
          Past Log
        </button>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={(e) => setActiveMemo(memos.find(m => m.id === e.active.id) || null)} onDragEnd={handleDragEnd}>
        <div className="space-y-8 md:space-y-10">
          {visibleDateSections.map((section) => (
            <DroppableDateSection
              key={section.date}
              title={section.title}
              date={section.date}
              memos={section.memos}
              onToggle={onToggle}
              onDelete={onDelete}
              onRefresh={onRefresh}
              accentColor={section.accentColor}
              showStatus={section.isToday && section.memos.some(m => !m.completed)}
              isYesterday={section.isYesterday}
              isToday={section.isToday}
              userId={userId}
            />
          ))}
        </div>
      {mounted && createPortal(
        <DragOverlay dropAnimation={{ sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.5' } } }) }}>
          {activeMemo ? (
            <div className="w-[clamp(320px,90vw,900px)] pointer-events-none select-none">
              <MemoRow memo={activeMemo} onToggle={() => {}} onDelete={() => {}} onRefresh={() => {}} isOverlay />
            </div>
          ) : null}
        </DragOverlay>,
        document.body
      )}
      </DndContext>

      <div className="flex justify-center px-1 pt-2">
        <button
          onClick={() => setShowFullSchedule((current) => !current)}
          className="flex items-center gap-2 rounded-full border border-[var(--eva-purple)]/20 bg-[var(--eva-purple)]/10 px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-[var(--eva-purple)] shadow-lg shadow-[var(--eva-purple)]/5 transition-all hover:bg-[var(--eva-purple)] hover:text-white md:px-6 md:py-3"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            {showFullSchedule ? <path d="m18 15-6-6-6 6" /> : <path d="m6 9 6 6 6-6" />}
          </svg>
          {showFullSchedule ? 'Compact View' : 'View Future Schedule'}
        </button>
      </div>

      {showHistory && mounted && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200" style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', transform: 'translateZ(0)' }} onClick={() => setShowHistory(false)}>
          <div className="bg-[var(--bg-main)] w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-[40px] shadow-2xl border-2 border-[var(--eva-purple)]/30 p-6 md:p-12 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-8 sticky top-0 bg-[var(--bg-main)]/80 backdrop-blur-md py-2 z-10">
              <div className="flex items-center gap-3">
                <div className="p-2 md:p-3 bg-purple-600 rounded-2xl text-white shadow-xl shadow-purple-500/20"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8v4l3 3"/><circle cx="12" cy="12" r="10"/></svg></div>
                <h2 className="text-xl md:text-2xl font-black uppercase italic tracking-tighter text-[var(--text-primary)]">Past Log</h2>
              </div>
              <button onClick={() => setShowHistory(false)} className="p-2 text-zinc-400 hover:text-rose-500 transition-colors"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button>
            </div>
            <div className="space-y-10">
              {historyDateSections.length === 0 ? <div className="py-20 text-center text-[var(--text-primary)]/20 font-black uppercase tracking-[0.4em] text-[9px] italic">No past log found</div> : historyDateSections.map(section => (
                <section key={section.date} className="space-y-3">
                  <header className="flex items-center gap-3 border-b border-[var(--border-subtle)] pb-2">
                    <span className={`text-[8px] md:text-[10px] font-black ${section.accentColor} px-2 md:px-3 py-0.5 md:py-1 rounded-lg tracking-widest uppercase italic shadow-sm`}>{section.title}</span>
                    <span className="text-[10px] md:text-[11px] font-black text-[var(--eva-purple)] uppercase tracking-[0.2em]">{formatDisplayDate(section.date)}</span>
                  </header>
                  <div className="grid grid-cols-1 gap-2">{section.memos.map(m => <MemoRow key={m.id} memo={m} onToggle={onToggle} onDelete={onDelete} onRefresh={onRefresh} userId={userId} />)}</div>
                </section>
              ))}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

interface DroppableDateSectionProps {
  title: string;
  date: string;
  memos: Memo[];
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onRefresh: () => void;
  accentColor: string;
  showStatus?: boolean;
  isYesterday?: boolean;
  isToday?: boolean;
  userId?: string;
}

function DroppableDateSection({ title, date, memos, onToggle, onDelete, onRefresh, accentColor, showStatus, isYesterday, isToday, userId }: DroppableDateSectionProps) {
  const { setNodeRef, isOver } = useDroppable({ id: date });
  const completedCount = memos.filter((m) => m.completed).length;
  const totalCount = memos.length;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  if (isYesterday && memos.length === 0 && !isOver) return null;

  return (
    <section ref={setNodeRef} className={`space-y-3 md:space-y-4 p-4 md:p-6 rounded-[32px] md:rounded-[40px] transition-all duration-300 border-2 ${isOver ? 'bg-[var(--eva-purple)]/5 border-[var(--eva-purple)]/40 scale-[1.02] shadow-2xl' : 'bg-transparent border-transparent'}`}>
      <header className="flex flex-col gap-2.5 md:gap-3 border-b border-[var(--border-subtle)] pb-3 md:pb-4 px-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 md:gap-4">
            <span className={`text-[8px] md:text-[10px] font-black ${accentColor} px-2 md:px-3 py-0.5 md:py-1 rounded-lg tracking-widest uppercase italic shadow-sm`}>{title}</span>
            <h3 className="text-xs md:text-sm font-black text-[var(--text-primary)] tracking-tight uppercase">{formatDisplayDate(date)}</h3>
          </div>
          {showStatus && <span className="w-2 md:w-2.5 h-2 md:h-2.5 bg-[var(--eva-green)] rounded-full animate-pulse shadow-[0_0_12px_rgba(74,222,128,0.8)]" />}
        </div>

        {isToday && totalCount > 0 && (
          <div className="w-full space-y-1 md:space-y-1.5 animate-in fade-in slide-in-from-left-2 duration-700">
            <div className="flex justify-between items-end px-1">
              <span className="text-[8px] font-black uppercase tracking-[0.2em] text-[var(--eva-purple)] opacity-60 italic">Synchronization Rate</span>
              <span className="text-[10px] md:text-[11px] font-mono font-black text-[var(--eva-green)]">{Math.round(progress)}%</span>
            </div>
            <div className="h-1 md:h-1.5 w-full bg-[var(--eva-purple)]/10 rounded-full overflow-hidden border border-[var(--eva-purple)]/5 p-[1px]">
              <div 
                className="h-full bg-gradient-to-r from-[var(--eva-purple)] to-[var(--eva-green)] rounded-full transition-all duration-1000 ease-out shadow-[0_0_8px_rgba(74,222,128,0.4)]"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </header>

      <div className="grid grid-cols-1 gap-1.5 md:gap-2">
        <SortableContext items={memos.map((m) => m.id)} strategy={verticalListSortingStrategy}>
          {memos.length === 0 && !isOver ? <EmptyState /> : memos.map((m) => <SortableMemoRow key={m.id} memo={m} onToggle={onToggle} onDelete={onDelete} onRefresh={onRefresh} userId={userId} />)}
          {isOver && memos.length === 0 && <div className="h-14 border-2 border-dashed border-[var(--eva-purple)]/30 rounded-2xl bg-[var(--eva-purple)]/5 animate-pulse" />}
        </SortableContext>
      </div>
    </section>
  );
}

interface MemoRowProps {
  memo: Memo;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onRefresh: () => void;
  dragHandleProps?: Record<string, unknown>;
  isOverlay?: boolean;
  userId?: string;
}

const SortableMemoRow = React.memo(function SortableMemoRow(props: MemoRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.memo.id });
  const style = { 
    transform: CSS.Transform.toString(transform), 
    transition, 
    opacity: isDragging ? 0.3 : 1, 
    zIndex: isDragging ? 100 : 1 
  };
  return <div ref={setNodeRef} style={style} {...attributes}><MemoRow {...props} dragHandleProps={listeners} /></div>;
});

const MemoRow = React.memo(function MemoRow({ memo, onToggle, onDelete, onRefresh, dragHandleProps, isOverlay, userId }: MemoRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(memo.content);
  const [editCategory, setEditCategory] = useState<string>(memo.category);
  const [editDate, setEditDate] = useState<string>(memo.targetDate);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const isClass = memo.tags.includes('수업');

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [isEditing, editContent]);

  const handleEditStart = () => {
    setEditContent(memo.content);
    setEditCategory(memo.category);
    setEditDate(memo.targetDate);
    setIsEditing(true);
  };

  const handleUpdate = async () => {
    if (!editContent.trim()) return;
    await updateMemo(memo.id, { 
      content: editContent.trim(), 
      category: editCategory as Category,
      targetDate: editDate
    }, userId);
    setIsEditing(false);
    onRefresh();
  };

  const categories = CATEGORY_VALUES_TODO_FIRST;

  return (
    <div className={`group flex flex-col gap-2 px-3 md:px-4 py-2.5 md:py-3 rounded-xl md:rounded-2xl transition-all border relative overflow-hidden ${
      memo.completed 
        ? 'bg-[var(--bg-main)]/40 border-transparent' 
        : isClass 
          ? 'bg-amber-400/20 border-amber-400/40 dark:bg-amber-400/10 dark:border-amber-400/30 shadow-lg shadow-amber-400/10' 
          : 'bg-[var(--bg-card)] border-[var(--border-subtle)] hover:border-[var(--eva-purple)]/40 hover:shadow-xl hover:shadow-[var(--eva-purple)]/5'
    } ${isOverlay ? 'bg-[var(--bg-card)] shadow-2xl ring-2 ring-[var(--eva-purple)]/20' : ''}`}>
      
      <div 
        className={`absolute inset-0 bg-gradient-to-r from-[var(--eva-green)]/10 to-transparent transition-all duration-700 ease-in-out pointer-events-none`}
        style={{ width: memo.completed ? '100%' : '0%', opacity: memo.completed ? 1 : 0 }}
      />
      <div 
        className={`absolute top-0 bottom-0 left-0 w-[2px] bg-[var(--eva-green)] shadow-[0_0_10px_var(--eva-green)] transition-all duration-700 ease-in-out z-10`}
        style={{ left: memo.completed ? '100%' : '0%', opacity: memo.completed ? 0.8 : 0 }}
      />

      <div className="flex items-center gap-2.5 md:gap-3 w-full min-h-[28px] md:min-h-[32px] relative z-20">
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <div {...dragHandleProps} style={{ touchAction: 'none' }} className="cursor-grab p-1 md:p-1.5 text-zinc-300 dark:text-zinc-600 hover:text-[var(--eva-purple)] transition-colors"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/></svg></div>
          {!isEditing && (
            <div className="flex items-center gap-0 opacity-0 group-hover:opacity-100 transition-all">
              <button onClick={handleEditStart} aria-label="Edit" className="p-1 md:p-1.5 text-zinc-400 hover:text-[var(--eva-purple)] transition-colors"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg></button>
              <button onClick={() => onDelete(memo.id)} aria-label="Delete" className="p-1 md:p-1.5 text-zinc-400 hover:text-rose-500 transition-colors"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/></svg></button>
            </div>
          )}
        </div>
        <button onClick={() => onToggle(memo.id)} className={`flex-shrink-0 w-4.5 h-4.5 md:w-5 md:h-5 rounded border-2 flex items-center justify-center transition-all ${memo.completed ? 'bg-[var(--eva-purple)] border-[var(--eva-purple)] text-white shadow-[0_0_8px_var(--eva-purple)]' : isClass ? 'border-amber-500 bg-[var(--bg-main)] shadow-[0_0_8px_rgba(245,158,11,0.2)]' : 'border-[var(--eva-purple)]/30 bg-[var(--bg-main)]'}`}>{memo.completed && <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--eva-green)]"><path d="M20 6 9 17l-5-5"/></svg>}</button>
        <div className="flex-grow min-w-0">{isEditing ? (
          <div className="w-full space-y-2 py-1 animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <select 
                value={editCategory} 
                onChange={(e) => setEditCategory(e.target.value)}
                className="px-2 py-1 bg-[var(--bg-main)] text-[var(--text-primary)] border border-[var(--border-subtle)] rounded-lg text-[8px] md:text-[9px] font-black uppercase outline-none focus:ring-2 focus:ring-[var(--eva-purple)]/50 cursor-pointer"
              >
                {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
              
              {editCategory === 'TODO' && (
                <div className="relative">
                  <input 
                    type="date" 
                    ref={dateInputRef} 
                    value={editDate} 
                    onChange={(e) => setEditDate(e.target.value)} 
                    className="absolute inset-0 w-0 h-0 opacity-0 overflow-hidden" 
                  />
                  <button 
                    onClick={() => dateInputRef.current?.showPicker()} 
                    className="text-[8px] md:text-[9px] font-black text-[var(--eva-purple)] bg-[var(--eva-purple)]/5 px-2 py-1 rounded-lg flex items-center gap-1 border border-[var(--eva-purple)]/10 hover:bg-[var(--eva-purple)]/10 transition-all uppercase tracking-widest"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    {editDate}
                  </button>
                </div>
              )}
              
              <div className="h-[1px] flex-grow bg-[var(--eva-purple)]/10" />
            </div>
            <textarea ref={textareaRef} value={editContent} onChange={(e) => setEditContent(e.target.value)} className="w-full p-2.5 md:p-3 text-xs md:text-sm bg-[var(--bg-input)] text-[var(--text-primary)] border border-[var(--eva-purple)]/20 rounded-xl outline-none focus:ring-2 focus:ring-[var(--eva-purple)]/50 resize-none font-medium" autoFocus />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setIsEditing(false)} className="text-[9px] md:text-[10px] font-black uppercase text-zinc-500">Cancel</button>
              <button onClick={handleUpdate} className="text-[9px] md:text-[10px] font-black uppercase text-[var(--eva-purple)] font-bold">Save</button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="flex flex-col justify-center min-w-0 flex-grow">
              {memo.folder && <span className={`text-[7px] md:text-[8px] font-black flex items-center gap-1 uppercase tracking-widest mb-0.5 ${memo.completed ? 'text-zinc-400' : 'text-[var(--eva-purple)]/60'}`}><svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>{memo.folder}</span>}
              <h4 className={`text-[13px] md:text-sm font-bold transition-all break-words whitespace-pre-wrap leading-snug ${memo.completed ? 'text-zinc-400/60 line-through' : 'text-[var(--text-primary)]'}`}>{memo.content}</h4>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0 ml-auto">
              {isClass && <span className="text-[7px] md:text-[8px] font-black bg-amber-500 text-white px-1.5 py-0.5 rounded uppercase tracking-widest flex items-center gap-1 shadow-sm italic"><svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>수업</span>}
              <span className={`text-[7px] md:text-[8px] font-black uppercase tracking-widest ${memo.completed ? 'text-zinc-400/40' : 'text-[var(--eva-purple)]/40'}`}>{memo.category}</span>
            </div>
          </div>
        )}</div>
      </div>
    </div>
  );
});

function EmptyState() {
  return (
    <div className="py-12 md:py-16 flex flex-col items-center justify-center bg-[var(--eva-purple)]/5 dark:bg-[var(--eva-purple)]/5 rounded-[32px] md:rounded-[40px] border-2 border-dashed border-[var(--border-subtle)] shadow-inner">
      <div className="text-[10px] md:text-[11px] font-black text-[var(--eva-purple)]/30 dark:text-[var(--eva-purple)]/40 tracking-[0.4em] uppercase italic text-center px-6">Waiting for Pilot Input...</div>
    </div>
  );
}
