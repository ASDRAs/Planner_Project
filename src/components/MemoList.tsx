'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Memo, updateMemo, mergeMemos, updateMemosOrder } from '@/lib/storage';
import { Category } from '@/lib/classifier';
import ConfirmModal from './ConfirmModal';
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
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface MemoListProps {
  memos: Memo[];
  onDelete: (id: string) => void;
  onRefresh: () => void;
  userId?: string;
}

export default function MemoList({ memos, onDelete, onRefresh, userId }: MemoListProps) {
  const [filter, setFilter] = useState<Category | 'All'>('STUDY');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeMemo, setActiveMemo] = useState<Memo | null>(null);
  const [expandedMemo, setExpandedMemo] = useState<Memo | null>(null);
  const [showMergeConfirm, setShowMergeConfirm] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const filteredMemos = memos.filter(m => {
    const matchesCategory = filter === 'All' || m.category === filter;
    const query = searchQuery.toLowerCase().trim();
    if (!query) return matchesCategory;
    
    if (query.startsWith('#')) {
      return matchesCategory && m.tags.some(tag => tag.toLowerCase().includes(query.slice(1)));
    }
    return matchesCategory && (
      m.content.toLowerCase().includes(query) || 
      m.tags.some(tag => tag.toLowerCase().includes(query)) ||
      !!(m.folder && m.folder.toLowerCase().includes(query))
    );
  });

  const handleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const confirmMerge = async () => {
    await mergeMemos(selectedIds, userId);
    setSelectedIds([]);
    setShowMergeConfirm(false);
    onRefresh();
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveMemo(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    if (overId.startsWith('folder:')) {
      const targetFolder = overId === 'folder:__none__' ? undefined : overId.replace('folder:', '');
      const memo = memos.find(m => m.id === activeId);
      if (memo && memo.folder !== targetFolder) {
        await updateMemo(activeId, { folder: targetFolder }, userId);
        onRefresh();
        return;
      }
    }

    if (activeId !== overId) {
      const activeMemo = memos.find(m => m.id === activeId);
      const overMemo = memos.find(m => m.id === overId);

      if (activeMemo && overMemo) {
        if (activeMemo.folder !== overMemo.folder) {
          await updateMemo(activeId, { folder: overMemo.folder }, userId);
        }

        const oldIndex = memos.findIndex(m => m.id === activeId);
        const newIndex = memos.findIndex(m => m.id === overId);

        if (oldIndex !== -1 && newIndex !== -1) {
          const newMemos = arrayMove(memos, oldIndex, newIndex);
          const updatedMemos = newMemos.map((m, index) => ({ ...m, order: index }));
          await updateMemosOrder(updatedMemos, userId);
          onRefresh();
        }
      }
    }
  };

  const categories: (Category | 'All')[] = ['STUDY', 'GAME_DESIGN', 'VAULT', 'THOUGHT', 'All'];
  const folders = Array.from(new Set(filteredMemos.filter(m => m.folder).map(m => m.folder!)));
  const noFolderMemos = filteredMemos.filter(m => !m.folder);

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 md:space-y-8">
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between sticky top-[60px] md:top-[73px] bg-transparent py-2 md:py-4 z-30 px-1 md:px-0 font-sans">
        <div className="flex flex-col gap-3 w-full md:w-auto">
          <div className="eva-nav-glass flex overflow-x-auto scrollbar-hide gap-1 md:gap-2 p-1.5 md:p-2">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setFilter(cat)}
                className={`flex-shrink-0 px-3 md:px-5 py-1.5 md:py-2 rounded-full text-[8px] md:text-[10px] font-black transition-all uppercase tracking-[0.1em] md:tracking-[0.15em] border ${
                  filter === cat ? 'bg-[var(--eva-purple)] text-white border-[var(--eva-purple)] shadow-lg' : 'bg-transparent text-[var(--text-primary)]/40 border-transparent hover:border-[var(--eva-purple)]/20'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
          {selectedIds.length >= 2 && (
            <button onClick={() => setShowMergeConfirm(true)} className="w-full md:w-auto px-5 py-2 rounded-full text-[9px] md:text-[10px] font-black bg-purple-600 text-white shadow-xl hover:bg-purple-700 transition-all uppercase tracking-widest italic border border-purple-400/30">
              Merge {selectedIds.length} Fragments
            </button>
          )}
        </div>
        <div className="relative w-full md:w-72">
          <input type="text" placeholder="Filter Archive..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2.5 md:py-3 bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-full text-xs md:text-sm font-bold focus:ring-4 focus:ring-[var(--eva-purple)]/10 outline-none transition-all placeholder:text-[var(--text-primary)]/20 text-[var(--text-primary)]" />
          <svg className="absolute left-4 top-3 md:top-3.5 text-[var(--eva-purple)]/40" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={(e) => setActiveMemo(memos.find(m => m.id === e.active.id) || null)} onDragEnd={handleDragEnd}>
        <div className="space-y-10 md:space-y-12">
          <SortableContext items={filteredMemos.map(m => m.id)} strategy={rectSortingStrategy}>
            <DroppableFolder title="Unsorted Records" folderName={undefined} memos={noFolderMemos} selectedIds={selectedIds} editingId={editingId} handleSelect={handleSelect} setEditingId={setEditingId} onDelete={onDelete} onRefresh={onRefresh} setExpandedMemo={setExpandedMemo} userId={userId} />
            {folders.map(folder => (
              <DroppableFolder key={folder} title={folder} folderName={folder} memos={filteredMemos.filter(m => m.folder === folder)} selectedIds={selectedIds} editingId={editingId} handleSelect={handleSelect} setEditingId={setEditingId} onDelete={onDelete} onRefresh={onRefresh} setExpandedMemo={setExpandedMemo} userId={userId} />
            ))}
          </SortableContext>
        </div>
        <DragOverlay dropAnimation={{ sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.5' } } }) }}>
          {activeMemo ? (
            <div className="w-[300px] pointer-events-none select-none" style={{ willChange: 'transform' }}>
              <KnowledgeCard memo={activeMemo} isSelected={selectedIds.includes(activeMemo.id)} isEditing={false} onSelect={() => {}} onEdit={() => {}} onCancelEdit={() => {}} onDelete={() => {}} onRefresh={() => {}} onExpand={() => {}} isOverlay />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {expandedMemo && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200" onClick={() => setExpandedMemo(null)}>
          <div className="bg-[var(--bg-main)] w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-[40px] shadow-2xl border border-[var(--border-subtle)] p-6 md:p-12 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6 md:mb-8">
              <div className="flex items-center gap-3">
                <span className="text-[9px] md:text-[10px] font-black text-[var(--eva-purple)] uppercase tracking-[0.2em]">{expandedMemo.category}</span>
                {expandedMemo.folder && <span className="text-[9px] md:text-[10px] font-bold text-[var(--eva-purple)] bg-[var(--eva-purple)]/10 px-2.5 py-1 rounded-full border border-[var(--eva-purple)]/20 flex items-center gap-1.5 uppercase tracking-widest">📁 {expandedMemo.folder}</span>}
              </div>
              <button onClick={() => setExpandedMemo(null)} className="p-2 text-zinc-400 hover:text-[var(--eva-purple)] transition-colors"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button>
            </div>
            <div className="text-[var(--text-primary)]">
              <MiniMarkdown content={expandedMemo.content} />
            </div>
            <div className="flex flex-wrap gap-1.5 mt-8 pt-6 border-t border-[var(--border-subtle)]">
              {expandedMemo.tags.map(tag => <span key={tag} className="text-[8px] md:text-[9px] font-black text-[var(--eva-purple)]/60 bg-[var(--eva-purple)]/5 px-2 py-1 rounded-lg border border-[var(--eva-purple)]/10 uppercase tracking-widest">#{tag}</span>)}
            </div>
          </div>
        </div>
      )}

      <ConfirmModal isOpen={showMergeConfirm} title="Merge Data" message={`Confirming the fusion of ${selectedIds.length} data fragments?`} onConfirm={confirmMerge} onCancel={() => setShowMergeConfirm(false)} confirmText="Execute Fusion" variant="warning" />
    </div>
  );
}

interface DroppableFolderProps {
  title: string;
  folderName: string | undefined;
  memos: Memo[];
  selectedIds: string[];
  editingId: string | null;
  handleSelect: (id: string) => void;
  setEditingId: (id: string | null) => void;
  onDelete: (id: string) => void;
  onRefresh: () => void;
  setExpandedMemo: (memo: Memo | null) => void;
  userId?: string;
}

function DroppableFolder({ title, folderName, memos, selectedIds, editingId, handleSelect, setEditingId, onDelete, onRefresh, setExpandedMemo, userId }: DroppableFolderProps) {
  const { setNodeRef, isOver } = useDroppable({ id: `folder:${folderName || '__none__'}` });
  
  return (
    <div ref={setNodeRef} className={`space-y-3 md:space-y-4 p-3 md:p-4 rounded-[32px] md:rounded-[40px] transition-all duration-300 border-2 ${isOver ? 'bg-[var(--eva-purple)]/5 border-[var(--eva-purple)]/40 scale-[1.01] shadow-xl' : 'bg-transparent border-transparent'}`}>
      <h3 className={`text-[10px] md:text-xs font-black uppercase tracking-[0.2em] md:tracking-[0.25em] flex items-center gap-2 md:gap-3 ${folderName ? 'text-[var(--text-primary)]' : 'text-[var(--text-primary)]/40'}`}>
        <span className={`px-3 md:px-4 py-1 md:py-1.5 rounded-full flex items-center gap-2 ${folderName ? 'bg-[var(--eva-purple)]/10 dark:bg-[var(--eva-purple)]/20 border border-[var(--eva-purple)]/20' : 'bg-[var(--bg-card)] border border-[var(--border-subtle)] italic'}`}>
          {folderName ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          )}
          {title}
        </span>
        <div className="h-[1px] flex-grow bg-[var(--border-subtle)]" />
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 min-h-[50px]">
        {memos.map((memo) => (
          <SortableKnowledgeCard key={memo.id} memo={memo} isSelected={selectedIds.includes(memo.id)} isEditing={editingId === memo.id} onSelect={() => handleSelect(memo.id)} onEdit={() => setEditingId(memo.id)} onCancelEdit={() => setEditingId(null)} onDelete={onDelete} onRefresh={onRefresh} onExpand={() => setExpandedMemo(memo)} userId={userId} />
        ))}
        {isOver && memos.length === 0 && <div className="col-span-full h-20 border-2 border-dashed border-[var(--eva-purple)]/30 rounded-[28px] bg-[var(--eva-purple)]/5 animate-pulse flex items-center justify-center text-[9px] font-black text-[var(--eva-purple)] uppercase tracking-widest">Relocate to {title}</div>}
      </div>
    </div>
  );
}

interface KnowledgeCardProps {
  memo: Memo;
  isSelected: boolean;
  isEditing: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onCancelEdit: () => void;
  onDelete: (id: string) => void;
  onRefresh: () => void;
  onExpand: () => void;
  dragHandleProps?: Record<string, unknown>;
  isOverlay?: boolean;
  userId?: string;
}

function SortableKnowledgeCard(props: KnowledgeCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.memo.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.3 : 1, zIndex: isDragging ? 100 : 1 };
  return <div ref={setNodeRef} style={style} {...attributes}><KnowledgeCard {...props} dragHandleProps={listeners} /></div>;
}

function MiniMarkdown({ content }: { content: string }) {
  const lines = content.split('\n');
  return (
    <div className="space-y-1.5 md:space-y-2 text-[var(--text-primary)] text-[13px] md:text-sm leading-relaxed font-medium">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (trimmed === '---') return <div key={i} className="h-[1px] w-full bg-[var(--border-subtle)] my-3 md:my-4" />;
        if (trimmed.startsWith('# ')) return <h1 key={i} className="text-xl md:text-2xl font-black text-[var(--text-primary)] mt-5 mb-3">{trimmed.slice(2)}</h1>;
        if (trimmed.startsWith('## ')) return <h2 key={i} className="text-lg md:text-xl font-black text-[var(--text-primary)] mt-4 mb-2">{trimmed.slice(3)}</h2>;
        if (trimmed.startsWith('### ')) return <h3 key={i} className="text-base md:text-lg font-black text-[var(--text-primary)] mt-3 mb-1.5">{trimmed.slice(4)}</h3>;
        const boldRegex = /\*\*(.*?)\*\*/g;
        const parts = []; let lastIndex = 0; let match;
        while ((match = boldRegex.exec(line)) !== null) {
          if (match.index > lastIndex) parts.push(line.substring(lastIndex, match.index));
          parts.push(<strong key={match.index} className="font-black text-[var(--text-primary)] underline decoration-[var(--eva-purple)]/30">{match[1]}</strong>);
          lastIndex = boldRegex.lastIndex;
        }
        if (lastIndex < line.length) parts.push(line.substring(lastIndex));
        const isList = /^[*-]\s/.test(line);
        return <p key={i} className={`${isList ? 'pl-4 relative' : ''} min-h-[1.2em]`}>{isList && <span className="absolute left-0 text-[var(--eva-purple)] font-black">•</span>}{parts.length > 0 ? parts : (line || '\u00A0')}</p>;
      })}
    </div>
  );
}

function KnowledgeCard({ memo, isSelected, isEditing, onSelect, onEdit, onCancelEdit, onDelete, onRefresh, onExpand, dragHandleProps, isOverlay, userId }: KnowledgeCardProps) {
  const [editContent, setEditContent] = useState(memo.content);
  const [editCategory, setEditCategory] = useState<Category>(memo.category);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isLong = memo.content.split('\n').length > 10;

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [isEditing, editContent]);

  const handleEditStart = () => {
    setEditContent(memo.content);
    setEditCategory(memo.category);
    onEdit();
  };

  const handleUpdate = async () => {
    if (!editContent.trim()) return;
    await updateMemo(memo.id, { content: editContent.trim(), category: editCategory }, userId);
    onCancelEdit();
    onRefresh();
  };

  const categories: Category[] = ['STUDY', 'GAME_DESIGN', 'VAULT', 'THOUGHT', 'TODO'];

  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case 'STUDY': return 'bg-blue-500';
      case 'GAME_DESIGN': return 'bg-purple-500';
      case 'VAULT': return 'bg-rose-500';
      case 'THOUGHT': return 'bg-amber-500';
      default: return 'bg-zinc-400';
    }
  };

  return (
    <div className={`group bg-[var(--bg-card)] border rounded-[28px] md:rounded-[32px] shadow-sm transition-all relative overflow-hidden flex flex-col min-h-[160px] md:min-h-[180px] ${isSelected ? 'border-[var(--eva-purple)] ring-4 ring-[var(--eva-purple)]/10' : 'border-[var(--border-subtle)]'} ${isEditing ? 'z-20 scale-[1.02]' : ''} ${isOverlay ? 'shadow-2xl ring-4 ring-[var(--eva-purple)]/30' : ''}`}>
      <div className={`absolute top-0 left-0 w-1 md:w-1.5 h-full ${getCategoryColor(memo.category)} opacity-40`} />
      <div className={`absolute top-0 right-0 p-2 md:p-3 flex items-center gap-0.5 z-10 ${isEditing ? 'hidden' : ''}`}>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all mr-1">
          <button onClick={handleEditStart} className="p-1.5 md:p-2 text-zinc-400 hover:text-[var(--eva-purple)] transition-colors"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg></button>
          <button onClick={() => onDelete(memo.id)} className="p-1.5 md:p-2 text-zinc-400 hover:text-rose-500 transition-colors"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/></svg></button>
        </div>
        <div {...dragHandleProps} style={{ touchAction: 'none' }} className="cursor-grab p-1.5 md:p-2 text-zinc-300 dark:text-zinc-700 hover:text-zinc-500 transition-colors"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/></svg></div>
      </div>
      <div className="p-5 md:p-6 flex flex-col flex-grow">
        <div className="flex justify-between items-center mb-4 md:mb-5 min-h-[20px] md:min-h-[24px]">
          <div className="flex items-center gap-2 md:gap-2.5">
            <input type="checkbox" checked={isSelected} onChange={onSelect} className="w-3.5 h-3.5 md:w-4 md:h-4 rounded-full border-[var(--border-subtle)] text-[var(--eva-purple)] focus:ring-[var(--eva-purple)] cursor-pointer bg-transparent" />
            <span className="text-[8px] md:text-[10px] font-black text-[var(--eva-purple)]/50 uppercase tracking-[0.15em] md:tracking-[0.2em] italic">{memo.category}</span>
          </div>
        </div>
        {isEditing ? (
          <div className="space-y-3 md:space-y-4 flex-grow flex flex-col">
            <div className="flex flex-col gap-1.5 md:gap-2">
              <label className="text-[8px] md:text-[9px] font-black text-[var(--eva-purple)]/40 uppercase tracking-widest px-1">Category Override</label>
              <select 
                value={editCategory} 
                onChange={(e) => setEditCategory(e.target.value as Category)}
                className="w-full px-3 md:px-4 py-2 md:py-2.5 bg-[var(--bg-main)] text-[var(--text-primary)] border border-[var(--border-subtle)] rounded-lg md:rounded-xl text-[9px] md:text-[10px] font-black uppercase outline-none focus:ring-2 focus:ring-[var(--eva-purple)]/50 appearance-none cursor-pointer"
              >
                {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>
            <textarea ref={textareaRef} value={editContent} onChange={(e) => setEditContent(e.target.value)} className="w-full p-3 md:p-4 text-xs md:text-sm bg-[var(--bg-input)] text-[var(--text-primary)] border border-[var(--eva-purple)]/20 rounded-xl md:rounded-2xl outline-none focus:ring-4 focus:ring-[var(--eva-purple)]/10 resize-none font-medium flex-grow shadow-inner" autoFocus />
            <div className="flex gap-2 justify-end pb-1 md:pb-2">
              <button onClick={onCancelEdit} className="px-3 md:px-4 py-1.5 text-[9px] md:text-[10px] font-black uppercase text-zinc-500 hover:text-zinc-700">Cancel</button>
              <button onClick={handleUpdate} className="px-4 md:px-5 py-1.5 md:py-2 text-[9px] md:text-[10px] font-black uppercase bg-purple-600 text-white rounded-lg md:rounded-xl hover:scale-105 transition-all shadow-lg">Commit</button>
            </div>
          </div>
        ) : (
          <>
            <div className={`relative ${isLong ? 'max-h-[200px] md:max-h-[240px] overflow-hidden' : ''}`}><MiniMarkdown content={memo.content} />{isLong && <div className="absolute bottom-0 left-0 w-full h-12 md:h-16 bg-gradient-to-t from-[var(--bg-card)] to-transparent" />}</div>
            {isLong && <button onClick={onExpand} className="text-[9px] md:text-[10px] font-black text-[var(--eva-purple)] uppercase hover:text-[var(--eva-purple)]/80 mt-2 md:mt-3 mb-3 md:mb-4 text-left tracking-widest italic underline decoration-purple-500/20">Expand File...</button>}
            <div className="flex flex-wrap gap-1.5 mt-auto pt-3 md:pt-4">{memo.tags.map((tag: string) => <span key={tag} className="text-[8px] md:text-[9px] font-black text-[var(--eva-purple)]/60 bg-[var(--eva-purple)]/5 px-1.5 md:px-2 py-0.5 md:py-1 rounded-md border border-[var(--eva-purple)]/10 uppercase tracking-widest">#{tag}</span>)}</div>
          </>
        )}
      </div>
    </div>
  );
}
