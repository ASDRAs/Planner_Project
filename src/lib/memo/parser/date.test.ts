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

  it('should parse dotted shorthand like "10.20."', () => {
    const result = parseDateExpressions('10.20. 게임개발자 포트폴리오 제출', context);
    expect(result.targetDates).toContain('2026-10-20');
    expect(result.cleanedText).toBe('게임개발자 포트폴리오 제출');
  });

  it('should not treat IP-like dotted numbers as dates', () => {
    const result = parseDateExpressions('ping 8.8.8.8 네트워크 테스트', context);
    expect(result.targetDates).toEqual(['2026-03-10']);
    expect(result.matchedPatterns).toHaveLength(0);
    expect(result.cleanedText).toBe('ping 8.8.8.8 네트워크 테스트');
  });

  it('should ignore invalid calendar dates', () => {
    const result = parseDateExpressions('2.31. 일정 확인', context);
    expect(result.targetDates).toEqual(['2026-03-10']);
    expect(result.matchedPatterns).toHaveLength(0);
    expect(result.cleanedText).toBe('2.31. 일정 확인');
  });

  it('should parse "6월 15"', () => {
    const result = parseDateExpressions('6월 15 학사일정상 1학기 종강', context);
    expect(result.targetDates).toContain('2026-06-15');
    expect(result.cleanedText).toBe('학사일정상 1학기 종강');
  });

  it('should handle multiple absolute dates', () => {
    const result = parseDateExpressions('4/17 제출, 6월 15 발표', context);
    expect(result.targetDates).toContain('2026-04-17');
    expect(result.targetDates).toContain('2026-06-15');
    expect(result.cleanedText).toBe('제출, 발표');
  });

  it('should handle multiple dates', () => {
    const result = parseDateExpressions('내일 그리고 모레 운동하기', context);
    expect(result.targetDates).toContain('2026-03-11');
    expect(result.targetDates).toContain('2026-03-12');
    expect(result.cleanedText).toBe('그리고 운동하기');
  });
});
