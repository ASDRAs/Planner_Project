export type Category = 'STUDY' | 'GAME_DESIGN' | 'VAULT' | 'THOUGHT' | 'TODO';
export type Priority = 'High' | 'Medium' | 'Low';

export interface ParseContext {
  today: string; // YYYY-MM-DD
  now: Date;
}

export interface DateParseResult {
  targetDates: string[];
  cleanedText: string;
  matchedPatterns: string[];
}

export interface ClassificationResult {
  category: Category;
  priority: Priority;
  tags: string[];
  targetDates: string[];
  cleanContent: string;
  folder?: string;
  subTasks?: string[];
  rawInput: string;
  confidence?: number;
  reasons?: string[];
}
