import { describe, it, expect } from 'vitest';
import { parseFolder } from './folder';

describe('parseFolder', () => {
  it('should extract folder and content', () => {
    const result = parseFolder('알고리즘 / 연습문제 풀기');
    expect(result.folder).toBe('알고리즘');
    expect(result.content).toBe('연습문제 풀기');
  });

  it('should handle missing folder gracefully', () => {
    const result = parseFolder('연습문제 풀기');
    expect(result.folder).toBeUndefined();
    expect(result.content).toBe('연습문제 풀기');
  });

  it('should handle multi-line content correctly', () => {
    const input = `회의록 / 첫 번째 안건
두 번째 안건`;
    const result = parseFolder(input);
    expect(result.folder).toBe('회의록');
    expect(result.content).toBe('첫 번째 안건\n두 번째 안건');
  });

  it('should ignore paths looking like system directories', () => {
    const result = parseFolder('C: / some path here');
    // It should probably just see this as content
    expect(result.folder).toBeUndefined();
    expect(result.content).toBe('C: / some path here');
  });
});
