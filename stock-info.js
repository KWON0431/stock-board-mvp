// /api/stock-info.js
// Vercel Serverless Function — 단일 종목의 최신 분위기 + 추세를 조사해 반환합니다.
// Google Gemini API (무료 티어)를 사용합니다. GEMINI_API_KEY는 Vercel 프로젝트의 환경 변수로 설정하세요.
// 무료 키 발급: https://aistudio.google.com/apikey (신용카드 불필요)

function sleep(ms){ return new Promise((r) => setTimeout(r, ms)); }

async function callGeminiOnce(system, userText, useSearch) {
  const model = 'gemini-3.5-flash-lite'; // 무료 티어 중 요청 한도가 가장 여유로운 모델
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const body = {
    contents: [{ role: 'user', parts: [{ text: userText }] }],
    systemInstruction: { parts: [{ text: system }] },
    generationConfig: { temperature: 1.0 },
  };
  if (useSearch) body.tools = [{ google_search: {} }];

  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': process.env.GEMINI_API_KEY,
    },
    body: JSON.stringify(body),
  });
}

// 무료(미결제) 티어에서는 "웹서치 포함 요청"에 대해 문서에 없는 훨씬 낮은 별도 한도가 걸리는 경우가 있습니다.
// 그 한도에 걸리면(429), 웹서치 없이 한 번 더 시도해 최소한 서비스는 계속 동작하도록 합니다.
async function callGemini(system, userText) {
  let res = await callGeminiOnce(system, userText, true);
  if (res.status === 429) {
    await sleep(400);
    res = await callGeminiOnce(system, userText, false);
  }
  return res;
}

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
    const apiRes = await callGemini(system, `종목: ${name}`);

    if (apiRes.status === 429) {
      res.status(429).json({ error: '무료 API 사용량 한도에 도달했어요. 10~20초 후 다시 시도해주세요.' });
      return;
    }

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
