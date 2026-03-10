import { describe, it, expect, vi } from 'vitest';
import { processMemo } from './pipeline';

// Spec: 파이프라인은 다음 5단계를 거쳐야 하며, 결과물은 결정론적(deterministic)이어야 함.
// 1. Folder 추출 (/)
// 2. Date 추출 (오늘/내일/MM.DD/MM월 DD일 등)
// 3. Text 정제 (Folder 및 Date 텍스트 제거)
// 4. Rule 기반 분류 (Confidence 계산)
// 5. LLM Fallback (Confidence < 0.75 시 호출)

describe('Pipeline Spec-First Validation', () => {
  it('[Spec 1] Folder와 Date가 공존할 때 둘 다 정확히 추출하고 텍스트를 정제해야 함', async () => {
    const raw = "알고리즘 / 내일 연습문제 풀기";
    const result = await processMemo(raw);
    
    expect(result.folder).toBe('알고리즘');
    expect(result.targetDates).toContainEqual(expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/));
    expect(result.cleanContent).toBe('연습문제 풀기');
  });

  it('[Spec 2] 다중 날짜(오늘, 내일)가 입력되면 중복 없이 모든 날짜를 추출해야 함', async () => {
    const raw = "오늘 그리고 내일 운동하기";
    const result = await processMemo(raw);
    
    expect(result.targetDates).toHaveLength(2);
    expect(result.cleanContent).toBe('그리고 운동하기');
  });

  it('[Spec 3] VAULT 관련 키워드(services.msc)는 규칙에 의해 높은 신뢰도로 분류되어야 함', async () => {
    const result = await processMemo("services.msc 설정 변경");
    
    expect(result.category).toBe('VAULT');
    expect(result.confidence).toBeGreaterThanOrEqual(0.75);
  });

  it('[Spec 4] "수업" 키워드나 시간 형식이 있으면 Priority가 High로 자동 조정되어야 함', async () => {
    const result = await processMemo("공부 / 1300-1500 운영체제 수업");
    
    expect(result.tags).toContain('수업');
    expect(result.priority).toBe('High');
  });

  it('[Spec 5] 불필요한 공백이나 특수문자(: -)가 시작/끝에 남지 않아야 함', async () => {
    const result = await processMemo("TODO / : 내일 청소하기 - ");
    
    expect(result.cleanContent).toBe('청소하기');
  });
});
