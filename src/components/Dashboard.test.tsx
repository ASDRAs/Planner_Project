import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Dashboard from './Dashboard';
import { getRelativeDateString } from '@/lib/dateUtils';
import type { Memo } from '@/lib/storage';

vi.mock('@/lib/storage', () => ({
  updateMemo: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  validateSession: vi.fn().mockResolvedValue({ isValid: false, userId: null }),
}));

function createMemo(id: string, content: string, dayOffset: number): Memo {
  return {
    id,
    content,
    category: 'TODO',
    priority: 'Medium',
    tags: [],
    createdAt: Date.now() + dayOffset,
    targetDate: getRelativeDateString(dayOffset),
    completed: false,
  };
}

describe('Dashboard quest schedule window', () => {
  it('shows only yesterday through D+3 by default and reveals all schedules in detail view', async () => {
    const memos = [
      createMemo('past', '범위 이전 일정', -2),
      createMemo('yesterday', '어제 일정', -1),
      createMemo('today', '오늘 일정', 0),
      createMemo('three-days', '3일 후 일정', 3),
      createMemo('four-days', '4일 후 일정', 4),
    ];

    render(
      <Dashboard
        memos={memos}
        onToggle={vi.fn()}
        onDelete={vi.fn()}
        onRefresh={vi.fn()}
      />
    );

    expect(screen.queryByText('범위 이전 일정')).not.toBeInTheDocument();
    expect(screen.getByText('어제 일정')).toBeInTheDocument();
    expect(screen.getByText('오늘 일정')).toBeInTheDocument();
    expect(screen.getByText('3일 후 일정')).toBeInTheDocument();
    expect(screen.queryByText('4일 후 일정')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Detail View/i }));

    expect(await screen.findByText('범위 이전 일정')).toBeInTheDocument();
    expect(await screen.findByText('4일 후 일정')).toBeInTheDocument();
  });
});
