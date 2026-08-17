// /api/track.js
// 방문/검색/AI확장/저장/공유 등 이벤트를 Vercel KV에 집계합니다.
// KV가 연결되어 있지 않아도 서비스 동작에는 영향이 없도록 실패를 조용히 흡수합니다.
//
// uid(브라우저별 익명 ID)가 함께 오면 사용자 단위 집계도 남깁니다:
// - user:<uid>            해시 { first, last, count } — 재방문율 계산용
// - stats:all_users        방문한 적 있는 모든 uid 집합
// - stats:search_users     검색을 1회 이상 한 uid 집합 — 저장률/공유율의 분모
// - stats:save_users       보드 저장을 1회 이상 한 uid 집합 — 저장률의 분자
// - stats:share_users      공유 링크를 1회 이상 만든 uid 집합 — 공유율의 분자
import { kv } from '@vercel/kv';

const USER_EVENT_SETS = {
  search: 'stats:search_users',
  save: 'stats:save_users',
  share_link: 'stats:share_users',
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST 요청만 지원합니다.' });
    return;
  }

  const { event, name, uid } = req.body || {};
  if (!event) {
    res.status(400).json({ error: 'event가 필요합니다.' });
    return;
  }

  try {
    await kv.incr('stats:' + event);
    if (name) {
      await kv.hincrby('stats:top_stocks', String(name).slice(0, 40), 1);
    }

    const cleanUid = uid ? String(uid).slice(0, 64) : null;
    if (cleanUid) {
      if (event === 'visit') {
        const now = Date.now();
        const key = 'user:' + cleanUid;
        const existing = await kv.hget(key, 'first');
        if (!existing) {
          await kv.hset(key, { first: now, last: now, count: 1 });
        } else {
          await kv.hincrby(key, 'count', 1);
          await kv.hset(key, { last: now });
        }
        await kv.sadd('stats:all_users', cleanUid);
      } else if (USER_EVENT_SETS[event]) {
        await kv.sadd(USER_EVENT_SETS[event], cleanUid);
      }
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    // KV 미연결 상태에서도 사이트 핵심 기능은 계속 동작해야 하므로 200으로 조용히 응답합니다.
    res.status(200).json({ ok: false, note: 'KV 미연결 또는 오류', detail: err.message });
  }
}
