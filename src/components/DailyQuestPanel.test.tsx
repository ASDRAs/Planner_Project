import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import DailyQuestPanel from './DailyQuestPanel';
import { LOCAL_DAILY_QUEST_STORAGE_KEY, LOCAL_MEMO_STORAGE_KEY } from '@/lib/constants';
import { getLocalDateString, getRelativeDateString } from '@/lib/dateUtils';
import type { DailyQuest } from '@/lib/dailyQuests';

function seedDailyQuests(quests: DailyQuest[]): void {
  localStorage.setItem(LOCAL_DAILY_QUEST_STORAGE_KEY, JSON.stringify(quests));
}

describe('DailyQuestPanel', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts from separate daily quest storage instead of TODO memos', () => {
    seedDailyQuests([
      {
        id: 'daily-1',
        title: 'Hydration routine',
        createdAt: Date.now(),
        order: 1,
      },
    ]);

    render(<DailyQuestPanel />);

    expect(screen.getByText('Daily Quest')).toBeInTheDocument();
    expect(screen.getByText('Hydration routine')).toBeInTheDocument();
    expect(screen.getByText('0/1 Clear')).toBeInTheDocument();
  });

  it('does not read today TODO memos into daily quests', () => {
    localStorage.setItem(LOCAL_MEMO_STORAGE_KEY, JSON.stringify([
      {
        id: 'todo-1',
        content: 'Today TODO should stay in Quest Log',
        category: 'TODO',
        priority: 'Medium',
        tags: [],
        createdAt: Date.now(),
        targetDate: getLocalDateString(),
        completed: false,
      },
    ]));

    render(<DailyQuestPanel />);

    expect(screen.queryByText('Today TODO should stay in Quest Log')).not.toBeInTheDocument();
    expect(screen.getByText('No daily quests assigned')).toBeInTheDocument();
  });

  it('keeps the add form hidden until the add button is opened', () => {
    render(<DailyQuestPanel />);

    expect(screen.queryByLabelText('New daily quest')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Open daily quest add form' }));

    expect(screen.getByLabelText('New daily quest')).toBeInTheDocument();
  });

  it('adds and toggles a separate daily quest', () => {
    render(<DailyQuestPanel />);

    fireEvent.click(screen.getByRole('button', { name: 'Open daily quest add form' }));
    fireEvent.change(screen.getByLabelText('New daily quest'), { target: { value: 'Read design notes' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add daily quest' }));

    expect(screen.getByText('Read design notes')).toBeInTheDocument();
    expect(screen.queryByLabelText('New daily quest')).not.toBeInTheDocument();
    expect(screen.getByText('0/1 Clear')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Toggle Read design notes' }));

    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.getByText('1/1 Clear')).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(LOCAL_DAILY_QUEST_STORAGE_KEY) ?? '[]')[0].lastCompletedDate).toBe(getLocalDateString());
  });

  it('treats yesterday completion as open today', () => {
    seedDailyQuests([
      {
        id: 'daily-1',
        title: 'Stretching',
        createdAt: Date.now(),
        order: 1,
        lastCompletedDate: getRelativeDateString(-1),
      },
    ]);

    render(<DailyQuestPanel />);

    expect(screen.getByText('0%')).toBeInTheDocument();
    expect(screen.getByText('0/1 Clear')).toBeInTheDocument();
    expect(screen.getByText('Open')).toBeInTheDocument();
  });

  it('deletes a daily quest without touching memo storage', () => {
    seedDailyQuests([
      {
        id: 'daily-1',
        title: 'Stretching',
        createdAt: Date.now(),
        order: 1,
      },
    ]);

    render(<DailyQuestPanel />);

    fireEvent.click(screen.getByRole('button', { name: 'Delete Stretching' }));

    expect(screen.queryByText('Stretching')).not.toBeInTheDocument();
    expect(screen.getByText('No daily quests assigned')).toBeInTheDocument();
    expect(localStorage.getItem(LOCAL_DAILY_QUEST_STORAGE_KEY)).toBe('[]');
  });
});
