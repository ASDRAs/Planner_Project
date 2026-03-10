# Development Journal

## Current Objective
- Implement and verify the `MemoInput` component, AI classification logic, persistence layers, and task checklist in the `Planner_Project` project.
- **Completed:** Eva-01 Theme (Neon Genesis Archive) UI/UX stabilization and fluid adaptive design.

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
- [x] **Phase 1-2: Repo Inspection & Pipeline Design** (Done)
- [x] **Phase 3-4: Deterministic Date & Folder Parser** (Done)
- [x] **Phase 5: Rule-based Classifier with Confidence** (Done)
- [x] **Phase 6: Training Log System Integration** (Done)
- [x] **Phase 7: Modular Pipeline Integration** (Done)
- [ ] **Verification: Red-Green-Refactor Validation of Pipeline** (In-Progress)

## Key Findings & Architectural Notes
- **Modular Pipeline**: `src/lib/memo/` 하위로 모든 파싱/분류 로직을 위임하여 `classifier.ts`는 이제 가벼운 Facade 역할만 수행합니다.
- **Spec-First Strategy**: 모든 파이프라인 단계(`folder`, `date`, `rules`)는 독립적인 `.test.ts` 파일을 통해 스펙이 정의되었습니다.
- **LLM Fallback**: 규칙 기반 확신도(confidence)가 0.75 미만일 때만 API를 호출하도록 설계되어 비용과 속도를 최적화했습니다.

## Last Successful Checkpoint
- Pipeline refactoring complete and basic integration tests passed.


## Key Findings & Architectural Notes
- **UI Architecture**: Moved global UI elements (Side Edges, Scanlines, Background Animations) to `RootLayout` in `layout.tsx` to ensure stable positioning across route changes.
- **Scroll Management**: Resolved the "Double Scrollbar" bug by ensuring only the `html` element handles scrolling. Used `scrollbar-gutter: stable` and `overflow-y: scroll` on the root to prevent layout shifts.
- **Fluid Design**: Replaced hardcoded Tailwind spacing/font sizes with CSS `clamp()` functions (e.g., `text-[clamp(1.5rem,3vw,2.5rem)]`) to ensure seamless scaling between mobile and wide PC monitors.
- **Flicker Fix**: Applied `transform: translateZ(0)` (via `.force-layer`) to the Navigation and Main containers to offload rendering to the GPU and prevent flickering during transitions.
- **Branding**: The project is now officially branded as **"NEON GENESIS ARCHIVE"** with a custom Eva-01 themed SVG favicon.

## Last Successful Checkpoint
- Full application functional with stabilized Eva-01 theme, fluid adaptive UI, and zero build errors.

## Current Blocker
- None. Ready for packaging and deployment phases.
