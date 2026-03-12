import { Category, Priority, ClassificationResult } from './memo/types';
import { processMemo } from './memo/pipeline';

export type { Category, Priority, ClassificationResult };

export async function classifyMemo(input: string, existingFolders?: Record<string, Category>) {
  return await processMemo(input, existingFolders);
}
