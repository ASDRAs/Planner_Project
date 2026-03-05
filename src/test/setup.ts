import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mocking Transformers.js pipeline
vi.mock('@xenova/transformers', () => ({
  pipeline: vi.fn().mockResolvedValue(
    async (input: string) => {
      const normalizedInput = input.toLowerCase();
      let bestLabel = 'THOUGHT';
      
      // Simple logic for mock to satisfy tests
      if (normalizedInput.includes('stp') || normalizedInput.includes('네트워크') || normalizedInput.includes('특강')) bestLabel = 'STUDY';
      else if (normalizedInput.includes('achievers') || normalizedInput.includes('전투 공식')) bestLabel = 'GAME_DESIGN';
      else if (normalizedInput.includes('비밀번호') || normalizedInput.includes('보험')) bestLabel = 'VAULT';
      else if (normalizedInput.includes('고사') || normalizedInput.includes('과제')) bestLabel = 'TODO';
      
      return {
        labels: [bestLabel],
        scores: [0.99]
      };
    }
  )
}));