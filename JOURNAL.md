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
- [x] **Theme Fix: Dark Mode Background (Issue A)** - Fixed background inheritance and redundant layers. (Done)
- [x] **Theme Fix: Side Edges Positioning (Issue B)** - Moved to layout.tsx with fixed positioning. (Done)
- [x] **Theme Fix: Logo Hierarchy (Issue C)** - Optimized "ARCHIVE" emphasis and spacing. (Done)
- [x] **Theme Fix: Performance/Flicker (Issue D)** - Applied force-layer and GPU acceleration. (Done)
- [x] **Fluid UI: Adaptive Typography & Spacing** - Implemented `clamp()` based responsive design. (Done)
- [x] **Scrollbar: Double Scrollbar Fix** - Unified scroll logic to root element with stable gutter. (Done)
- [x] **Branding: Metadata & Icon Update** - Changed title and created Eva-01 `icon.svg`. (Done)
- [ ] **Next: Package as EXE/APK (Planned)**

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
