import { ClassificationResult, ParseContext } from './types';
import { parseFolder } from './parser/folder';
import { parseDateExpressions } from './parser/date';
import { classifyByRules } from './classify/rules';
import { classifyWithLLM } from './classify/llm';
import { getLocalDateString } from '../dateUtils';

export async function processMemo(rawInput: string): Promise<ClassificationResult> {
  const now = new Date();
  const today = getLocalDateString();
  const dayOfWeek = new Intl.DateTimeFormat('ko-KR', { weekday: 'long' }).format(now);
  const context: ParseContext = { today, now };

  // 1. Parse Folder
  const folderResult = parseFolder(rawInput);
  const { folder, content: afterFolder } = folderResult;

  // 2. Parse Date
  const dateResult = parseDateExpressions(afterFolder, context);
  const targetDates = dateResult.targetDates;
  const cleanContent = dateResult.cleanedText;

  // 3. Rule-based Classification
  const hasDate = dateResult.matchedPatterns.length > 0;
  const ruleResult = classifyByRules(cleanContent, hasDate);
  const { category: ruleCategory, confidence, reasons } = ruleResult;

  // Derive Priority
  let priority: 'High' | 'Medium' | 'Low' = 'Medium';
  if (ruleCategory === 'TODO' && /중요|긴급|필수|마감|시험|수업|코드스케치/.test(cleanContent)) {
    priority = 'High';
  } else if (rawInput.includes('코드스케치') || /\d{4}\s*[~\-]\s*\d{4}/.test(rawInput)) {
    priority = 'High';
  }

  // Derive Tags (simplistic approach for rule-based)
  const tags: string[] = [];
  if (rawInput.includes('코드스케치') || /\d{4}\s*[~\-]\s*\d{4}/.test(rawInput)) {
    tags.push('수업');
  }

  const baseResult: ClassificationResult = {
    category: ruleCategory || 'THOUGHT',
    priority,
    tags,
    targetDates,
    cleanContent,
    folder,
    rawInput,
    confidence,
    reasons
  };

  // 4. LLM Fallback
  if (confidence < 0.75) {
    try {
      const llmResult = await classifyWithLLM(afterFolder, today, dayOfWeek, { forcedCategory: folder, forcedFolder: folder });
      
      return {
        ...baseResult,
        category: llmResult.category || baseResult.category,
        priority: llmResult.priority || baseResult.priority,
        tags: Array.from(new Set([...baseResult.tags, ...llmResult.tags])),
        folder: llmResult.folder || baseResult.folder,
        subTasks: llmResult.subTasks,
        cleanContent: llmResult.cleanContent || baseResult.cleanContent,
        confidence: 0.8, // Assumed higher confidence after LLM
        reasons: ['LLM fallback used']
      };
    } catch (e) {
      console.warn("LLM fallback failed, using rule-based results", e);
    }
  }

  return baseResult;
}
