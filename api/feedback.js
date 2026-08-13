// /api/feedback.js
// 사용자 피드백(텍스트 + 별점)을 수집/조회합니다.
import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { text, rating } = req.body || {};
    if (!text || !String(text).trim()) {
      res.status(400).json({ error: '내용을 입력해주세요.' });
      return;
    }
    try {
      await kv.rpush('feedback', JSON.stringify({
        text: String(text).trim().slice(0, 500),
        rating: rating || null,
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
