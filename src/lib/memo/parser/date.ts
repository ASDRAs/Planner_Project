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

  const addMonthDay = (monthText: string, dayText: string, matchedText: string) => {
    const month = Number.parseInt(monthText, 10);
    const day = Number.parseInt(dayText, 10);
    if (!Number.isInteger(month) || !Number.isInteger(day)) return false;

    const candidate = new Date(year, month - 1, day);
    const isValid =
      candidate.getFullYear() === year &&
      candidate.getMonth() === month - 1 &&
      candidate.getDate() === day;

    if (!isValid) return false;

    targetDates.push(formatDate(candidate));
    matchedPatterns.push(matchedText.trim());
    return true;
  };

  const removeMatchedDate = (
    fullMatch: string,
    prefix: string,
    monthText: string,
    dayText: string
  ) => {
    const matchedText = fullMatch.slice(prefix.length);
    return addMonthDay(monthText, dayText, matchedText) ? prefix : fullMatch;
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

  // 3. Absolute dates (MM/DD, M월 D일, M.D.)
  // 6월 15일, 6월 15, 4/17, 10.20.
  const absRegex = /(^|[\s([{:,])(\d{1,2})\s*(월|\/)\s*(\d{1,2})(?:\s*일)?(?=$|[\s)\]}.,:!?])/g;
  cleanedText = cleanedText.replace(absRegex, (full, prefix, monthText, _separator, dayText) =>
    removeMatchedDate(full, prefix, monthText, dayText)
  );

  // Dot shorthand requires a trailing dot so IPs/versions like 8.8.8.8 or v1.2.3 are not treated as dates.
  const dottedAbsRegex = /(^|[\s([{:,])(\d{1,2})\s*\.\s*(\d{1,2})\.(?=$|[^\d.])/g;
  cleanedText = cleanedText.replace(dottedAbsRegex, (full, prefix, monthText, dayText) =>
    removeMatchedDate(full, prefix, monthText, dayText)
  );

  // 4. ISO-ish dates (YYYY-MM-DD)
  const isoRegex = /(^|[\s([{:,])(\d{4})-(\d{2})-(\d{2})(?=$|[\s)\]}.,:!?])/g;
  cleanedText = cleanedText.replace(isoRegex, (full, prefix, y, m, d) => {
    const yearNumber = Number.parseInt(y, 10);
    const monthNumber = Number.parseInt(m, 10);
    const dayNumber = Number.parseInt(d, 10);
    const candidate = new Date(yearNumber, monthNumber - 1, dayNumber);
    const isValid =
      candidate.getFullYear() === yearNumber &&
      candidate.getMonth() === monthNumber - 1 &&
      candidate.getDate() === dayNumber;

    if (!isValid) return full;

    targetDates.push(`${y}-${m}-${d}`);
    matchedPatterns.push(full.slice(prefix.length).trim());
    return prefix;
  });

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
