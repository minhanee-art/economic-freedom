// InfoTip — 제목·라벨 옆 ⓘ 버튼 + 말풍선 안내. EmojiLine — 이모지 그림 + 글자 한 줄(목록용).
// 사용 예:
//   <h2 className="…">기간별 수익률 <InfoTip label="기간별 수익률 설명">매수 기록 기준 원가로 계산한 참고용 값입니다.</InfoTip></h2>
//   <p>…문장 안에도 <InfoTip label="세액공제 한도 설명" align="end">연금저축 600만원, IRP 합산 900만원.</InfoTip> 넣을 수 있다.</p>
//   <EmojiList><EmojiLine emoji="🧾">세액공제 한도 채우기</EmojiLine><EmojiLine emoji="💸">배당 기록하기</EmojiLine></EmojiList>
//   <EmojiLine as="p" emoji="📅" size="sm" tone="mute">등록한 배당 일정이 없습니다.</EmojiLine>  (글자·색은 size/tone 으로, className 은 margin 만)
//   가운데 정렬: <EmojiLine as="p" emoji="🌴" align="center">…</EmojiLine>  (className="justify-center" 대신 align="center")
// InfoTip 의 children 은 span 안에 들어가므로 글·<strong>·<br /> 같은 인라인 요소만 쓴다(<p>·<ul> 금지). 1~3문장.
// 동작: 누르면 열림/다시 누르면 닫힘(터치), 마우스 호버·키보드 포커스로도 열림, Esc·바깥 누르기로 닫힘.
// 말풍선은 Popover API(top layer)로 띄워 부모의 overflow-hidden·sticky 헤더에 잘리지 않고, 열릴 때 화면 안으로 좌표를 맞춘다.
"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";

type OpenMode = "click" | "hover" | "focus";

const VIEWPORT_GAP = 8; // 화면 가장자리와 말풍선 사이 최소 여백(px)
const BUBBLE_MAX = 288; // 18rem
const OFFSET = 6; // 아이콘과 말풍선 사이(px)
const HOVER_CLOSE_DELAY = 200;

// 한 번에 말풍선 하나만 연다 — 새로 열리면 앞서 열린 것을 닫는다.
let closeActiveTip: (() => void) | null = null; // 버튼 → 말풍선으로 마우스를 옮기는 동안 닫히지 않게

export function InfoTip({
  label,
  children,
  align = "center",
  className = "",
}: {
  /** 버튼의 aria-label. 무엇에 대한 설명인지(예: "기간별 수익률 설명"). */
  label: string;
  /** 말풍선 내용(인라인 요소만). */
  children: ReactNode;
  /** 말풍선의 가로 기준. start = 아이콘 왼쪽에 맞춰 오른쪽으로, end = 아이콘 오른쪽에 맞춰 왼쪽으로. 어느 쪽이든 화면 밖으로 나가면 안으로 당긴다. */
  align?: "start" | "center" | "end";
  className?: string;
}) {
  const id = useId();
  const bubbleId = `${id}-tip`;
  const [mode, setMode] = useState<OpenMode | null>(null);
  const open = mode !== null;
  const wrapRef = useRef<HTMLSpanElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const bubbleRef = useRef<HTMLSpanElement>(null);
  const arrowTopRef = useRef<HTMLSpanElement>(null);
  const arrowBottomRef = useRef<HTMLSpanElement>(null);
  const closeTimer = useRef<number | null>(null);
  const suppressFocusOpen = useRef(false);

  const clearCloseTimer = useCallback(() => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const place = useCallback(() => {
    const button = buttonRef.current;
    const bubble = bubbleRef.current;
    if (!button || !bubble) return;
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    bubble.style.maxWidth = `${Math.min(BUBBLE_MAX, vw - VIEWPORT_GAP * 2)}px`;
    const b = button.getBoundingClientRect();
    // 보이는 아이콘(16px) 기준으로 붙인다 — 버튼은 44px 이지만 음수 margin 으로 겹쳐 있다.
    const cx = b.left + b.width / 2;
    const cy = b.top + b.height / 2;
    const iconHalf = 8;
    const w = bubble.offsetWidth;
    const h = bubble.offsetHeight;
    let left = align === "start" ? cx - iconHalf - 4 : align === "end" ? cx + iconHalf + 4 - w : cx - w / 2;
    left = Math.max(VIEWPORT_GAP, Math.min(left, vw - VIEWPORT_GAP - w));
    const below = cy + iconHalf + OFFSET;
    const above = cy - iconHalf - OFFSET - h;
    const side: "bottom" | "top" = below + h <= vh - VIEWPORT_GAP || above < VIEWPORT_GAP ? "bottom" : "top";
    bubble.style.left = `${Math.round(left)}px`;
    bubble.style.top = `${Math.round(side === "bottom" ? below : above)}px`;
    const arrowX = `${Math.round(Math.max(10, Math.min(cx - left, w - 10)) - 5)}px`;
    if (arrowTopRef.current) {
      arrowTopRef.current.hidden = side !== "bottom";
      arrowTopRef.current.style.left = arrowX;
    }
    if (arrowBottomRef.current) {
      arrowBottomRef.current.hidden = side !== "top";
      arrowBottomRef.current.style.left = arrowX;
    }
  }, [align]);

  // 열릴 때: top layer 에 올리고(지원 브라우저) 화면 안으로 좌표를 맞춘다. 칠하기 전에 끝내 깜빡임이 없다.
  useLayoutEffect(() => {
    if (!open) return;
    const close = () => setMode(null);
    if (closeActiveTip) closeActiveTip();
    closeActiveTip = close;
    const release = () => {
      if (closeActiveTip === close) closeActiveTip = null;
    };
    const bubble = bubbleRef.current;
    if (!bubble) return release;
    if (typeof bubble.showPopover === "function" && !bubble.matches(":popover-open")) {
      try {
        bubble.showPopover();
      } catch {
        // 이미 열렸거나 연결이 끊긴 경우 — fixed + z-index 로도 보인다.
      }
    }
    place();
    return release;
  }, [open, place]);

  // 열린 동안: 스크롤·크기 변화·위쪽 내용이 늦게 불러와져 버튼이 밀린 경우에도 다시 맞추고, Esc·바깥 누르기로 닫는다.
  useEffect(() => {
    if (!open) return;
    const onReposition = () => place();
    // 버튼 위치가 바뀌었을 때만 다시 맞춘다(열린 말풍선 하나만 도는 가벼운 확인).
    let frame = 0;
    let last = "";
    const follow = () => {
      const r = buttonRef.current?.getBoundingClientRect();
      const key = r ? `${Math.round(r.left)},${Math.round(r.top)}` : "";
      if (key !== last) {
        last = key;
        place();
      }
      frame = requestAnimationFrame(follow);
    };
    frame = requestAnimationFrame(follow);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setMode(null);
      // 초점이 말풍선 안에 있었다면 버튼으로 돌린다(버튼에 있으면 그대로 둔다 — 다시 열리지 않게).
      const active = document.activeElement;
      if (active && active !== buttonRef.current && bubbleRef.current?.contains(active)) {
        suppressFocusOpen.current = true;
        buttonRef.current?.focus();
      }
    };
    const onPointerDown = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setMode(null);
    };
    window.addEventListener("scroll", onReposition, true);
    window.addEventListener("resize", onReposition);
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onReposition, true);
      window.removeEventListener("resize", onReposition);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open, place]);

  useEffect(() => clearCloseTimer, [clearCloseTimer]);

  const onPointerEnter = (e: ReactPointerEvent) => {
    if (e.pointerType !== "mouse") return;
    clearCloseTimer();
    setMode((m) => m ?? "hover");
  };
  const onPointerLeave = (e: ReactPointerEvent) => {
    if (e.pointerType !== "mouse") return;
    clearCloseTimer();
    closeTimer.current = window.setTimeout(() => {
      setMode((m) => (m === "hover" ? null : m));
    }, HOVER_CLOSE_DELAY);
  };

  return (
    <span
      ref={wrapRef}
      className={`relative ml-1 inline-flex items-center align-middle ${className}`}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={bubbleId}
        onClick={() => {
          clearCloseTimer();
          // 클릭으로 연 것만 클릭으로 닫는다. 호버·포커스로 열려 있던 것은 클릭하면 고정된다.
          setMode((m) => (m === "click" ? null : "click"));
        }}
        onFocus={(e) => {
          if (suppressFocusOpen.current) {
            suppressFocusOpen.current = false;
            return;
          }
          if (e.currentTarget.matches(":focus-visible")) setMode((m) => m ?? "focus");
        }}
        onBlur={() => setMode((m) => (m === "focus" ? null : m))}
        className="-m-3.5 inline-flex size-11 min-h-11 min-w-11 shrink-0 items-center justify-center text-ink-mute transition-colors hover:text-brand focus-visible:text-brand focus-visible:outline-2 focus-visible:-outline-offset-8 focus-visible:outline-brand aria-expanded:text-brand"
      >
        <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="8" cy="8" r="6.75" />
          <path d="M8 7.25v4" strokeLinecap="round" />
          <circle cx="8" cy="4.9" r="0.6" fill="currentColor" stroke="none" />
        </svg>
      </button>
      {open && (
        <span
          ref={bubbleRef}
          id={bubbleId}
          popover="manual"
          className="fixed inset-auto z-60 m-0 block w-max overflow-visible border border-hairline bg-surface px-3 py-2 text-left text-xs font-normal leading-relaxed text-ink normal-case shadow-float transition duration-150 ease-out starting:translate-y-1 starting:opacity-0 motion-reduce:transition-none dark:border-zinc-700"
        >
          <span
            ref={arrowTopRef}
            aria-hidden="true"
            className="absolute -top-1.5 block size-2.5 rotate-45 border-l border-t border-hairline bg-surface dark:border-zinc-700"
          />
          <span
            ref={arrowBottomRef}
            aria-hidden="true"
            hidden
            className="absolute -bottom-1.5 block size-2.5 rotate-45 border-b border-r border-hairline bg-surface dark:border-zinc-700"
          />
          <span className="relative block">{children}</span>
        </span>
      )}
    </span>
  );
}

const EMOJI_LINE_SIZE = { inherit: "", sm: "text-sm leading-relaxed", xs: "text-xs leading-relaxed" } as const;
const EMOJI_LINE_TONE = {
  inherit: "",
  ink: "text-ink",
  mute: "text-ink-mute",
  success: "font-semibold text-success",
} as const;

/**
 * 이모지 그림 + 글자 한 줄. 이모지는 aria-hidden, 뜻은 글자가 전한다. 기본은 `li`(EmojiList 안에서 쓴다).
 * 글자 크기·색은 size·tone 으로 고른다(className 에는 margin 같은 배치만 — design lint 의 no-restyle).
 * 기본값 inherit 은 부모(EmojiList 등)의 글자 크기·색을 그대로 쓴다.
 */
export function EmojiLine({
  emoji,
  children,
  as: Tag = "li",
  size = "inherit",
  tone = "inherit",
  align = "start",
  className = "",
}: {
  emoji: string;
  children: ReactNode;
  as?: "li" | "p" | "div" | "span";
  size?: keyof typeof EMOJI_LINE_SIZE;
  tone?: keyof typeof EMOJI_LINE_TONE;
  /** start = 왼쪽 정렬(글자가 남은 폭을 채움), center = 이모지+글자 묶음을 가운데로 */
  align?: "start" | "center";
  className?: string;
}) {
  const center = align === "center";
  return (
    <Tag className={`flex min-w-0 items-baseline gap-2 ${center ? "justify-center text-center" : ""} ${EMOJI_LINE_SIZE[size]} ${EMOJI_LINE_TONE[tone]} ${className}`}>
      <span aria-hidden="true" className="w-5 shrink-0 text-center">
        {emoji}
      </span>
      <span className={center ? "min-w-0" : "min-w-0 flex-1"}>{children}</span>
    </Tag>
  );
}

/** EmojiLine 묶음(ul). 줄 사이 8px, 기본 14px·ink. size="xs"·tone="mute" 로 작게·흐리게. */
export function EmojiList({
  children,
  size = "sm",
  tone = "ink",
  className = "",
}: {
  children: ReactNode;
  size?: "sm" | "xs";
  tone?: "ink" | "mute";
  className?: string;
}) {
  return <ul className={`space-y-2 ${EMOJI_LINE_SIZE[size]} ${EMOJI_LINE_TONE[tone]} ${className}`}>{children}</ul>;
}
