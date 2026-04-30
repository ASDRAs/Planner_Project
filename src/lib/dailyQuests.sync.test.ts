import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LOCAL_DAILY_QUEST_STORAGE_KEY } from './constants';
import type { DailyQuest } from './dailyQuests';

const {
  fromMock,
  remoteQuests,
  selectOrderMock,
  upsertMock,
} = vi.hoisted(() => {
  const remoteQuests: { value: DailyQuest[] } = { value: [] };
  const upsertMock = vi.fn().mockResolvedValue({ error: null });
  const selectOrderMock = vi.fn().mockImplementation(() => Promise.resolve({
    data: remoteQuests.value,
    error: null,
  }));
  const selectEqMock = vi.fn().mockReturnValue({ order: selectOrderMock });
  const selectMock = vi.fn().mockReturnValue({ eq: selectEqMock });
  const fromMock = vi.fn().mockImplementation(() => ({
    select: selectMock,
    upsert: upsertMock,
  }));

  return {
    fromMock,
    remoteQuests,
    selectEqMock,
    selectMock,
    selectOrderMock,
    upsertMock,
  };
});

vi.mock('./supabase', () => ({
  supabase: {
    from: fromMock,
  },
}));

import { getDailyQuests, syncDailyQuests } from './dailyQuests';

function createQuest(overrides: Partial<DailyQuest>): DailyQuest {
  return {
    id: 'quest-1',
    title: 'Hydration',
    createdAt: 1000,
    updatedAt: 1000,
    order: 1,
    ...overrides,
  };
}

describe('daily quest sync', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    remoteQuests.value = [];
    upsertMock.mockResolvedValue({ error: null });
    selectOrderMock.mockImplementation(() => Promise.resolve({
      data: remoteQuests.value,
      error: null,
    }));
  });

  it('pushes a newer local daily quest to the daily_quests table', async () => {
    localStorage.setItem(LOCAL_DAILY_QUEST_STORAGE_KEY, JSON.stringify([
      createQuest({
        title: 'Local routine',
        updatedAt: 3000,
        syncStatus: 'pending',
      }),
    ]));
    remoteQuests.value = [
      createQuest({
        title: 'Remote routine',
        updatedAt: 2000,
        userId: 'user-1',
      }),
    ];

    const result = await syncDailyQuests('user-1');

    expect(result.ok).toBe(true);
    expect(result.pushed).toBe(1);
    expect(fromMock).toHaveBeenCalledWith('daily_quests');
    expect(upsertMock.mock.calls[0][0][0]).toMatchObject({
      id: 'quest-1',
      title: 'Local routine',
      updatedAt: 3000,
      userId: 'user-1',
    });
    expect(upsertMock.mock.calls[0][0][0].syncStatus).toBeUndefined();
    expect(getDailyQuests()[0]).toMatchObject({
      title: 'Local routine',
      syncStatus: 'synced',
    });
  });

  it('pulls a newer remote daily quest into local storage', async () => {
    localStorage.setItem(LOCAL_DAILY_QUEST_STORAGE_KEY, JSON.stringify([
      createQuest({
        title: 'Local routine',
        updatedAt: 2000,
        syncStatus: 'synced',
      }),
    ]));
    remoteQuests.value = [
      createQuest({
        title: 'Remote routine',
        updatedAt: 3000,
        userId: 'user-1',
      }),
    ];

    const result = await syncDailyQuests('user-1');

    expect(result.ok).toBe(true);
    expect(result.pulled).toBe(1);
    expect(upsertMock).not.toHaveBeenCalled();
    expect(getDailyQuests()[0]).toMatchObject({
      title: 'Remote routine',
      syncStatus: 'synced',
    });
  });

  it('pushes null when a newer local toggle clears the completed date', async () => {
    localStorage.setItem(LOCAL_DAILY_QUEST_STORAGE_KEY, JSON.stringify([
      createQuest({
        lastCompletedDate: undefined,
        updatedAt: 3000,
        syncStatus: 'pending',
      }),
    ]));
    remoteQuests.value = [
      createQuest({
        lastCompletedDate: '2026-04-30',
        updatedAt: 2000,
        userId: 'user-1',
      }),
    ];

    const result = await syncDailyQuests('user-1');

    expect(result.ok).toBe(true);
    expect(result.pushed).toBe(1);
    expect(upsertMock.mock.calls[0][0][0]).toMatchObject({
      id: 'quest-1',
      lastCompletedDate: null,
    });
  });
});
