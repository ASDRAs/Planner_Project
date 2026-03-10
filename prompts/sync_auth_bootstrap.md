\# Planner\_Project — Session Validation + Initial Sync + Polling Integration



You are working inside an existing \*\*Next.js + TypeScript planner application\*\*.



The repository already contains memo, storage, Supabase, and UI flow code.

You must implement a clean startup synchronization flow in the current architecture.



Do not stop at analysis.

You must inspect the repository, modify the code, verify the behavior, and summarize the result.



---



\# Goal



Implement the following application flow:



page entered  

→ validate login/session once  

→ if valid, run one initial sync  

→ then start periodic sync  

→ pause sync when tab is hidden  

→ resume with immediate sync when tab becomes visible  

→ stop sync if auth becomes invalid  



This must integrate with the current project structure.



---



\# Known Relevant Files



The repository likely includes modules similar to:



src/lib/storage.ts  

src/lib/supabase.ts  

src/components/Dashboard.tsx  

src/components/DataSync.tsx  

src/components/MemoInput.tsx  

src/components/TodayTodo.tsx  



Start by inspecting these files and then explore any related modules required for authentication or storage.



---



\# Architectural Intent



Follow this responsibility split unless the repository structure strongly suggests a better nearby location.



\## src/lib/supabase.ts



Responsible for authentication helpers:



\- session retrieval

\- user retrieval

\- session validation



\## src/lib/storage.ts



Responsible for:



\- remote memo fetch

\- local merge

\- push operations

\- sync orchestration entry point



\## src/components/DataSync.tsx



Responsible for synchronization orchestration:



\- initial sync

\- polling sync

\- visibility handling

\- sync state management



\## src/components/Dashboard.tsx



Responsible for bootstrap logic:



\- validate session on mount

\- enable sync manager when valid

\- disable sync when invalid



---



\# Required Behavior



\## 1. Session Validation on Page Entry



When the main dashboard loads:



1\. run session validation once

2\. determine if session is valid

3\. if invalid:

&nbsp;  - do not start sync

&nbsp;  - remain in auth-required state

4\. if valid:

&nbsp;  - obtain user identity if needed

&nbsp;  - trigger initial sync



Centralize this logic in a helper.



Example expected shape:



&nbsp;   validateSession(): Promise<{ isValid: boolean; userId: string | null }>



You may adapt this interface to the repository style.



---



\## 2. Initial Sync



After session validation succeeds:



\- run one immediate sync

\- do not wait for polling interval



---



\## 3. Periodic Sync



After the initial sync:



\- start polling

\- recommended interval: 60 seconds



Requirements:



\- prevent overlapping sync calls

\- if sync is running, skip the next scheduled run



Use a guard such as:



&nbsp;   isSyncingRef.current



---



\## 4. Tab Visibility Handling



When tab becomes hidden:



\- stop or pause polling



When tab becomes visible again:



\- immediately run sync

\- restart polling



Use the browser visibility API.



---



\## 5. Auth Failure During Sync



If a sync fails due to authentication problems:



\- stop polling

\- update auth state

\- avoid infinite retry loops



Differentiate between:



auth failure → stop sync  

network failure → allow retry



---



\## 6. Preserve Existing Memo Save Flow



The current memo save pipeline must remain functional.



Do NOT break:



\- memo creation

\- memo editing

\- local state updates

\- storage logic

\- training log collection if present



Sync logic must integrate without rewriting the entire memo flow.



---



\## 7. TodayTodo Correctness Check



Inspect:



&nbsp;   src/components/TodayTodo.tsx



If TODO items are currently filtered using `createdAt` instead of `targetDate`, update it to use `targetDate` when appropriate.



Do this only if it is consistent with the data model.



---



\# Suggested Implementation Structure



\## In src/lib/supabase.ts



Add helpers such as:



&nbsp;   getCurrentSession()

&nbsp;   getCurrentUser()

&nbsp;   validateSession()



---



\## In src/lib/storage.ts



Add a sync entry point such as:



&nbsp;   syncMemos(userId)



Optional structured result:



&nbsp;   interface SyncResult {

&nbsp;       ok: boolean

&nbsp;       pulled?: number

&nbsp;       pushed?: number

&nbsp;       conflicts?: number

&nbsp;   }



---



\## In src/components/DataSync.tsx



Implement orchestration functions:



&nbsp;   syncNow()

&nbsp;   startPolling()

&nbsp;   stopPolling()



Responsibilities:



\- run initial sync

\- manage polling interval

\- prevent overlap

\- handle visibility change



---



\## In src/components/Dashboard.tsx



On mount:



1\. run session validation

2\. if valid → enable DataSync

3\. if invalid → remain in auth-required state



---



\# State Model



Suggested auth state:



&nbsp;   type AuthCheckState =

&nbsp;     | "idle"

&nbsp;     | "checking"

&nbsp;     | "valid"

&nbsp;     | "invalid"



Suggested sync state:



&nbsp;   type SyncState =

&nbsp;     | "idle"

&nbsp;     | "syncing"

&nbsp;     | "ready"

&nbsp;     | "error"



Adapt naming to match repository conventions.



---



\# Implementation Plan



You must:



1\. inspect repository auth + storage + sync code

2\. implement session validation helper

3\. implement or refine sync function

4\. wire bootstrap logic in Dashboard

5\. implement DataSync polling manager

6\. add visibility handling

7\. prevent overlapping sync calls

8\. verify TodayTodo correctness

9\. run project validation commands if present



Do not stop at planning.

Modify the code directly.



---



\# Verification



After implementation:



1\. run tests if present

2\. run build if available

3\. run lint if available

4\. inspect whether startup flow works correctly



If any command fails:



\- diagnose cause

\- fix code

\- rerun command



Continue until stable.



---



\# Expected Final Behavior



dashboard mounted  

→ validate session  

→ if invalid: no sync  

→ if valid: initial sync  

→ polling every ~60s  

→ tab hidden: polling paused  

→ tab visible: immediate sync + polling resumes  

→ auth invalidation: polling stops  



Implement this now.

