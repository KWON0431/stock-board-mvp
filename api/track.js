// /api/track.js
// 방문/검색/AI확장 클릭 등 이벤트를 Vercel KV에 집계합니다.
// KV가 연결되어 있지 않아도 서비스 동작에는 영향이 없도록 실패를 조용히 흡수합니다.
import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST 요청만 지원합니다.' });
    return;
  }

  const { event, name } = req.body || {};
  if (!event) {
    res.status(400).json({ error: 'event가 필요합니다.' });
    return;
  }

  try {
    await kv.incr('stats:' + event);
    if (name) {
      await kv.hincrby('stats:top_stocks', String(name).slice(0, 40), 1);
    }
    res.status(200).json({ ok: true });
  } catch (err) {
    // KV 미연결 상태에서도 사이트 핵심 기능은 계속 동작해야 하므로 200으로 조용히 응답합니다.
    res.status(200).json({ ok: false, note: 'KV 미연결 또는 오류', detail: err.message });
  }
}
