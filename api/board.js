// /api/board.js
// 보드 상태(카드/메모/연결선)를 저장하고 불러옵니다.
// "보드 저장" 버튼과 "공유 링크" 버튼이 함께 사용하는 공통 엔드포인트입니다.
import { kv } from '@vercel/kv';

function genId() {
  return Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
}

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { state } = req.body || {};
    if (!state || typeof state !== 'object') {
      res.status(400).json({ error: '저장할 보드 데이터(state)가 필요합니다.' });
      return;
    }
    const id = genId();
    try {
      await kv.set('board:' + id, JSON.stringify(state));
      res.status(200).json({ ok: true, id });
    } catch (err) {
      res.status(500).json({ error: '보드 저장에 실패했습니다.', detail: err.message });
    }
    return;
  }

  if (req.method === 'GET') {
    const id = (req.query && req.query.id) ? String(req.query.id).slice(0, 40) : '';
    if (!id) {
      res.status(400).json({ error: 'id가 필요합니다.' });
      return;
    }
    try {
      const raw = await kv.get('board:' + id);
      if (!raw) {
        res.status(404).json({ error: '보드를 찾을 수 없어요. 링크가 잘못됐거나 만료됐어요.' });
        return;
      }
      const state = typeof raw === 'string' ? JSON.parse(raw) : raw;
      res.status(200).json({ ok: true, state });
    } catch (err) {
      res.status(500).json({ error: '보드를 불러오지 못했습니다.', detail: err.message });
    }
    return;
  }

  res.status(405).json({ error: '지원하지 않는 메서드입니다.' });
}
