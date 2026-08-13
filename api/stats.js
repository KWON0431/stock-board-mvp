// /api/stats.js
// 집계된 KPI를 반환합니다 (총 방문, 총 검색, AI확장 클릭, 피드백 수, 인기 검색 종목).
import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  try {
    const [visits, searches, expands, feedbackLen, topHash] = await Promise.all([
      kv.get('stats:visit'),
      kv.get('stats:search'),
      kv.get('stats:ai_expand'),
      kv.llen('feedback'),
      kv.hgetall('stats:top_stocks'),
    ]);

    const top = Object.entries(topHash || {})
      .sort((a, b) => Number(b[1]) - Number(a[1]))
      .slice(0, 5)
      .map(([k]) => k);

    res.status(200).json({
      visits: visits || 0,
      searches: searches || 0,
      expands: expands || 0,
      feedbackCount: feedbackLen || 0,
      top,
    });
  } catch (err) {
    res.status(200).json({
      visits: 0, searches: 0, expands: 0, feedbackCount: 0, top: [],
      note: 'KV가 연결되어 있지 않습니다. README의 "KPI 측정 활성화" 항목을 참고하세요.',
    });
  }
}
