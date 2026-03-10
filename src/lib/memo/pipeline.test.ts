import { describe, it, expect } from 'vitest';
import { processMemo } from './pipeline';

describe('Memo Pipeline Integration', () => {
  it('should classify "만들어진 신 / 기도하다" as THOUGHT', async () => {
    const result = await processMemo('만들어진 신 / 기도하다');
    expect(result.category).toBe('THOUGHT');
    expect(result.folder).toBe('만들어진 신');
    expect(result.cleanContent).toBe('기도하다');
  });

  it('should classify "6월 15 학사일정상 종강" as TODO', async () => {
    const result = await processMemo('6월 15 학사일정상 종강');
    expect(result.category).toBe('TODO'); // LLM fallback or rule based on '종강' if LLM is skipped. Wait, the prompt says TODO. If LLM is called, it might return TODO. If rule, maybe not TODO unless date is present. 6월 15 is a date!
    expect(result.targetDates).toContainEqual(expect.stringContaining('-06-15'));
  });

  it('should classify "알고리즘 / 연습문제" as STUDY', async () => {
    const result = await processMemo('알고리즘 / 연습문제');
    expect(result.category).toBe('STUDY');
    expect(result.folder).toBe('알고리즘');
  });

  it('should classify "services.msc 서비스 강종" as VAULT', async () => {
    const result = await processMemo('services.msc 서비스 강종');
    expect(result.category).toBe('VAULT');
  });

  it('should classify "내일 세탁기 돌리기" as TODO', async () => {
    const result = await processMemo('내일 세탁기 돌리기');
    expect(result.category).toBe('TODO');
    expect(result.cleanContent).toBe('세탁기 돌리기');
  });
});
