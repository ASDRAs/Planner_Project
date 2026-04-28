import type { Category } from './classifier';

export const LOCAL_MEMO_STORAGE_KEY = 'daily-planner-memos';
export const LOCAL_DELETED_MEMO_STORAGE_KEY = 'daily-planner-deleted-ids';
export const LOCAL_DAILY_QUEST_STORAGE_KEY = 'daily-planner-daily-quests';

export const CATEGORY_VALUES: Category[] = ['STUDY', 'GAME_DESIGN', 'VAULT', 'THOUGHT', 'TODO'];
export const CATEGORY_FILTER_VALUES: Array<Category | 'All'> = [
  'STUDY',
  'GAME_DESIGN',
  'VAULT',
  'THOUGHT',
  'All',
];
export const CATEGORY_VALUES_TODO_FIRST: Category[] = [
  'TODO',
  'STUDY',
  'GAME_DESIGN',
  'VAULT',
  'THOUGHT',
];
