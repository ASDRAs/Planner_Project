'use client';

import React from 'react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'Delete',
  cancelText = 'Cancel',
  variant = 'danger'
}: ConfirmModalProps) {
  if (!isOpen) return null;

  const getVariantStyles = () => {
    switch (variant) {
      case 'danger': return 'bg-rose-600 hover:bg-rose-700 shadow-rose-500/20 text-white';
      case 'warning': return 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20 text-white';
      default: return 'bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 text-white';
    }
  };

  const getIcon = () => {
    switch (variant) {
      case 'danger':
        return (
          <div className="w-12 h-12 rounded-full bg-rose-50 dark:bg-rose-900/20 flex items-center justify-center text-rose-600 mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
          </div>
        );
      default:
        return (
          <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-400 mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-zinc-950/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={onCancel}>
      <div 
        className="bg-white dark:bg-zinc-900 w-full max-w-sm rounded-[32px] shadow-2xl border border-zinc-100 dark:border-zinc-800 p-8 animate-in zoom-in-95 duration-200 flex flex-col items-center text-center"
        onClick={e => e.stopPropagation()}
      >
        {getIcon()}
        
        <h3 className="text-xl font-black text-zinc-900 dark:text-white uppercase italic tracking-tighter mb-2">
          {title}
        </h3>
        
        <p className="text-zinc-500 dark:text-zinc-400 text-sm font-medium mb-8 leading-relaxed">
          {message}
        </p>

        <div className="flex gap-3 w-full">
          <button 
            onClick={onCancel}
            className="flex-1 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest text-zinc-400 bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-all active:scale-95"
          >
            {cancelText}
          </button>
          <button 
            onClick={onConfirm}
            className={`flex-1 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg transition-all active:scale-95 ${getVariantStyles()}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
