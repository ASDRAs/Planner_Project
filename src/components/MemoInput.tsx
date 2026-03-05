'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { classifyMemo, ClassificationResult, Category } from '@/lib/classifier';
import { saveMemo } from '@/lib/storage';
import { User } from '@supabase/supabase-js';
import { getLocalDateString } from '@/lib/dateUtils';

interface MemoInputProps {
  onSave: () => void;
  user?: User | null;
}

export default function MemoInput({ onSave, user }: MemoInputProps) {
  const [text, setText] = useState('');
  const [result, setResult] = useState<ClassificationResult | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [isClassifying, setIsClassifying] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dateInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const userId = user?.id;
  const isSpecialUser = user?.email === 'asdra030522@gmail.com';

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      const newHeight = Math.max(96, Math.min(scrollHeight, 300));
      textareaRef.current.style.height = newHeight + 'px';
    }
  }, [text]);

  const categories: Category[] = ['STUDY', 'GAME_DESIGN', 'VAULT', 'THOUGHT', 'TODO'];

  const handleClassify = useCallback(async (val: string) => {
    if (!val.trim()) {
      setResult(null);
      setSelectedCategory(null);
      return;
    }
    setIsClassifying(true);
    try {
      const res = await classifyMemo(val);
      setResult(res);
      setSelectedCategory(res.category);
    } catch (e) {
      console.error(e);
    } finally {
      setIsClassifying(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (text) handleClassify(text);
    }, 800);
    return () => clearTimeout(timer);
  }, [text, handleClassify]);

  const handleSave = async () => {
    if (!text.trim() || !result || !selectedCategory || isSaving) return;
    
    setIsSaving(true);
    try {
      const { priority, tags, folder, targetDates, subTasks, cleanContent, rawInput } = result;
      const isTodo = selectedCategory === 'TODO';
      const hasFolder = !!folder;
      
      const contentsToSave = isTodo && subTasks && subTasks.length > 0 
        ? subTasks 
        : [(isTodo || hasFolder) ? cleanContent : rawInput];
      
      const finalDates = targetDates && targetDates.length > 0 ? targetDates : [getLocalDateString()];

      for (const content of contentsToSave) {
        for (const date of finalDates) {
          await saveMemo({
            content,
            category: selectedCategory,
            priority,
            tags,
            folder: folder || undefined,
            targetDate: date
          }, userId);
        }
      }

      setText('');
      setResult(null);
      setSelectedCategory(null);
      onSave();
    } catch (error: unknown) {
      console.error("Save failed:", error);
      if (error instanceof Error) {
        alert(`저장에 실패했습니다: ${error.message}`);
      } else {
        alert("알 수 없는 오류가 발생했습니다.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const updateTargetDate = (index: number, newDate: string) => {
    if (!result) return;
    const newDates = [...(result.targetDates || [])];
    newDates[index] = newDate;
    setResult({ ...result, targetDates: newDates });
  };

  const openDatePicker = (index: number) => {
    dateInputRefs.current[index]?.showPicker();
  };

  return (
    <div className="w-full space-y-4 font-sans text-[var(--text-primary)]">
      <div className="relative">
        <textarea
          ref={textareaRef}
          className="w-full min-h-[100px] p-5 md:p-6 text-[var(--text-primary)] bg-[var(--bg-main)]/50 border-2 border-[var(--eva-purple)]/10 focus:border-[var(--eva-purple)]/50 rounded-[28px] md:rounded-[32px] focus:ring-4 focus:ring-[var(--eva-purple)]/10 outline-none transition-all resize-none overflow-y-auto placeholder:text-[var(--text-primary)]/30 font-bold text-base md:text-lg leading-relaxed shadow-inner"
          placeholder="예: 폴더명/ 생각 정리 또는 내일 할 일"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        {isSpecialUser && !text && (
          <div className="absolute left-6 bottom-4 flex items-center gap-2 text-[9px] font-black text-[var(--eva-purple)]/40 uppercase tracking-widest animate-in fade-in duration-700">
            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
            Pilot Tip: &quot;수업&quot; 키워드나 시간 형식을 포함하면 자동으로 수업 일정이 구성됩니다.
          </div>
        )}
        {(isClassifying || isSaving) && (
          <div className="absolute right-6 bottom-6 flex items-center gap-2">
            <div className="w-5 h-5 border-2 border-[var(--eva-purple)] border-t-[var(--eva-green)] rounded-full animate-spin shadow-[0_0_10px_var(--eva-purple)]" />
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 md:gap-6 px-2">
        <div className="flex flex-wrap items-center gap-1.5 md:gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all uppercase tracking-widest border-2 ${
                selectedCategory === cat 
                  ? 'bg-[var(--eva-purple)] text-white border-[var(--eva-purple)] shadow-lg shadow-[var(--eva-purple)]/20 scale-105' 
                  : 'bg-[var(--bg-card)] text-[var(--text-primary)]/40 border-[var(--border-subtle)] hover:border-[var(--eva-purple)]/30'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {result && (
          <div className="flex flex-wrap items-center gap-3 animate-in fade-in slide-in-from-bottom-2">
            {selectedCategory === 'TODO' && result.targetDates?.map((date, idx) => (
              <div key={idx} className="relative">
                <input type="date" ref={el => { dateInputRefs.current[idx] = el; }} value={date} onChange={(e) => updateTargetDate(idx, e.target.value)} className="absolute inset-0 w-0 h-0 opacity-0 overflow-hidden" />
                <button onClick={() => openDatePicker(idx)} className="text-[10px] md:text-xs font-black text-[var(--eva-purple)] bg-[var(--eva-purple)]/5 px-3 py-2 rounded-lg flex items-center gap-2 border border-[var(--eva-purple)]/10 hover:bg-[var(--eva-purple)]/10 transition-all active:scale-95 uppercase tracking-widest">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  {date}
                </button>
              </div>
            ))}
            {result.folder && <span className="text-[10px] md:text-xs font-black text-[var(--eva-purple)] bg-[var(--eva-purple)]/10 px-3 py-2 rounded-lg border border-[var(--eva-purple)]/20 tracking-tighter uppercase italic">📁 {result.folder}</span>}
            <button onClick={handleSave} disabled={isClassifying || isSaving} className="flex-grow sm:flex-grow-0 px-8 py-3 bg-[var(--eva-purple)] hover:bg-[var(--eva-purple)]/90 text-white text-[10px] font-black rounded-xl transition-all shadow-xl shadow-[var(--eva-purple)]/30 active:scale-95 uppercase tracking-[0.2em] disabled:opacity-30 italic">
              {isSaving ? 'Synchronizing...' : (isClassifying ? 'Analyzing' : 'Execute Deploy')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
