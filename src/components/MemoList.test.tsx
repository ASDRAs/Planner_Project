import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import MemoList from './MemoList';
import { Memo } from '@/lib/storage';

const mockMemos: Memo[] = [
  {
    id: '1',
    content: '공부 내용',
    category: 'STUDY',
    priority: 'Medium',
    tags: ['네트워크'],
    createdAt: Date.now()
  },
  {
    id: '2',
    content: '생각 정리',
    category: 'THOUGHT',
    priority: 'Low',
    tags: [],
    createdAt: Date.now() - 1000
  }
];

describe('MemoList Component', () => {
  it('메모 목록을 올바르게 렌더링해야 함', () => {
    render(<MemoList memos={mockMemos} onDelete={vi.fn()} onRefresh={vi.fn()} />);
    
    // Select 'All' filter to see both STUDY and THOUGHT memos
    const allFilter = screen.getByRole('button', { name: /All/i });
    fireEvent.click(allFilter);

    expect(screen.getByText('공부 내용')).toBeInTheDocument();
    expect(screen.getByText('생각 정리')).toBeInTheDocument();
    // 카테고리 텍스트는 버튼과 배지 두 군데 이상 존재할 수 있음
    expect(screen.getAllByText('STUDY').length).toBeGreaterThan(0);
    expect(screen.getAllByText('THOUGHT').length).toBeGreaterThan(0);
  });

  it('삭제 버튼을 누르면 onDelete 콜백이 호출되어야 함', () => {
    const onDelete = vi.fn();
    render(<MemoList memos={mockMemos} onDelete={onDelete} onRefresh={vi.fn()} />);
    
    const deleteButtons = screen.getAllByLabelText('Delete');
    fireEvent.click(deleteButtons[0]);

    expect(onDelete).toHaveBeenCalledWith('1');
  });

  it('카테고리 필터가 작동해야 함', () => {
    render(<MemoList memos={mockMemos} onDelete={vi.fn()} onRefresh={vi.fn()} />);
    
    // 기본적으로 'STUDY'가 선택되어 있음 (MemoList.tsx 초기값)
    expect(screen.getByText('공부 내용')).toBeInTheDocument();
    
    // 'THOUGHT' 필터 클릭
    const thoughtFilter = screen.getByRole('button', { name: /THOUGHT/i });
    fireEvent.click(thoughtFilter);

    expect(screen.queryByText('공부 내용')).not.toBeInTheDocument();
    expect(screen.getByText('생각 정리')).toBeInTheDocument();
  });

  it('검색어로 메모를 필터링할 수 있어야 함', () => {
    render(<MemoList memos={mockMemos} onDelete={vi.fn()} onRefresh={vi.fn()} />);
    
    const searchInput = screen.getByPlaceholderText(/Filter Archive/i);
    
    // 내용 검색
    fireEvent.change(searchInput, { target: { value: '공부' } });
    expect(screen.getByText('공부 내용')).toBeInTheDocument();
    expect(screen.queryByText('생각 정리')).not.toBeInTheDocument();
  });
});
