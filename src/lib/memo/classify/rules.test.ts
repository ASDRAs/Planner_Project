import { describe, it, expect } from 'vitest';
import { classifyByRules } from './rules';

describe('classifyByRules', () => {
  it('should classify VAULT with high confidence', () => {
    const result = classifyByRules('services.msc 서비스 강종', false);
    expect(result.category).toBe('VAULT');
    expect(result.confidence).toBeGreaterThanOrEqual(0.75);
  });

  it('should classify STUDY based on keywords', () => {
    const result = classifyByRules('알고리즘 연습문제 풀기', false);
    expect(result.category).toBe('STUDY');
    
    const result2 = classifyByRules('내일 알고리즘 과제 제출', false);
    expect(result2.category).toBe('TODO');
  });

  it('should classify TODO if a date is present and no stronger match', () => {
    const result = classifyByRules('세탁기 돌리기', true);
    expect(result.category).toBe('TODO');
    expect(result.confidence).toBe(0.9);
  });

  it('should classify GAME_DESIGN', () => {
    const result = classifyByRules('player behavior 분석', false);
    expect(result.category).toBe('GAME_DESIGN');
  });

  it('should not classify broad game developer wording as GAME_DESIGN by itself', () => {
    const result = classifyByRules('게임개발자', false);
    expect(result.category).toBe('THOUGHT');
    expect(result.confidence).toBeLessThan(0.75);
  });

  it('should let study signals override broad game developer wording', () => {
    const result = classifyByRules('게임개발자 공부', false);
    expect(result.category).toBe('STUDY');
  });

  it('should let todo signals override broad game developer wording', () => {
    const result = classifyByRules('게임개발자 포트폴리오 제출', true);
    expect(result.category).toBe('TODO');
  });

  it('should still classify explicit game design phrases as GAME_DESIGN', () => {
    const result = classifyByRules('게임 기획에서 보상 루프 설계', false);
    expect(result.category).toBe('GAME_DESIGN');
  });

  it('should classify THOUGHT', () => {
    const result = classifyByRules('만들어진 신 / 기도하다', false);
    expect(result.category).toBe('THOUGHT');
  });

  it('should return low confidence if ambiguous', () => {
    const result = classifyByRules('알 수 없는 모호한 텍스트', false);
    expect(result.confidence).toBeLessThan(0.75);
  });
});
