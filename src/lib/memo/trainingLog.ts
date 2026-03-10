import { supabase } from '../supabase';
import { ClassificationResult } from './types';
import { Memo } from '../storage';

export interface TrainingLogEntry {
  rawInput: string;
  predictedCategory: string;
  predictedFolder?: string;
  predictedTags: string[];
  predictedTargetDate: string[];
  predictedConfidence?: number;

  finalCategory: string;
  finalFolder?: string;
  finalTags: string[];
  finalTargetDate: string;

  userId?: string;
  diffFlags: {
    categoryChanged: boolean;
    folderChanged: boolean;
    dateChanged: boolean;
  };
}

export async function saveTrainingLog(predicted: ClassificationResult, finalMemo: Memo, userId?: string): Promise<void> {
  if (typeof window === 'undefined') return;

  const diffFlags = {
    categoryChanged: predicted.category !== finalMemo.category,
    folderChanged: predicted.folder !== finalMemo.folder,
    dateChanged: !(predicted.targetDates || []).includes(finalMemo.targetDate),
  };

  const logEntry: TrainingLogEntry = {
    rawInput: predicted.rawInput,
    predictedCategory: predicted.category,
    predictedFolder: predicted.folder,
    predictedTags: predicted.tags || [],
    predictedTargetDate: predicted.targetDates || [],
    predictedConfidence: predicted.confidence,
    finalCategory: finalMemo.category,
    finalFolder: finalMemo.folder,
    finalTags: finalMemo.tags || [],
    finalTargetDate: finalMemo.targetDate,
    userId,
    diffFlags
  };

  try {
    // Fire and forget
    // Assuming a 'training_logs' table exists in Supabase
    supabase.from('training_logs').insert([logEntry]).then(({ error }) => {
      if (error) {
        console.warn("[TrainingLog] Server log insertion failed:", error.message);
      }
    });
  } catch (e) {
    console.warn("Failed to save training log", e);
  }
}
