export type Category = 'STUDY' | 'GAME_DESIGN' | 'VAULT' | 'THOUGHT' | 'TODO';
export type Priority = 'High' | 'Medium' | 'Low';
import { getLocalDateString, getRelativeDateString } from './dateUtils';

export interface ClassificationResult {
  category: Category;
  priority: Priority;
  tags: string[];
  targetDates: string[];
  cleanContent: string;
  folder?: string;
  subTasks?: string[];
  rawInput: string;
}

const CATEGORY_KEYWORDS: Record<string, Category> = {
  'study': 'STUDY', '공부': 'STUDY', '학습': 'STUDY', '과목': 'STUDY', '수업': 'STUDY', '특강': 'STUDY', '강연': 'STUDY',
  'design': 'GAME_DESIGN', '게임': 'GAME_DESIGN', '기획': 'GAME_DESIGN',
  'vault': 'VAULT', '비밀번호': 'VAULT', '계좌': 'VAULT', '보험': 'VAULT', '계약': 'VAULT', '주소': 'VAULT', '기록': 'VAULT', '보관': 'VAULT',
  'thought': 'THOUGHT', '생각': 'THOUGHT', '낙서': 'THOUGHT', '아이디어': 'THOUGHT', '이력서': 'THOUGHT',
  'todo': 'TODO', '할일': 'TODO'
};

function extractCategoryAndFolder(input: string): { category?: Category, folder?: string, cleanContent: string } {
  if (!input.includes('/')) return { cleanContent: input };
  const structuralMatch = input.match(/^([^/]{1,30})\s*\/\s*(.*)$/);
  if (!structuralMatch) return { cleanContent: input };

  const header = structuralMatch[1].trim();
  let content = structuralMatch[2].trim();
  if (/^[a-zA-Z]:$|^\/usr|^\/etc|^\/home|^\./.test(header)) return { cleanContent: input };

  let category: Category | undefined;
  let folder: string | undefined;
  let foundCat: Category | undefined;
  let remainingHeader = header;

  for (const [kw, cat] of Object.entries(CATEGORY_KEYWORDS)) {
    const regex = new RegExp(`^(${kw}|${cat.toLowerCase()})(에|의|용| 관련)?\\s*`, 'i');
    const match = header.match(regex);
    if (match) {
      foundCat = cat;
      remainingHeader = header.replace(regex, '').trim();
      break;
    }
  }

  if (foundCat) {
    category = foundCat;
    folder = remainingHeader || undefined;
  } else {
    folder = header;
  }

  const subMatch = content.match(/^([^/]{1,20})\s*\/\s*(.*)$/);
  if (subMatch && category) {
    folder = subMatch[1].trim();
    content = subMatch[2].trim();
  }

  return { category, folder, cleanContent: content };
}

function extractDateStrict(input: string): string | null {
  const now = new Date();
  const year = now.getFullYear();
  
  // 1. 상대 날짜 처리
  if (input.includes("오늘")) return getLocalDateString();
  if (input.includes("내일")) {
    return getRelativeDateString(1);
  }
  if (input.includes("내일모레")) {
    return getRelativeDateString(2);
  }

  // 2. 고정 날짜 처리
  const dotPattern = /(?:\s|^)(\d{1,2})\.(\d{1,2})(?:\s|$)/;
  const dotMatch = input.match(dotPattern);
  if (dotMatch) {
    const m = parseInt(dotMatch[1]);
    const d = parseInt(dotMatch[2]);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${year}-${dotMatch[1].padStart(2, '0')}-${dotMatch[2].padStart(2, '0')}`;
    }
  }
  const korPattern = /(\d{1,2})월\s*(\d{1,2})일/;
  const korMatch = input.match(korPattern);
  if (korMatch) return `${year}-${korMatch[1].padStart(2, '0')}-${korMatch[2].padStart(2, '0')}`;
  return null;
}

export async function classifyMemo(input: string): Promise<ClassificationResult> {
  const now = new Date();
  const today = getLocalDateString();
  const dayOfWeek = new Intl.DateTimeFormat('ko-KR', { weekday: 'long' }).format(now);
  const forcedDate = extractDateStrict(input);

  const { category: forcedCategory, folder: forcedFolder, cleanContent: structuralClean } = extractCategoryAndFolder(input);

  try {
    const response = await fetch('/api/classify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: structuralClean, today, dayOfWeek, context: { forcedCategory, forcedFolder } })
    });

    if (!response.ok) throw new Error('Server Error');
    const parsed = await response.json();

    let targetDates = parsed.targetDates || [today];
    if (forcedDate) targetDates = [forcedDate];

    const finalCategory = forcedCategory || parsed.category || 'THOUGHT';
    const finalFolder = forcedFolder || parsed.folder;
    
    // 1단계 정제: AI 결과물 사용
    let cleanContent = parsed.cleanContent || structuralClean;

    // 2단계 정제: 강제 날짜 제거 (3.14, 03.14, 3월 14일 등) 및 텍스트 날짜 지시자 제거
    const dateIndicators = /(?:\s|^)(오늘|내일|내일모레|어제|그저께|주말|이번주|다음주)(?:\s|$)/g;
    cleanContent = cleanContent.replace(dateIndicators, ' ').replace(/(?:\s|^)(\d{1,2})\.(\d{1,2})(?:\s|$)|(\d{1,2})월\s*(\d{1,2})일/g, ' ').trim();
    
    // 3단계 정제: 남은 쓰레기 문자 제거
    cleanContent = cleanContent.replace(/^[:\-\s/]+|[:\-\s/]+$/g, '').trim();

    const tags = parsed.tags || [];
    let priority = parsed.priority || 'Medium';

    // 중요도 강제 조정 로직
    if (input.includes('코드스케치') || /\d{4}\s*[~\-]\s*\d{4}/.test(input)) {
      if (!tags.includes('수업')) tags.push('수업');
      priority = 'High';
    }

    // TODO인데 중요한 키워드가 없으면 Medium으로 하향 (AI가 식재료 사기 같은걸 High로 줄 때 방어)
    if (finalCategory === 'TODO' && priority === 'High') {
      if (!/중요|긴급|필수|마감|시험|수업|코드스케치|발표|제출|회의|약속/.test(input)) {
        priority = 'Medium';
      }
    }

    return {
      category: finalCategory,
      priority,
      tags,
      targetDates,
      cleanContent: cleanContent,
      folder: finalFolder,
      subTasks: parsed.subTasks,
      rawInput: input
    };
  } catch {
    return fallbackClassification(input, today, forcedDate, forcedCategory, forcedFolder);
  }
}

function fallbackClassification(input: string, today: string, forcedDate: string | null, forcedCategory?: Category, forcedFolder?: string): ClassificationResult {
  const normalized = input.toLowerCase();
  let category: Category = forcedCategory || 'THOUGHT';
  const tags: string[] = [];
  
  if (!forcedCategory) {
    if (/사기|하기|가기|오기|제출|준비|내일|오늘|요일/.test(normalized) || forcedDate) category = 'TODO';
    else if (/공부|이론|정리|복습|학습|과목|교수/.test(normalized)) category = 'STUDY';
  }

  if (input.includes('코드스케치') || /\d{4}\s*[~\-]\s*\d{4}/.test(input)) tags.push('수업');

  const { folder: currentFolder, cleanContent: cleanObj } = extractCategoryAndFolder(input);
  let clean = cleanObj;
  
  // 강제 날짜 제거 및 텍스트 날짜 지시자 제거
  const dateIndicators = /(?:\s|^)(오늘|내일|내일모레|어제|그저께|주말|이번주|다음주)(?:\s|$)/g;
  clean = clean.replace(dateIndicators, ' ').replace(/(?:\s|^)(\d{1,2})\.(\d{1,2})(?:\s|$)|(\d{1,2})월\s*(\d{1,2})일/g, ' ').trim();
  clean = clean.replace(/^[:\-\s/]+|[:\-\s/]+$/g, '').trim();

  return {
    category,
    priority: (category === 'TODO' && /중요|긴급|필수|마감|시험|수업|코드스케치/.test(input)) ? 'High' : 'Medium',
    tags,
    targetDates: [forcedDate || today],
    cleanContent: clean,
    folder: forcedFolder || currentFolder,
    rawInput: input
  };
}
