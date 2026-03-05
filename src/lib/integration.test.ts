import { describe, it, expect } from 'vitest';
import { classifyMemo } from './classifier';

describe('classifyMemo - Real-world Data Integration Test', () => {
  it('STP/UTP 관련 메모를 STUDY로 분류하고 네트워크 태그를 달아야 함', async () => {
    const input = "STP: 2중 차폐처리를 통해 외부 간섭을 줄임, UTP: 보통의 통신용 케이블";
    const result = await classifyMemo(input);
    expect(result.category).toBe('STUDY');
    expect(result.tags).toContain('네트워크');
  });

  it('바틀의 플레이어 유형 설계를 GAME_DESIGN으로 분류하고 관련 태그를 달아야 함', async () => {
    const input = "성취형(achievers)은 점수 획득과 레벨 상승을 주요 목표로 함. 다이아몬드 상징.";
    const result = await classifyMemo(input);
    expect(result.category).toBe('GAME_DESIGN');
    expect(result.tags).toContain('게임기획');
    expect(result.tags).toContain('플레이어유형');
  });

  it('아마존 특강 및 이력서 작성법을 STUDY로 분류하고 커리어 태그를 달아야 함', async () => {
    const input = "아마존 특강: 임팩트 중심(숫자로 표현)의 이력서 작성법, output이 아닌 outcome 강조";
    const result = await classifyMemo(input);
    expect(result.category).toBe('STUDY');
  });

  it('중간고사/기말고사/과제 일정을 TODO로 분류하고 High Priority를 부여해야 함', async () => {
    const input = "중간고사5 기말고사4 출석1 - 과제는 1주 안에 이메일 제출할 것";
    const result = await classifyMemo(input);
    expect(result.category).toBe('TODO');
    expect(result.priority).toBe('High');
  });

  it('비밀번호나 보험 기록을 VAULT로 분류해야 함', async () => {
    const input = "현관 비밀번호: 1234, 보험 증권 번호: 2024-XXXX-XXXX";
    const result = await classifyMemo(input);
    expect(result.category).toBe('VAULT');
  });

  it('AI 개발 및 개발 방법론 관련 메모를 올바르게 분류하고 태그를 달아야 함', async () => {
    const input = "AI 시대에는 TDD(Red-Green-Refactor)와 Spec-First 전략이 더욱 중요해진다.";
    const result = await classifyMemo(input);
    expect(['STUDY', 'THOUGHT']).toContain(result.category);
    expect(result.tags).toContain('AI');
    expect(result.tags).toContain('개발방법론');
  });
});
