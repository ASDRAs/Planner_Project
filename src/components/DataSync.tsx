'use client';

import React, { useState, useRef, useEffect } from 'react';
import { exportMemosToJson, importMemosFromJson } from '@/lib/storage';

interface DataSyncProps {
  onImport: () => void;
  userId?: string;
}

export default function DataSync({ onImport, userId }: DataSyncProps) {
  const [isOpen, setIsOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

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

  const handleExport = () => {
    const json = exportMemosToJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `memos-backup-${new Date().toISOString().split('T')[0]}.json`;
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
          onImport();
        } else {
          alert('데이터 형식이 올바르지 않습니다.');
        }
      } catch (err: any) {
        alert(`가져오기 실패: ${err.message}`);
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setIsOpen(false);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 font-sans" ref={menuRef}>
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
        </div>
      )}

      {/* 메인 플로팅 버튼 */}
      <div className="relative group">
        {/* Outer technical ring */}
        <div className={`absolute inset-[-10px] border-2 border-dashed border-[var(--eva-purple)]/40 rounded-full eva-spin-slow transition-opacity duration-500 ${isOpen ? 'opacity-0' : 'opacity-100'}`} />
        
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`w-16 h-16 flex items-center justify-center rounded-full shadow-2xl transition-all duration-500 active:scale-90 relative z-10 ${
            isOpen 
              ? 'bg-purple-600 text-white rotate-45 shadow-[0_0_35px_var(--eva-purple-glow)] border-2 border-purple-400' 
              : 'eva-glass text-[var(--eva-purple)] border-2 border-[var(--eva-purple)]/60 hover:scale-110 shadow-[0_0_25px_var(--eva-purple-glow)]'
          }`}
        >
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[var(--eva-purple)]/20 to-transparent opacity-50" />
          
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="relative z-20">
            {/* Always show + structure */}
            <line x1="12" y1="5" x2="12" y2="19" className={`transition-all duration-500 ${isOpen ? 'text-white' : 'text-[var(--eva-purple)]'}`} />
            <line x1="5" y1="12" x2="19" y2="12" className={`transition-all duration-500 ${isOpen ? 'text-white' : 'text-[var(--eva-purple)]'}`} />
            
            {!isOpen && (
              <circle cx="12" cy="12" r="3" className="fill-[var(--eva-green)]/30 stroke-[var(--eva-green)] animate-pulse" />
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
    </div>
  );
}
