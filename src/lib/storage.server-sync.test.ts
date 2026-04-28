import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  insertMock,
  updateEqSecondMock,
  updateEqFirstMock,
  updateMock,
  deleteEqSecondMock,
  deleteEqFirstMock,
  deleteMock,
  fromMock,
} = vi.hoisted(() => {
  const insertMock = vi.fn().mockResolvedValue({ error: null });
  const updateEqSecondMock = vi.fn().mockResolvedValue({ error: null });
  const updateEqFirstMock = vi.fn().mockReturnValue({ eq: updateEqSecondMock });
  const updateMock = vi.fn().mockReturnValue({ eq: updateEqFirstMock });
  const deleteEqSecondMock = vi.fn().mockResolvedValue({ error: null });
  const deleteEqFirstMock = vi.fn().mockReturnValue({ eq: deleteEqSecondMock });
  const deleteMock = vi.fn().mockReturnValue({ eq: deleteEqFirstMock });
  const fromMock = vi.fn().mockImplementation(() => ({
    insert: insertMock,
    update: updateMock,
    delete: deleteMock,
  }));

  return {
    insertMock,
    updateEqSecondMock,
    updateEqFirstMock,
    updateMock,
    deleteEqSecondMock,
    deleteEqFirstMock,
    deleteMock,
    fromMock,
  };
});

vi.mock('./supabase', () => ({
  supabase: {
    from: fromMock,
  },
}));

import { deleteMemo, mergeMemos, saveMemo, updateMemo } from './storage';

describe('storage server sync calls', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();

    insertMock.mockResolvedValue({ error: null });
    updateEqSecondMock.mockResolvedValue({ error: null });
    deleteEqSecondMock.mockResolvedValue({ error: null });
  });

  it('calls server insert when saving a memo with userId', async () => {
    await saveMemo(
      {
        content: 'server-insert-check',
        category: 'TODO',
        priority: 'High',
        tags: [],
      },
      'user-1'
    );

    expect(fromMock).toHaveBeenCalledWith('memos');
    expect(insertMock).toHaveBeenCalledTimes(1);
    expect(insertMock.mock.calls[0][0][0]).toMatchObject({
      content: 'server-insert-check',
      userId: 'user-1',
    });
  });

  it('calls server update when updating a memo with userId', async () => {
    await updateMemo('memo-1', { completed: true }, 'user-1');

    expect(fromMock).toHaveBeenCalledWith('memos');
    expect(updateMock).toHaveBeenCalledWith({ completed: true });
    expect(updateEqFirstMock).toHaveBeenCalledWith('id', 'memo-1');
    expect(updateEqSecondMock).toHaveBeenCalledWith('userId', 'user-1');
  });

  it('calls server delete when deleting a memo with userId', async () => {
    const memo = await saveMemo(
      {
        content: 'to-delete',
        category: 'THOUGHT',
        priority: 'Low',
        tags: [],
      },
      undefined
    );

    vi.clearAllMocks();
    await deleteMemo(memo.id, 'user-1');

    expect(fromMock).toHaveBeenCalledWith('memos');
    expect(deleteMock).toHaveBeenCalledTimes(1);
    expect(deleteEqFirstMock).toHaveBeenCalledWith('id', memo.id);
    expect(deleteEqSecondMock).toHaveBeenCalledWith('userId', 'user-1');
  });

  it('calls server insert/delete during merge with userId', async () => {
    const a = await saveMemo({ content: 'a', category: 'TODO', priority: 'Medium', tags: [] });
    const b = await saveMemo({ content: 'b', category: 'TODO', priority: 'Medium', tags: [] });
    const c = await saveMemo({ content: 'c', category: 'TODO', priority: 'Medium', tags: [] });

    vi.clearAllMocks();
    await mergeMemos([a.id, b.id, c.id], 'user-1');

    expect(insertMock).toHaveBeenCalledTimes(1);
    expect(deleteMock).toHaveBeenCalledTimes(3);
    expect(deleteEqSecondMock).toHaveBeenCalledWith('userId', 'user-1');
  });
});
