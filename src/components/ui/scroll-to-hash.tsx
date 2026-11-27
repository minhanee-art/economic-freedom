// 주소의 #id 로 이동 — 내용이 그려진 뒤 한 번 맞춘다.
// 홈 첫 사용 안내의 링크(/dashboard/retirement#account-types 등)는 대상 카드가 화면 아래쪽에 있어,
// 이동 시점에 아직 그려지지 않으면 브라우저·라우터의 기본 해시 이동이 맨 위에 멈춘다.
"use client";

import { useEffect } from "react";

export function ScrollToHash() {
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (!id) return;
    const frame = requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: "start" }));
    return () => cancelAnimationFrame(frame);
  }, []);
  return null;
}
