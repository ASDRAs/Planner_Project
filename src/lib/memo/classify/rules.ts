import { Category } from '../types';

export interface RuleMatchResult {
  category: Category | null;
  priority: Priority;
  confidence: number;
  reasons: string[];
}

export function classifyByRules(input: string, hasDate: boolean): RuleMatchResult {
  const normalized = input.toLowerCase();
  let category: Category | null = null;
  let priority: Priority = 'Medium';
  let confidence = 0.0;
  const reasons: string[] = [];

  // TODO Signals
  const isTodo = hasDate || /사기|하기|가기|오기|제출|준비|내일|오늘|요일|종강|버리기|청소|해지|예약|장보기|정비|갱신|답장|전화|주문/.test(normalized);
  
  // STUDY Signals
  const isStudy = /공부|이론|정리|복습|학습|과목|교수|과제|시험|출석|특강|강연|연습문제|알고리즘|운영체제|네트워크|데이터베이스|컴파일러|자료구조|컴퓨터구조|stp|utp/.test(normalized);

  // GAME_DESIGN Signals
  const isGameDesign = /player behavior|game design|기획|성취형|레벨 상승|설계|게임|플레이어|재미|난이도|루프|보상|도전|메커닉|튜토리얼|achievers/.test(normalized);

  // VAULT Signals
  const isVault = /명령어|config|\.msc|\.cpl|비밀번호|계좌|보험|계약|주소|기록|보관|services\.msc|제어판|작업 관리자|레지스트리|ipconfig|netstat|ping|systeminfo|dxdiag|cmd|control|taskmgr|regedit/.test(normalized);

  // THOUGHT Signals
  const isThought = /철학|생각|가치관|의미|기도하다|신|낙서|아이디어|논리학|거증 책임|합리적|정체성|지식|지혜/.test(normalized);

  // Priority Logic
  if (/중요|긴급|필수|마감|시험|수업|코드스케치/.test(normalized)) {
    priority = 'High';
  }

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

  return { category, priority, confidence, reasons };
}
