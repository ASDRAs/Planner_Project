import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import MemoInput from './MemoInput';
import * as classifier from '@/lib/classifier';

// Mock the classifier module
vi.mock('@/lib/classifier', () => ({
  classifyMemo: vi.fn().mockResolvedValue({
    category: 'STUDY',
    priority: 'Medium',
    tags: ['네트워크']
  })
}));

describe('MemoInput Component', () => {
  it('사용자가 텍스트를 입력하면 STUDY 뱃지가 나타나야 함', async () => {
    render(<MemoInput />);
    
    const textarea = screen.getByPlaceholderText(/자유롭게 메모를 입력하세요/i);
    fireEvent.change(textarea, { target: { value: 'STP : 네트워크 간섭 방지' } });
    
    // Wait for the classifier to be called and UI to update
    await waitFor(() => {
      expect(screen.getByText('STUDY')).toBeInTheDocument();
    });
    
    expect(screen.getByText('#네트워크')).toBeInTheDocument();
  });

  it('우선순위가 High인 경우 특별한 표시가 있어야 함', async () => {
    (classifier.classifyMemo as any).mockResolvedValueOnce({
      category: 'TODO',
      priority: 'High',
      tags: []
    });

    render(<MemoInput />);
    
    const textarea = screen.getByPlaceholderText(/자유롭게 메모를 입력하세요/i);
    fireEvent.change(textarea, { target: { value: '내일 시험 공부하기' } });

    await waitFor(() => {
      expect(screen.getByText('High Priority')).toBeInTheDocument();
    });
  });

  it('저장 버튼을 클릭하면 입력 필드가 초기화되어야 함', async () => {
    const onSave = vi.fn();
    render(<MemoInput onSave={onSave} />);
    
    const textarea = screen.getByPlaceholderText(/자유롭게 메모를 입력하세요/i);
    fireEvent.change(textarea, { target: { value: '저장할 메모' } });

    await waitFor(() => {
      expect(screen.getByText('저장')).toBeInTheDocument();
    });

    const saveButton = screen.getByText('저장');
    fireEvent.click(saveButton);

    expect(textarea).toHaveValue('');
    expect(onSave).toHaveBeenCalled();
  });
});
