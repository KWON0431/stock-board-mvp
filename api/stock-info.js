// /api/stock-info.js
// Vercel Serverless Function — 단일 종목의 최신 분위기 + 추세를 조사해 반환합니다.
// Google Gemini API (무료 티어)를 사용합니다. GEMINI_API_KEY는 Vercel 프로젝트의 환경 변수로 설정하세요.
// 무료 키 발급: https://aistudio.google.com/apikey (신용카드 불필요)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST 요청만 지원합니다.' });
    return;
  }

  const { name } = req.body || {};
  if (!name || !String(name).trim()) {
    res.status(400).json({ error: '종목명(name)이 필요합니다.' });
    return;
  }

  if (!process.env.GEMINI_API_KEY) {
    res.status(500).json({ error: '서버에 GEMINI_API_KEY가 설정되어 있지 않습니다. Vercel 프로젝트 환경 변수를 확인하세요.' });
    return;
  }

  const system = `당신은 주식 정보 도우미입니다. 입력 종목의 최신 분위기를 웹 검색으로 조사해 아래 JSON 형식으로만 응답하세요. 다른 설명, 코드블록 금지.
{"name":"정식 종목명(짧게)","change":"+1.2% 또는 -0.8% 형태의 추정 등락률","summary":"현재 이슈를 한 문장(24자 내외)으로, 원문 인용 금지","trend":[최근 추세를 나타내는 8개의 숫자 배열, 임의 스케일 0~100, 오래된순 → 최신순]}`;

  try {
  // 1. 모델명을 정식 명칭으로 변경 (gemini-1.5-flash 또는 gemini-2.0-flash)
  const model = 'gemini-1.5-flash'; 
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;
  
  const apiRes = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: `종목: ${name}` }] }],
      systemInstruction: { parts: [{ text: system }] },
      // 2. google_search -> googleSearch 로 변경
      tools: [{ googleSearch: {} }], 
      generationConfig: { temperature: 1.0 },
    }),
  });

    if (!apiRes.ok) {
      const detail = await apiRes.text();
      res.status(apiRes.status).json({ error: 'Gemini API 오류', detail });
      return;
    }

    const data = await apiRes.json();
    const text = (data.candidates?.[0]?.content?.parts || [])
      .map((p) => p.text || '')
      .filter(Boolean)
      .join('\n');

    const s = text.indexOf('{');
    const e = text.lastIndexOf('}');
    if (s === -1 || e === -1) {
      res.status(502).json({ error: '응답 파싱 실패', raw: text });
      return;
    }

    res.status(200).json(JSON.parse(text.slice(s, e + 1)));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
