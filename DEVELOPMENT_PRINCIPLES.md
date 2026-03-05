# AI Development Principles: Red-Green-Refactor & Spec-First

This document defines the core development methodology for all AI-assisted engineering tasks. Any AI interacting with this codebase must adhere strictly to these steps.

## 1. Red - Green - Refactor (TDD Cycle)
The development process MUST follow this iterative cycle:

1.  **🔴 RED (Fail First):** Write a failing test case *before* writing any production code. This defines the requirements and behavior of the feature.
2.  **🟢 GREEN (Minimal Pass):** Implement the *minimum* amount of code necessary to make the test pass. Avoid any extra complexity at this stage.
3.  **🔵 REFACTOR (Clean Code):** Improve the code's structure, readability, and performance without changing its behavior. Ensure all tests still pass.

## 2. Spec-First Strategy (Test-as-Prompt)
Treat the specifications as the primary source of truth and the most critical part of the prompt.

*   **Tests are Specs:** Detailed test cases serve as the technical specification for the feature.
*   **Prompting via Tests:** When requesting a feature, prioritize providing or asking for the test code first. The goal is to: "Implement the feature so that all provided tests pass."
*   **No Unverified Code:** Never write production code without a corresponding test to verify it.

## 3. Collaboration Protocol
*   **Propose Tests First:** When a feature is requested, the AI should first propose the test suite (RED step) and wait for confirmation if necessary.
*   **Verification:** Always run existing tests before and after making changes to prevent regressions.
*   **Focus on 'Why':** Comments should explain the design intent (the 'why'), while the tests prove the correctness (the 'what').

## 4. Continuity & Checkpointing (Journaling)
The AI must maintain a `JOURNAL.md` file to preserve context across session interruptions.

*   **Checkpointing:** Update `JOURNAL.md` after every successful `Validate` step or major strategic shift.
*   **Structure:** The journal should include the current objective, a checklist of sub-tasks with their status (Todo/In-Progress/Done), key findings, and current blockers.
*   **Resumption:** Upon starting a new session, the AI must first read `JOURNAL.md` to restore the working context and resume exactly where it left off.
