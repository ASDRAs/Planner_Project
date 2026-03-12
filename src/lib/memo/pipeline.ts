import { ClassificationResult, ParseContext } from './types';
import { parseFolder } from './parser/folder';
import { parseDateExpressions } from './parser/date';
import { classifyByRules } from './classify/rules';
import { classifyWithLLM } from './classify/llm';
import { getLocalDateString } from '../dateUtils';

export async function processMemo(rawInput: string, existingFolders?: Record<string, Category>): Promise<ClassificationResult> {
  const normalizedInput = rawInput.toLowerCase();
  const now = new Date();
  const today = getLocalDateString();
  const dayOfWeek = new Intl.DateTimeFormat('ko-KR', { weekday: 'long' }).format(now);
  const context: ParseContext = { today, now, existingFolders };

  // 1. Parse Folder
  const folderResult = parseFolder(rawInput);
  const { folder, content: afterFolder } = folderResult;

  // 2. Parse Date
  const dateResult = parseDateExpressions(afterFolder, context);
  const targetDates = dateResult.targetDates;
  // Final cleanup for cleanContent: remove leading/trailing special chars and spaces
  const cleanContent = dateResult.cleanedText
    .replace(/^[:\-\s/]+|[:\-\s/]+$/g, '')
    .trim();

  // 3. Rule-based Classification
  const hasDate = dateResult.matchedPatterns.length > 0;
  const ruleResult = classifyByRules(cleanContent, hasDate, folder, existingFolders);
  const { category: ruleCategory, priority: rulePriority, confidence, reasons, stickyFolderContext } = ruleResult;

  // Derive Tags
  const tags: string[] = [];
  if (rawInput.includes('코드스케치') || /\d{4}\s*[~\-]\s*\d{4}/.test(rawInput) || rawInput.includes('수업')) {
    tags.push('수업');
  }
  if (normalizedInput.includes('네트워크') || normalizedInput.includes('stp') || normalizedInput.includes('utp')) {
    tags.push('네트워크');
  }
  if (normalizedInput.includes('ai') || normalizedInput.includes('인공지능')) {
    tags.push('AI');
  }
  if (normalizedInput.includes('개발') || normalizedInput.includes('구현') || normalizedInput.includes('tdd') || normalizedInput.includes('spec-first')) {
    tags.push('개발방법론');
  }
  if (normalizedInput.includes('기획') || normalizedInput.includes('플레이어') || normalizedInput.includes('achievers')) {
    tags.push('게임기획');
  }
  if (normalizedInput.includes('유형') || /성취형|탐험형|사교형|살해형/.test(normalizedInput)) {
    tags.push('플레이어유형');
  }

  const baseResult: ClassificationResult = {
    category: ruleCategory || 'THOUGHT',
    priority: rulePriority,
    tags,
    targetDates,
    cleanContent,
    folder,
    rawInput,
    confidence,
    reasons,
    stickyFolderContext
  };

  // 4. LLM Fallback - only if not forced by sticky folder
  if (confidence < 0.75 && !stickyFolderContext) {
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
