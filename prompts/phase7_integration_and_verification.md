\# Phase 7 — Integration and Verification



Integrate all modules.



---



\# Final Pipeline



raw input

→ normalize input

→ parse folder

→ parse date

→ clean text

→ rule classifier

→ compute confidence

→ optional LLM fallback

→ save memo

→ save training log



---



\# Verification



Test cases:



만들어진 신 / 기도하다 → THOUGHT  

6월 15 학사일정상 종강 → TODO  

알고리즘 / 연습문제 → STUDY  

services.msc 서비스 강종 → VAULT  

내일 세탁기 돌리기 → TODO  



---



\# Commit



git add .

git commit -m "phase7: memo pipeline integration complete"

