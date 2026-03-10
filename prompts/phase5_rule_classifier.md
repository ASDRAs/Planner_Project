\# Phase 5 — Rule-Based Memo Classifier



Implement a deterministic rule-based classifier.



---



\# Categories



STUDY  

GAME\_DESIGN  

VAULT  

THOUGHT  

TODO  



---



\# Signals



TODO

\- action verbs

\- date presence



STUDY

\- 과제

\- 시험

\- 출석



GAME\_DESIGN

\- player behavior

\- game design discussion



VAULT

\- commands

\- config

\- .msc

\- .cpl



THOUGHT

\- philosophical statements



---



\# Output



{

category,

confidence,

reasons

}



LLM fallback threshold:



confidence < 0.75



---



\# Commit



git add .

git commit -m "phase5: rule-based memo classifier implemented"

