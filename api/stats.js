// /api/stats.js
// 집계된 KPI를 반환합니다:
// 총 방문 / 총 검색 / AI확장 클릭 / 피드백 수 / 인기 검색 종목
// + 보드 저장률(검색자 중 저장한 비율) / 공유 링크 생성률(검색자 중 공유 링크를 만든 비율) / 재방문율(6일 이내 2회 이상 방문 비율)
import { kv } from '@vercel/kv';

const SIX_DAYS_MS = 6 * 24 * 60 * 60 * 1000;
const MAX_USERS_SCAN = 500; // 재방문율 계산 시 훑어볼 최대 사용자 수 (표본)

export default async function handler(req, res) {
  try {
    const [
      visits, searches, expands, feedbackLen, topHash,
      searchUsers, saveUsers, shareUsers, allUsers,
    ] = await Promise.all([
      kv.get('stats:visit'),
      kv.get('stats:search'),
      kv.get('stats:ai_expand'),
      kv.llen('feedback'),
      kv.hgetall('stats:top_stocks'),
      kv.smembers('stats:search_users'),
      kv.smembers('stats:save_users'),
      kv.smembers('stats:share_users'),
      kv.smembers('stats:all_users'),
    ]);

    const top = Object.entries(topHash || {})
      .sort((a, b) => Number(b[1]) - Number(a[1]))
      .slice(0, 5)
      .map(([k]) => k);

    // 보드 저장률 / 공유 링크 생성률: 검색한 사용자(uid) 중 저장·공유까지 한 비율
    const searchSet = new Set(searchUsers || []);
    const saveSet = new Set(saveUsers || []);
    const shareSet = new Set(shareUsers || []);
    const savedFromSearchers = [...searchSet].filter((u) => saveSet.has(u)).length;
    const sharedFromSearchers = [...searchSet].filter((u) => shareSet.has(u)).length;
    const saveRate = searchSet.size ? Math.round((savedFromSearchers / searchSet.size) * 100) : null;
    const shareRate = searchSet.size ? Math.round((sharedFromSearchers / searchSet.size) * 100) : null;

    // 재방문율: 첫 방문 후 6일 이내에 2회 이상 방문한 사용자 비율 (최근 방문자 표본 기준)
    let returningRate = null;
    const sampledUsers = (allUsers || []).slice(0, MAX_USERS_SCAN);
    if (sampledUsers.length) {
      const hashes = await Promise.all(sampledUsers.map((u) => kv.hgetall('user:' + u)));
      const returning = hashes.filter((h) => {
        if (!h || !h.first || !h.last || !h.count) return false;
        const count = Number(h.count);
        const span = Number(h.last) - Number(h.first);
        return count >= 2 && span <= SIX_DAYS_MS;
      }).length;
      returningRate = Math.round((returning / sampledUsers.length) * 100);
    }

    res.status(200).json({
      visits: visits || 0,
      searches: searches || 0,
      expands: expands || 0,
      feedbackCount: feedbackLen || 0,
      top,
      saveRate,
      shareRate,
      returningRate,
    });
  } catch (err) {
    res.status(200).json({
      visits: 0, searches: 0, expands: 0, feedbackCount: 0, top: [],
      saveRate: null, shareRate: null, returningRate: null,
      note: 'KV가 연결되어 있지 않습니다. README의 "KPI 측정 활성화" 항목을 참고하세요.',
    });
  }
}
