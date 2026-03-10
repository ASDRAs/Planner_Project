import { describe, it, expect } from 'vitest';
import { parseDateExpressions } from './date';
import { ParseContext } from '../types';

describe('parseDateExpressions', () => {
  const mockNow = new Date('2026-03-10'); // Tuesday
  const context: ParseContext = {
    today: '2026-03-10',
    now: mockNow
  };

  it('should parse "오늘"', () => {
    const result = parseDateExpressions('오늘 세탁기 돌리기', context);
    expect(result.targetDates).toContain('2026-03-10');
    expect(result.cleanedText).toBe('세탁기 돌리기');
  });

  it('should parse "내일"', () => {
    const result = parseDateExpressions('내일 세탁기 돌리기', context);
    expect(result.targetDates).toContain('2026-03-11');
    expect(result.cleanedText).toBe('세탁기 돌리기');
  });

  it('should parse "다음주 수요일"', () => {
    const result = parseDateExpressions('다음주 수요일 청소하기', context);
    // 2026-03-10 is Tuesday. Next Wednesday is 2026-03-18.
    expect(result.targetDates).toContain('2026-03-18');
    expect(result.cleanedText).toBe('청소하기');
  });

  it('should parse "4/17"', () => {
    const result = parseDateExpressions('4/17 쿠팡와우 해지하기', context);
    expect(result.targetDates).toContain('2026-04-17');
    expect(result.cleanedText).toBe('쿠팡와우 해지하기');
  });

  it('should parse "6월 15"', () => {
    const result = parseDateExpressions('6월 15 학사일정상 1학기 종강', context);
    expect(result.targetDates).toContain('2026-06-15');
    expect(result.cleanedText).toBe('학사일정상 1학기 종강');
  });

  it('should handle multiple dates', () => {
    const result = parseDateExpressions('내일 그리고 모레 운동하기', context);
    expect(result.targetDates).toContain('2026-03-11');
    expect(result.targetDates).toContain('2026-03-12');
    expect(result.cleanedText).toBe('그리고 운동하기');
  });
});
