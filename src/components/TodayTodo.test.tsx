import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import TodayTodo from './TodayTodo';
import { Memo } from '@/lib/storage';
import { getLocalDateString } from '@/lib/dateUtils';

const today = getLocalDateString();

const mockMemos: Memo[] = [
  {
    id: '1',
    content: 'Important Task',
    category: 'TODO',
    priority: 'High',
    tags: [],
    createdAt: Date.now(),
    targetDate: today,
    completed: false
  },
  {
    id: '2',
    content: 'Normal Task',
    category: 'TODO',
    priority: 'Medium',
    tags: [],
    createdAt: Date.now(),
    targetDate: today,
    completed: false
  }
];

describe('TodayTodo Component', () => {
  it('renders today todos correctly', () => {
    render(<TodayTodo memos={mockMemos} onToggle={vi.fn()} />);
    expect(screen.getByText('Important Task')).toBeInTheDocument();
    expect(screen.getByText('Normal Task')).toBeInTheDocument();
    expect(screen.getByText('Critical Objectives')).toBeInTheDocument();
    expect(screen.getByText('Standard Objectives')).toBeInTheDocument();
  });

  it('displays correct progress percentage', () => {
    const partiallyCompletedMemos = [
      { ...mockMemos[0], completed: true },
      mockMemos[1]
    ];
    render(<TodayTodo memos={partiallyCompletedMemos} onToggle={vi.fn()} />);
    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  it('calls onToggle when a task is clicked', () => {
    const onToggle = vi.fn();
    render(<TodayTodo memos={mockMemos} onToggle={onToggle} />);
    
    const task = screen.getByText('Important Task');
    fireEvent.click(task);
    
    expect(onToggle).toHaveBeenCalledWith('1');
  });

  it('returns null if no todos for today', () => {
    const { container } = render(<TodayTodo memos={[]} onToggle={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });
});
