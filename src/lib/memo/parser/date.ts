import { ParseContext, DateParseResult } from '../types';

export function parseDateExpressions(input: string, context: ParseContext): DateParseResult {
  const { today, now } = context;
  const year = now.getFullYear();
  let cleanedText = input;
  const targetDates: string[] = [];
  const matchedPatterns: string[] = [];

  // Helper to format date as YYYY-MM-DD
  const formatDate = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  // 1. Relative Dates (오늘, 내일, 모레)
  const relativePatterns: Record<string, number> = {
    '오늘': 0,
    '내일': 1,
    '모레': 2,
  };

  for (const [pattern, offset] of Object.entries(relativePatterns)) {
    const regex = new RegExp(`(?<=\\s|^)${pattern}(?=\\s|$)`, 'g');
    if (regex.test(cleanedText)) {
      const d = new Date(now);
      d.setDate(d.getDate() + offset);
      targetDates.push(formatDate(d));
      matchedPatterns.push(pattern);
      cleanedText = cleanedText.replace(regex, '').trim();
    }
  }

  // 2. Next week / This week weekdays (다음주 수요일, 이번주 금요일 등)
  const weekdays: Record<string, number> = {
    '일요일': 0, '월요일': 1, '화요일': 2, '수요일': 3, '목요일': 4, '금요일': 5, '토요일': 6,
    '일': 0, '월': 1, '화': 2, '수': 3, '목': 4, '금': 5, '토': 6
  };

  const weekRegex = /(이번주|다음주)\s*(월요일|화요일|수요일|목요일|금요일|토요일|일요일|월|화|수|목|금|토|일)/g;
  let match;
  while ((match = weekRegex.exec(cleanedText)) !== null) {
    const [full, weekPrefix, dayName] = match;
    const targetDay = weekdays[dayName];
    const currentDay = now.getDay();
    let offset = targetDay - currentDay;
    
    if (weekPrefix === '다음주') {
      offset += 7;
    }

    const d = new Date(now);
    d.setDate(d.getDate() + offset);
    targetDates.push(formatDate(d));
    matchedPatterns.push(full);
    cleanedText = cleanedText.replace(full, '').trim();
  }

  // 3. Absolute dates (MM/DD, M월 D일)
  // 6월 15일, 6월 15, 4/17
  const absRegex = /(?:\s|^)(\d{1,2})(월|\/)\s*(\d{1,2})(일)?(?:\s|$)/g;
  while ((match = absRegex.exec(cleanedText)) !== null) {
    const [full, mStr, sep, dStr] = match;
    const m = parseInt(mStr);
    const d = parseInt(dStr);

    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      const targetDate = `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      targetDates.push(targetDate);
      matchedPatterns.push(full.trim());
      cleanedText = cleanedText.replace(full.trim(), '').trim();
    }
  }

  // 4. ISO-ish dates (YYYY-MM-DD)
  const isoRegex = /(?:\s|^)(\d{4})-(\d{2})-(\d{2})(?:\s|$)/g;
  while ((match = isoRegex.exec(cleanedText)) !== null) {
    const [full, y, m, d] = match;
    targetDates.push(`${y}-${m}-${d}`);
    matchedPatterns.push(full.trim());
    cleanedText = cleanedText.replace(full.trim(), '').trim();
  }

  // Fallback to today if no date found
  if (targetDates.length === 0) {
    targetDates.push(today);
  }

  // Final cleanup of extra spaces
  cleanedText = cleanedText.replace(/\s+/g, ' ').trim();

  return {
    targetDates: Array.from(new Set(targetDates)), // deduplicate
    cleanedText,
    matchedPatterns
  };
}
