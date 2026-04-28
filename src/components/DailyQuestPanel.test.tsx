import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import DailyQuestPanel from './DailyQuestPanel';
import { getLocalDateString, getRelativeDateString } from '@/lib/dateUtils';
import type { Memo } from '@/lib/storage';

function createMemo(id: string, content: string, targetDate: string, completed = false): Memo {
  return {
    id,
    content,
    category: 'TODO',
    priority: id === 'critical' ? 'High' : 'Medium',
    tags: [],
    createdAt: Date.now(),
    targetDate,
    completed,
  };
}

describe('DailyQuestPanel', () => {
  it('summarizes today TODO quests without showing future schedule items', () => {
    const today = getLocalDateString();
    const memos = [
      createMemo('critical', 'Daily critical quest', today, true),
      createMemo('standard', 'Daily standard quest', today),
      createMemo('future', 'Future quest', getRelativeDateString(1)),
    ];

    render(<DailyQuestPanel memos={memos} onToggle={vi.fn()} />);

    expect(screen.getByText('Daily Quest')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText('1/2 Clear')).toBeInTheDocument();
    expect(screen.getByText('Daily critical quest')).toBeInTheDocument();
    expect(screen.getByText('Daily standard quest')).toBeInTheDocument();
    expect(screen.queryByText('Future quest')).not.toBeInTheDocument();
  });

  it('toggles a daily quest from the panel', () => {
    const onToggle = vi.fn();
    render(<DailyQuestPanel memos={[createMemo('standard', 'Daily standard quest', getLocalDateString())]} onToggle={onToggle} />);

    fireEvent.click(screen.getByRole('button', { name: /Daily standard quest/i }));

    expect(onToggle).toHaveBeenCalledWith('standard');
  });

  it('renders an empty daily quest state', () => {
    render(<DailyQuestPanel memos={[]} onToggle={vi.fn()} />);

    expect(screen.getByText('0%')).toBeInTheDocument();
    expect(screen.getByText('No daily quests assigned')).toBeInTheDocument();
  });
});
