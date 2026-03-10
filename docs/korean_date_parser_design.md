# Korean Natural Language Date Parser Design

This document describes the deterministic date parser used in the planner project.

LLM must never be used for date parsing.

---

# Function Interface

parseDateExpressions(input: string, context: ParseContext): DateParseResult

interface ParseContext {
  today: string
  now: Date
}

interface DateParseResult {
  targetDates: string[]
  cleanedText: string
  matchedPatterns: string[]
}

---

# Supported Date Expressions

오늘  
내일  
모레  
다음주 월요일 ~ 일요일  
이번주 월요일 ~ 일요일  
4/17  
6월 15  
6월 15일  
YYYY-MM-DD  

---

# Examples

Example 1

Input

내일 세탁기 돌리기

Output

targetDate = tomorrow  
cleanedText = 세탁기 돌리기  

---

Example 2

Input

다음주 수요일 청소하기

Output

targetDate = next Wednesday  
cleanedText = 청소하기  

---

Example 3

Input

4/17 쿠팡와우 해지하기

Output

targetDate = current-year-04-17  
cleanedText = 쿠팡와우 해지하기  

---

Example 4

Input

6월 15 학사일정상 1학기 종강

Output

targetDate = current-year-06-15  
cleanedText = 학사일정상 1학기 종강  

---

# Edge Cases

Example

알고리즘 / 6월 15 과제 제출

Result

folder = 알고리즘  
targetDate = 6월 15일  
content = 과제 제출  

Numbers that must NOT be interpreted as dates:

중간3 기말3 과제2 출석2  

---

# Performance Expectations

The parser should:

- run in under 1ms for normal memo inputs
- support memo length up to about 200 characters
- avoid heavy regex loops
- avoid unnecessary allocations

---

# Future Extensions

Possible improvements:

- time extraction (09:00 등)
- recurring events
- duration detection
- calendar integration