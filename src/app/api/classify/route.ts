import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { input, today, dayOfWeek } = await req.json();
    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;

    if (!apiKey) {
      console.error("Gemini API Key is missing!");
      return NextResponse.json({ error: "AI 설정 오류: API 키가 없습니다." }, { status: 500 });
    }

    const candidates = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-pro"];

    const systemPrompt = `당신은 지능형 메모 관리 비서입니다. JSON 형식으로만 응답하세요. 
    규칙: 
    1. '/' 기호가 맨 앞에 오면 folder로, 아니면 content로 분류하세요. 
    2. 'cleanContent'에서는 모든 형태의 시간/날짜 지시어(오늘, 내일, 3일 뒤, 이번주 토요일, 3.14 등)를 문맥에 맞게 제거하여 순수한 작업 내용만 남기세요.
    3. 'targetDates' 필드에는 현재 날짜를 기준으로 계산된 정확한 날짜(YYYY-MM-DD)를 배열로 넣으세요.
    카테고리: 
    - STUDY: 수업, 공부, 특강, 학습 지식.
    - GAME_DESIGN: 게임 시스템 설계, 기획 아이디어.
    - VAULT: 오래 기억해야 할 핵심 정보(집 비밀번호, 계좌번호, 보험 정보, 주소, 계약 정보, 시리얼 키 등).
    - THOUGHT: 개인적 생각, 낙서, 아이디어, 이력서, 성찰.
    - TODO: 실행이 필요한 할 일.`;

    for (const model of candidates) {
      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [
              { text: systemPrompt }, 
              { text: `현재 날짜는 ${today} (${dayOfWeek}) 입니다. 입력: "${input}"` }
            ] }],
            generationConfig: { responseMimeType: "application/json" }
          })
        });

        if (response.ok) {
          const data = await response.json();
          return new Response(data.candidates[0].content.parts[0].text.trim(), {
            headers: { 'Content-Type': 'application/json' }
          });
        }
      } catch { continue; }
    }

    throw new Error("모든 AI 모델 호출 실패");
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
