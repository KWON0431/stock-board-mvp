// /api/related.js
// Vercel Serverless Function — 경쟁 관계 / 지분 관계 / 납품 관계 연관주만 각 3개씩 조사해 반환합니다.
// 뉴스·테마 기반 연결은 허용하지 않으며, 각 종목마다 연결 근거(reason)를 함께 반환합니다.
// Google Gemini API (무료 티어)를 사용합니다. GEMINI_API_KEY는 Vercel 프로젝트의 환경 변수로 설정하세요.
// 무료 키 발급: https://aistudio.google.com/apikey (신용카드 불필요)

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

  const system = `당신은 주식 연관주 리서치 도우미입니다. 입력 종목과 아래 세 가지 "관계 유형"으로만 실제로 연결된 종목을 웹 검색으로 조사해 찾아주세요.

절대 금지: 같은 뉴스/이슈에 언급된다는 이유, 같은 테마·섹터로 묶인다는 이유만으로는 연결하지 마세요. 아래 세 유형 중 하나에 명확히 해당하는 "사실관계"가 있는 경우에만 연결하세요.

허용되는 관계 유형은 다음 세 가지뿐입니다:
- competitors (경쟁 관계): 동일한 제품·서비스 시장에서 직접 경쟁하는 종목
- equity (지분 관계): 입력 종목이 지분을 보유했거나, 입력 종목의 지분을 보유한 종목 (모회사/자회사/계열사 포함)
- supply (납품 관계): 부품·원자재·설비 등을 실제로 납품하거나 공급받는 밸류체인 관계

각 유형별로 정확히 3개씩 찾되, 위 정의에 명확히 부합하는 근거가 없다면 억지로 채우지 말고 해당 유형은 3개보다 적게 반환해도 됩니다.

각 종목마다 "reason" 필드에 그 관계가 왜 성립하는지 근거를 한 문장(20자 내외)으로 쓰세요. 반드시 위 세 관계 유형 중 하나에 해당하는 구체적 사실을 담아야 하며 (예: "카메라 모듈 납품", "지분 12% 보유", "동일 시장 직접 경쟁"), 뉴스 요약·테마 언급·원문 인용은 금지합니다.

반드시 아래 JSON 형식으로만 응답하세요. 다른 설명, 코드블록 금지. 이미 나온 종목은 중복하지 마세요.
{"competitors":[{"name":"짧은 종목명","change":"+1.2% 형태","reason":"관계 근거 한 문장(20자 내외)","trend":[6개 숫자, 0~100 임의 스케일, 오래된순]}],
 "equity":[...동일 형식...],
 "supply":[...동일 형식...]}`;

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
