import { Category } from '../types';

export interface RuleMatchResult {
  category: Category | null;
  confidence: number;
  reasons: string[];
}

export function classifyByRules(input: string, hasDate: boolean): RuleMatchResult {
  const normalized = input.toLowerCase();
  let category: Category | null = null;
  let confidence = 0.0;
  const reasons: string[] = [];

  // TODO Signals
  const isTodo = hasDate || /사기|하기|가기|오기|제출|준비|내일|오늘|요일|종강/.test(normalized);
  
  // STUDY Signals
  const isStudy = /공부|이론|정리|복습|학습|과목|교수|과제|시험|출석|특강|강연|연습문제|알고리즘/.test(normalized);

  // GAME_DESIGN Signals
  const isGameDesign = /player behavior|game design|기획|성취형|레벨 상승|설계|게임/.test(normalized);

  // VAULT Signals
  const isVault = /명령어|config|\.msc|\.cpl|비밀번호|계좌|보험|계약|주소|기록|보관|services\.msc/.test(normalized);

  // THOUGHT Signals
  const isThought = /철학|생각|가치관|의미|기도하다|신|낙서|아이디어/.test(normalized);

  // Scoring logic (simplified)
  if (isVault) {
    category = 'VAULT';
    confidence = 0.9;
    reasons.push('Matched VAULT keywords');
  } else if (isGameDesign) {
    category = 'GAME_DESIGN';
    confidence = 0.85;
    reasons.push('Matched GAME_DESIGN keywords');
  } else if (isStudy) {
    category = 'STUDY';
    confidence = 0.8;
    reasons.push('Matched STUDY keywords');
  } else if (isTodo) {
    category = 'TODO';
    confidence = hasDate ? 0.9 : 0.75;
    reasons.push(hasDate ? 'Date present' : 'Matched TODO action verbs');
  } else if (isThought) {
    category = 'THOUGHT';
    confidence = 0.8;
    reasons.push('Matched THOUGHT keywords');
  }

  // Very ambiguous case fallback handling logic inside LLM if confidence is low, 
  // but we can start it at THOUGHT if no category matched.
  if (!category) {
    category = 'THOUGHT';
    confidence = 0.5;
    reasons.push('No specific keywords matched, defaulting to THOUGHT');
  }

  return { category, confidence, reasons };
}
