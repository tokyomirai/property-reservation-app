'use client';

// 横スクロールする一覧表を包み、ビューポート下端に追従する横スクロールバーを表示する。
// - 一覧の途中を縦に見ていても、画面下部の横スクロールバーで左右に動かせる（最下部まで移動不要）
// - 表本体の横スクロール位置と完全同期
// - 表本来の下端スクロールバーが画面内に見えているときは追従バーを出さない（二重表示の防止）
// - 横にはみ出していないとき／スマホ幅では出さない（悪影響防止）
// 縦スクロール・列幅・上部固定表示など既存レイアウトは一切変更しない。

import { useRef, useEffect, useState, type ReactNode } from 'react';

export default function StickyHScroll({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null); // 実際の横スクロール領域（表を包む）
  const proxyRef = useRef<HTMLDivElement>(null); // 画面下端に追従する代理スクロールバー
  const innerRef = useRef<HTMLDivElement>(null); // 代理バーの中身（表と同じ幅にする）
  const lastRef = useRef({ left: 0, width: 0, visible: false });
  const [box, setBox] = useState({ left: 0, width: 0, visible: false });

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    // 位置・表示可否を測って必要なときだけ再描画する（scroll毎の無駄な再描画を避ける）。
    // requestAnimationFrame に依存せず scroll ハンドラ内で直接測るため、
    // 表本来の下端バーが見えたら確実に代理バーを隠せる（二重表示の防止）。
    const measure = () => {
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const overflow = el.scrollWidth - el.clientWidth > 1;
      const inView = rect.top < vh && rect.bottom > 0;
      // 表本来の下端スクロールバー（＝コンテナ下端）が画面内に見えているか
      const nativeBarVisible = rect.bottom <= vh;
      const isNarrow = window.innerWidth < 768; // スマホは従来のスワイプ操作に任せる
      const visible = overflow && inView && !nativeBarVisible && !isNarrow;

      if (innerRef.current) innerRef.current.style.width = `${el.scrollWidth}px`;
      if (proxyRef.current) proxyRef.current.scrollLeft = el.scrollLeft;

      const left = Math.max(0, rect.left);
      const width = el.clientWidth;
      const prev = lastRef.current;
      if (prev.left !== left || prev.width !== width || prev.visible !== visible) {
        lastRef.current = { left, width, visible };
        setBox({ left, width, visible });
      }
    };

    // 表本体をスクロール → 代理バーへ反映（横位置は変わらないので再測定不要）
    const onContainerScroll = () => {
      if (proxyRef.current) proxyRef.current.scrollLeft = el.scrollLeft;
    };

    measure();
    el.addEventListener('scroll', onContainerScroll, { passive: true });
    window.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure);
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);

    return () => {
      el.removeEventListener('scroll', onContainerScroll);
      window.removeEventListener('scroll', measure);
      window.removeEventListener('resize', measure);
      ro.disconnect();
    };
  }, []);

  // 代理バーをスクロール → 表本体へ反映（位置を完全同期）
  const onProxyScroll = () => {
    if (scrollRef.current && proxyRef.current) {
      scrollRef.current.scrollLeft = proxyRef.current.scrollLeft;
    }
  };

  return (
    <>
      <div ref={scrollRef} className={className}>
        {children}
      </div>
      <div
        ref={proxyRef}
        onScroll={onProxyScroll}
        aria-hidden="true"
        className="sticky-hscroll-proxy"
        style={{
          position: 'fixed',
          bottom: 0,
          left: box.left,
          width: box.width,
          overflowX: 'scroll',
          overflowY: 'hidden',
          zIndex: 35,
          display: box.visible ? 'block' : 'none',
          background: 'rgba(248,250,252,0.96)',
          borderTop: '1px solid rgb(226,232,240)',
        }}
      >
        <div ref={innerRef} style={{ height: 1 }} />
      </div>
    </>
  );
}
