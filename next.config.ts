import type { NextConfig } from "next";

/**
 * 全ページ・全APIに付けるセキュリティヘッダ。
 *
 * Strict-Transport-Security は Vercel が既定で付けているため、ここでは指定しない。
 * （preload を付けると取り消しが難しいため、必要になったら別途検討する）
 */
const securityHeaders = [
  // 管理画面を外部サイトの iframe に埋め込ませない（クリックジャッキング対策）。
  // frame-ancestors が新しい方式で、X-Frame-Options は古いブラウザ向けの保険。
  // このアプリ自身は iframe を一切使っていないため none / DENY で問題ない。
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  // Content-Type を推測させない。名刺ファイルの配信（/api/reservations/[id]/card）で
  // 画像として保存されたファイルがHTMLとして解釈されるのを防ぐ。
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  // 外部サイトへ遷移する際、予約IDを含むURLそのものをリファラとして渡さない。
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  // 使っていないブラウザ機能は明示的に無効化する。
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
];

/**
 * 個人情報・鍵情報を含むページを検索エンジンに載せない。
 *
 * 予約照会ページ（/broker/reservation/<予約ID>）はログイン不要で開ける設計なので、
 * URLが検索結果に出ると推測困難性という唯一の防御が無意味になる。
 * 物件一覧（/broker）は集客に使う余地があるため対象に含めない。
 */
const noIndexHeader = [
  {
    key: "X-Robots-Tag",
    value: "noindex, nofollow",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        source: "/broker/reservation/:path*",
        headers: noIndexHeader,
      },
      {
        source: "/admin/:path*",
        headers: noIndexHeader,
      },
      {
        source: "/api/:path*",
        headers: noIndexHeader,
      },
    ];
  },
};

export default nextConfig;
