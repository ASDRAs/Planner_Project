import { describe, it, expect } from 'vitest';
import { classifyMemo } from './classifier';

describe('classifyMemo - Real World Data Patterns', () => {
  it('네트워크 기술 노트를 STUDY 카테고리로 분류해야 함', async () => {
    const input = "STP : 2중 차폐처리를 통해 외부 간섭을 줄임";
    const result = await classifyMemo(input);
    expect(result.category).toBe('STUDY');
    expect(result.tags).toContain('네트워크');
  });

  it('게임 시스템 설계를 GAME_DESIGN 카테고리로 분류해야 함', async () => {
    const input = "성취형(achievers): 점수 획득과 레벨 상승을 주요 목표로 함";
    const result = await classifyMemo(input);
    expect(result.category).toBe('GAME_DESIGN');
  });

  it('강연 및 특강 준비를 STUDY 카테고리로 분류해야 함', async () => {
    const input = "아마존 특강: 임팩트 중심(숫자로 표현)의 이력서 작성법";
    const result = await classifyMemo(input);
    expect(result.category).toBe('STUDY');
  });

  it('중요 정보 기록을 VAULT 카테고리로 분류해야 함', async () => {
    const input = "우리집 현관 비밀번호: 1234* (기억 필수)";
    const result = await classifyMemo(input);
    expect(result.category).toBe('VAULT');
  });

  it('개인적 성찰을 THOUGHT 카테고리로 분류해야 함', async () => {
    const input = "생각을 언어로 정리하는 것: 구조화에 최적인 수단";
    const result = await classifyMemo(input);
    expect(result.category).toBe('THOUGHT');
  });

  it('실행이 필요한 일정을 TODO 카테고리로 분류해야 함', async () => {
    const input = "중간고사5 기말고사4 출석1 - 과제는 1주 안에 이메일 제출";
    const result = await classifyMemo(input);
    expect(result.category).toBe('TODO');
    expect(result.priority).toBe('High');
  });

  it('날짜 지시자(내일, 오늘 등)를 cleanContent에서 제거해야 함', async () => {
    const input = "내일 수학 개념 이해하기";
    const result = await classifyMemo(input);
    // 현재는 "내일 수학 개념 이해하기"가 그대로 나올 것이므로 이 테스트는 실패할 것입니다.
    expect(result.cleanContent).toBe("수학 개념 이해하기");
    expect(result.category).toBe('TODO');
  });

  it('"내일" 키워드가 있을 때 내일 날짜를 targetDates에 포함해야 함', async () => {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    const expectedDate = tomorrow.toISOString().split('T')[0];

    const input = "내일 과제하기";
    const result = await classifyMemo(input);
    
    expect(result.targetDates).toContain(expectedDate);
    expect(result.cleanContent).toBe("과제하기");
  });
});
