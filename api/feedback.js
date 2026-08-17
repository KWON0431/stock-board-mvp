// /api/feedback.js
// 사용자 피드백(1:1 질문 3개에 대한 답변)을 수집/조회합니다.
import { kv } from '@vercel/kv';

const QUESTIONS = {
  accuracy: ['accurate', 'mixed', 'inaccurate'],       // AI 연관 관계 정확도
  usefulness: ['helpful', 'neutral', 'not_helpful'],   // 카드/연결선 UI 유용성
  retention: ['yes', 'maybe', 'no'],                   // 재사용 의향
};

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const body = req.body || {};
    for (const [key, allowed] of Object.entries(QUESTIONS)) {
      if (!allowed.includes(body[key])) {
        res.status(400).json({ error: `"${key}" 질문에 유효한 답을 선택해주세요.` });
        return;
      }
    }
    try {
      await kv.rpush('feedback', JSON.stringify({
        accuracy: body.accuracy,
        usefulness: body.usefulness,
        retention: body.retention,
        ts: Date.now(),
      }));
      res.status(200).json({ ok: true });
    } catch (err) {
      res.status(200).json({ ok: false, note: 'KV 미연결 또는 오류', detail: err.message });
    }
    return;
  }

  if (req.method === 'GET') {
    try {
      const items = await kv.lrange('feedback', 0, 99);
      res.status(200).json({ items: items.map((i) => JSON.parse(i)) });
    } catch (err) {
      res.status(200).json({ items: [], note: 'KV 미연결' });
    }
    return;
  }

  res.status(405).json({ error: '지원하지 않는 메서드입니다.' });
}
