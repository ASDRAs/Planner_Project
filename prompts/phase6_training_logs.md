\# Phase 6 — Training Log System



Implement supervised training log collection.



Logs must be written only after memo save succeeds.



---



\# Log Fields



rawInput  

predictedCategory  

predictedFolder  

predictedTags  

predictedTargetDate  

predictedConfidence  



finalCategory  

finalFolder  

finalTags  

finalTargetDate  



diff flags



---



\# Requirements



1\. integrate with storage.ts

2\. support Supabase

3\. memo save must not fail if logging fails



---



\# Commit



git add .

git commit -m "phase6: training log system implemented"

