# Development Journal

## Current Objective
- Implement and verify the `MemoInput` component, AI classification logic, persistence layers, and task checklist in the `Planner_Project` project.

## Roadmap & Status
- [x] Research: Analyze existing project structure and requirements (Done)
- [x] AI Classification: Implement Gemini 2.0/1.5 API based classification (Done)
- [x] Hybrid UI: Dashboard for TODOs and List for Knowledge Base (Done)
- [x] Date Parsing: Smart extraction of specific dates (3.14, etc.) (Done)
- [x] Task Splitting: Split multiple tasks into separate items (Done)
- [x] Class Detection: Automatic tagging and highlighting for "수업" (Done)
- [x] Editing/Merging: Manual content updates and multi-memo merging (Done)
- [x] Bug Fix: Remove date indicators (오늘, 내일 등) from cleanContent (Done)
- [x] Import/Export Improvements (Done)
- [x] Login Functionality (Done)
- [ ] **Next: Package as EXE/APK (Planned)**

## Key Findings
- **Gemini Model**: Used `gemini-2.0-flash` or `gemini-flash-latest` via Server-side API Route to avoid browser runtime errors.
- **Data Model**: Memos now include `targetDate`, `folder`, `completed`, and `priority`.
- **Hybrid Layout**: Top-level `Quest Log` for actions, bottom-level `Knowledge Base` for storage.

## Last Successful Checkpoint
- Full application functional with AI-driven classification, task splitting, and manual editing.

## Current Blocker
- None. Ready for the next roadmap items.
