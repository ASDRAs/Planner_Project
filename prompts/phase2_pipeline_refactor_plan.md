\# Phase 2 — Memo Pipeline Refactor Plan



Using the Phase 1 analysis, design a modular memo processing pipeline.



---



\# Target Pipeline



raw input

→ normalize input

→ parse folder

→ parse date expressions

→ strip date text

→ rule-based classification

→ compute confidence

→ extract tags

→ derive priority

→ optional LLM fallback

→ finalize memo object



---



\# Tasks



Design:



1\. new module structure

2\. separation of responsibilities

3\. migration path from classifier.ts

4\. integration with storage.ts

5\. integration with api/classify route



---



\# Deliverable



Create:



docs/memo\_pipeline\_refactor\_plan.md



Include:



\- file structure

\- responsibilities

\- migration steps



---



\# Commit



git add .

git commit -m "phase2: pipeline refactor architecture"

