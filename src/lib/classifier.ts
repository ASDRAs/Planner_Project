export type { Category, Priority, ClassificationResult } from './memo/types';
import { processMemo } from './memo/pipeline';

export async function classifyMemo(input: string) {
  return await processMemo(input);
}
