# Memo Pipeline Refactor Plan

This document outlines the modular pipeline for processing memo inputs.

## 1. File Structure

All pipeline-related code will reside in `src/lib/memo/`.

```text
src/lib/memo/
├── types.ts           # Pipeline result and context types
├── constants.ts       # Category keywords, rule signals
├── parser/            # Parsing logic
│   ├── normalize.ts   # String normalization
│   ├── folder.ts      # "Folder / Content" extraction
│   └── date.ts        # Korean natural language date parser
├── classify/          # Classification logic
│   ├── rules.ts       # Deterministic keyword/pattern matching
│   ├── confidence.ts  # Confidence score calculator
│   └── llm.ts         # AI fallback (proxies to /api/classify)
└── pipeline.ts        # Main orchestration: processMemo()
```

## 2. Responsibilities

- **`normalize`**: Trim whitespace, handle Unicode variants (e.g., standardizing slashes).
- **`folder`**: Detect the structural delimiter (`/`) and split header from content.
- **`date`**: Detect date expressions (오늘, 내일, 모레, 4/17 등) and extract target dates while cleaning the content.
- **`rules`**: Match keywords (STUDY, VAULT, etc.) and action verbs (TODO).
- **`confidence`**: Return a score (0.0 to 1.0).
- **`llm`**: Use Gemini AI when rule-based confidence is < 0.75.

## 3. Implementation Steps

1. **Step 1: Setup Types & Constants**
   - Move `Category` and `ClassificationResult` into a common types file.
2. **Step 2: Implement Date Parser (Phase 3)**
   - Build a deterministic Korean date parser as per `docs/korean_date_parser_design.md`.
3. **Step 3: Implement Folder Parser (Phase 4)**
   - Extract folder prefix and clean main content.
4. **Step 4: Implement Rule Classifier (Phase 5)**
   - Build a robust keyword/signal matcher with confidence scoring.
5. **Step 5: Integration**
   - Create `src/lib/memo/pipeline.ts` to orchestrate all steps.
   - Update `classifier.ts` to serve as a bridge (facade) to the new pipeline.
6. **Step 6: Update UI**
   - Ensure `MemoInput.tsx` works seamlessly with the new pipeline results.

## 4. Migration Path

- `src/lib/classifier.ts` will be refactored to:
  ```typescript
  import { processMemo } from './memo/pipeline';
  
  export async function classifyMemo(input: string) {
    return await processMemo(input);
  }
  ```
- This ensures zero breaking changes to existing components.
