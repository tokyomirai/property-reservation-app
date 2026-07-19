// utils/rateLimit.ts
// 公開エンドポイント向けの簡易レート制限。
// 注意: サーバーレス環境ではインスタンスごとにメモリが分かれるため厳密ではないが、
// 単純な連投・ボットによる大量送信に対しては十分な抑止力になる。
// より厳密な制御が必要になった場合は Redis(Upstash) 等の外部ストアへ移行する。

const buckets = new Map<string, number[]>();
const MAX_KEYS = 5000;

export interface RateLimitResult {
  ok: boolean;
  retryAfterSec: number;
}

/**
 * スライディングウィンドウ方式のレート制限。
 * @param key 識別子（例: `reservation:1.2.3.4`）
 * @param limit ウィンドウ内で許可する回数
 * @param windowMs ウィンドウ幅(ミリ秒)
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);

  if (hits.length >= limit) {
    buckets.set(key, hits);
    const retryAfterSec = Math.max(1, Math.ceil((windowMs - (now - hits[0])) / 1000));
    return { ok: false, retryAfterSec };
  }

  hits.push(now);
  buckets.set(key, hits);

  // メモリ肥大の防止（期限切れキーの間引き）
  if (buckets.size > MAX_KEYS) {
    for (const [k, v] of buckets) {
      const alive = v.filter((t) => now - t < windowMs);
      if (alive.length === 0) buckets.delete(k);
      else buckets.set(k, alive);
    }
  }

  return { ok: true, retryAfterSec: 0 };
}

/** リバースプロキシ(Vercel)経由のクライアントIPを取得する */
export function getClientIp(request: Request): string {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return request.headers.get('x-real-ip') ?? 'unknown';
}
