import type { TextStyle } from "react-native";

/**
 * 앱 디자인 토큰. 값은 저장소 루트 DESIGN.md 'Shared Values (Web ↔ App)' 표와 같다.
 *
 * - 화면·컴포넌트는 색을 직접 쓰지 않고 `colors.*` 만 쓴다(rgba·hex 리터럴 금지).
 *   다크 모드를 붙일 때 `themes.dark` 를 채우고 `colors` 를 고르는 지점만 바꾸면 되도록 한 곳에 모았다.
 * - 손익은 한국 관습: 상승·이익 = gain(빨강), 하락·손실 = loss(파랑). 숫자에는 항상 부호나 ▲▼ 를 함께 쓴다.
 *   오류·삭제는 danger 로, 손익 빨강과 섞지 않는다(위험은 색 하나로만 표시하지 않고 문구·테두리를 함께 쓴다).
 * 대비(흰 면 기준): ink 15:1, inkMuted 5.1:1(canvas 위 4.8:1), placeholder 4.7:1, caution 5.9:1(cautionSoft 위 5.5:1), gain 5.4:1, loss 5.8:1,
 * danger 6.1:1(dangerSoft 위), disabledInk 5.8:1(disabled 면 위), lineStrong(입력 테두리) 3.2:1.
 */
const light = {
  brandDark: "#1c1e54",
  primary: "#533afd",
  primaryPressed: "#4434d4",
  primarySoft: "#f1f0ff",
  onPrimary: "#ffffff",
  canvas: "#f6f9fc",
  surface: "#ffffff",
  surfaceMuted: "#eef2f6",
  ink: "#0d253d",
  inkMuted: "#5f6f88",
  placeholder: "#66748a",
  line: "#e3e8ee",
  lineStrong: "#8792a2",
  gain: "#d01f2e",
  gainSoft: "#fdf2f2",
  loss: "#1f5ed6",
  lossSoft: "#eef4fe",
  danger: "#b42318",
  dangerSoft: "#fef3f2",
  dangerLine: "#fecdca",
  // 호박색: 손익 빨강(gain)·위험 빨강(danger)과 색상이 겹치지 않게(웹 caution 과 같은 값으로 맞춘다)
  caution: "#8a5a00",
  cautionSoft: "#fdf6e3",
  success: "#047857",
  disabled: "#e3e8ee",
  disabledInk: "#4a5870",
  /** 막대 차트의 빈 트랙·목표 보조선 */
  track: "#eef2f6",
  /** 안드로이드 눌림 물결(ripple) */
  ripple: "#d9dee8",
  rippleOnPrimary: "#7a66fe",
  /** 떠 있는 말풍선(InfoTip)의 그림자 — ink 16% */
  shadow: "#0d253d29",
};

export type ThemeColors = typeof light;

export const themes: { light: ThemeColors } = { light };

/** 지금은 라이트만 지원한다(app.json userInterfaceStyle: light). */
export const colors: ThemeColors = themes.light;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

/** 웹 대시보드는 반경 0. 앱은 플랫폼 관습상 작은 반경만 쓴다(DESIGN.md Shapes: app-sm 8, app-md 12). 알약은 칩에만. */
export const radius = {
  sm: 8,
  md: 12,
  pill: 999,
};

/** 터치 대상 최소 크기(iOS 44pt, Android 48dp 중 작은 값을 바닥으로). */
export const touchTarget = 44;

/** 태블릿·가로 화면에서 본문 최대 폭. */
export const contentMaxWidth = 560;

const tabular: TextStyle["fontVariant"] = ["tabular-nums"];

/**
 * 글자 스타일 6종. 굵기: 본문 400, 라벨 500, 소제목·숫자 600, 화면 제목 700(800·900 은 쓰지 않는다). 최소 12.
 * 금액·수량·날짜에는 number / numberLg 를 쓴다(고정폭 숫자).
 */
export const type = {
  title: { fontSize: 22, lineHeight: 30, fontWeight: "700", letterSpacing: -0.3, color: colors.ink },
  heading: { fontSize: 17, lineHeight: 24, fontWeight: "600", color: colors.ink },
  body: { fontSize: 15, lineHeight: 22, fontWeight: "400", color: colors.ink },
  label: { fontSize: 13, lineHeight: 18, fontWeight: "500", color: colors.inkMuted },
  caption: { fontSize: 12, lineHeight: 18, fontWeight: "400", color: colors.inkMuted },
  numberLg: { fontSize: 28, lineHeight: 34, fontWeight: "600", letterSpacing: -0.4, color: colors.ink, fontVariant: tabular },
  number: { fontSize: 15, lineHeight: 22, fontWeight: "600", color: colors.ink, fontVariant: tabular },
} satisfies Record<string, TextStyle>;
