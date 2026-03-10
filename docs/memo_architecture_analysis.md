# Memo Architecture Analysis

This document analyzes the current memo data flow and architecture in the Planner_Project.

## 1. Memo Input Flow

- **Entry Point**: `src/components/MemoInput.tsx`
- **Trigger**: The input text is monitored by a `useEffect` with an 800ms debounce.
- **Preview Parsing/Classification**:
    1. `MemoInput.tsx` calls `classifyMemo(text)` from `src/lib/classifier.ts`.
    2. `classifier.ts` first performs **structural parsing** (detecting `folder / content` syntax).
    3. It then performs **strict date parsing** (today, tomorrow, specific dates like 3.14 or 3월 14일).
    4. Finally, it sends the remaining content to the **AI Classification API** (`/api/classify`).
    5. The result is stored in the `result` state and displayed as a preview (Category, Date, Folder).

## 2. Memo Save Flow

- **Trigger**: User clicks "Execute Deploy" (Save button) in `MemoInput.tsx`.
- **Logic**:
    1. It takes the `result` (from classification) and `selectedCategory`.
    2. It handles `subTasks` (if provided by AI for TODOs).
    3. It calls `saveMemo` from `src/lib/storage.ts` for each content/date combination.
- **Storage Strategy**:
    1. `storage.ts` saves the memo to **Supabase** (if `userId` exists).
    2. It also saves the memo to **Local Storage** (`daily-planner-memos`) as a fallback and for offline support.

## 3. Relevant Modules

- `src/lib/classifier.ts`: Contains the main classification logic, keyword mapping, and AI orchestration. Currently monolithic and handles multiple responsibilities (structural parsing, date parsing, AI calling, fallback logic).
- `src/lib/dateUtils.ts`: Basic date helpers for formatting and relative dates.
- `src/lib/storage.ts`: Handles CRUD operations, local storage sync, and Supabase integration.
- `src/app/api/classify/route.ts`: Proxies requests to Gemini AI with a system prompt for classification.
- `src/components/TodayTodo.tsx`: Displays TODOs for the current day. Note: It uses `createdAt` for date filtering, which might conflict with `targetDate`.

## 4. Refactor Candidates

### A. Modular Pipeline (Phase 2)
The `classifyMemo` function in `classifier.ts` is too large. It should be broken down into a pipeline:
1. `normalizeInput`: Basic cleanup.
2. `parseFolder`: Extract folder using the `/` delimiter.
3. `parseDate`: Use a deterministic Korean date parser (Phase 3).
4. `ruleBasedClassify`: Use keywords and patterns before falling back to AI (Phase 5).
5. `llmFallback`: Call AI only if confidence is low.

### B. Date Logic Consistency
`TodayTodo.tsx` currently filters memos where `createdAt` matches today. However, memos have a `targetDate` field. The logic should likely be updated to use `targetDate` for "Today's Objectives".

### C. Logging System (Phase 6)
Integrate a training log system to capture `rawInput` vs `finalResult` for future model tuning or rule adjustment.

## 5. Storage Architecture

- **Primary**: Supabase (PostgreSQL) for persistence and cross-device sync.
- **Secondary/Cache**: LocalStorage for instant UI updates and offline functionality.
- **Sync**: `fetchMemos` prioritizes local data if offline or guest, and background-syncs with Supabase.
