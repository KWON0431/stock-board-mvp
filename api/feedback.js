// /api/feedback.js
// 사용자 피드백(1:1 질문 3개 답변)을 수집/조회합니다.
import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { q1, q2, q3 } = req.body || {};
    if (!q1 && !q2 && !q3) {
      res.status(400).json({ error: '최소 한 개 이상의 답변을 입력해주세요.' });
      return;
    }
    try {
      await kv.rpush('feedback', JSON.stringify({
        q1: String(q1 || '').trim().slice(0, 300),
        q2: String(q2 || '').trim().slice(0, 300),
        q3: String(q3 || '').trim().slice(0, 300),
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
