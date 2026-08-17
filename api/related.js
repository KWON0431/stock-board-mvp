// /api/related.js
// Vercel Serverless Function — 경쟁사/지분 관계/납품 관계 연관주를 각 3개씩 조사해 반환합니다.
// 뉴스/단순 테마성 연결은 엄격히 배제하며, 카드에 표시할 '연결 이유(reason)'를 한 줄로 작성합니다.

function sleep(ms){ return new Promise((r) => setTimeout(r, ms)); }

async function callGeminiOnce(system, userText, useSearch) {
  const model = 'gemini-3.5-flash-lite';
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

  const system = `당신은 주식 연관주 리서치 도우미입니다.
[지침]
1. 일시적인 뉴스나 단순 이슈, 테마주 엮음은 절대로 배제하세요.
2. 오직 아래 3가지 수직/수평적 관계만 허용합니다:
   - competitors: 동일 시장에서의 직접적인 경쟁 관계
   - partners: 지분 관계 (자회사, 모회사, 주요 지분 투자 등)
   - supply: 실제 부품/원자재/제품 납품 관계 (공급망)
3. 각 연관 종목마다 연결 이유(reason)를 한 줄(20자 이내)로 명확히 작성하세요 (예: '삼성전자에 OLED 패널 납품', '모회사 지분 30% 보유', '국내 메모리 시장 직접 경쟁').

세 그룹을 각각 정확히 3개씩 찾아 아래 JSON 형식으로만 응답하세요. 다른 설명, 코드블록 금지. 각 그룹 정확히 3개, 이미 나온 종목은 중복하지 마세요.
{"competitors":[{"name":"짧은 종목명","change":"+1.2% 형태","reason":"연결 이유 한 줄(20자 이내)","news":"한 문장(22자 내외)","trend":[6개 숫자, 0~100 임의 스케일, 오래된순]}],
 "partners":[...동일 형식 3개 (지분 관계)...],
 "supply":[...동일 형식 3개 (납품 관계)...]}`;

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
      .join('
');

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
