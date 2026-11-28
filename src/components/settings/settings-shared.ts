// 설정 탭들이 함께 쓰는 도구와 입력칸 모양.
import type { ConfirmOptions } from "@/components/dashboard/confirm-dialog";

/** 표시 이름을 저장하면 window 에 보내는 이벤트(detail = 새 이름 또는 null). 헤더가 듣고 이름을 바꾼다. */
export const DISPLAY_NAME_EVENT = "settings:display-name-saved";

export type SettingsError = { message: string; retry?: () => void };

export interface SettingsTools {
  /** 화면 오른쪽 위 저장 알림 한 줄(2초). role=status 로 읽힌다. */
  flash: (message: string) => void;
  /** 화면 위 InlineError(role=alert). null 이면 닫는다. */
  showError: (error: SettingsError | null) => void;
  /** 삭제 확인 대화상자(useConfirmDialog). */
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

/** 설정 패널 한 장(한 겹 테두리 + shadow-card). */
export const panelClass = "border border-hairline dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-card space-y-3";

/** 일반 입력칸. #main-content 규칙이 16px·44px 을 보장한다. */
export const inputClass =
  "w-full h-11 border border-hairline bg-white transition-colors px-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus:border-brand dark:border-zinc-700 dark:bg-zinc-800";

/** 보조 버튼(흰 면 + hairline + 잉크 글자). */
export const secondaryButtonClass =
  "h-11 border border-hairline bg-surface px-4 text-sm font-semibold text-ink transition-colors hover:bg-canvas-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-60 dark:border-zinc-700";
