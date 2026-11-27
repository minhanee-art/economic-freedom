/**
 * Expo 웹 타깃(스모크·스토어 스크린샷 촬영에 쓰는 렌더) 전용:
 * - 문서 언어를 한국어로(스크린리더 발음·하이픈 처리)
 * - 한글을 어절 단위로 줄바꿈(word-break: keep-all) — 웹 DESIGN.md Typography 와 같은 규칙.
 *   긴 영문·숫자는 넘치지 않게 overflow-wrap 으로 끊는다.
 */
export function setupWebDocument(): void {
  if (typeof document === "undefined") return;
  document.documentElement.lang = "ko";
  if (document.getElementById("app-text-wrap")) return;
  const style = document.createElement("style");
  style.id = "app-text-wrap";
  style.textContent = "body, body * { word-break: keep-all; overflow-wrap: break-word; }";
  document.head.appendChild(style);
}
