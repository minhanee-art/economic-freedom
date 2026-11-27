---
version: 1.0
name: 가족연금계획 (Family Pension Plan)
description: 가족의 연금·배당·매수 기록을 입력받아 세액공제 진행률, 은퇴 시점 현금흐름, 목표 비중과의 차이를 계산해 보여주는 기록·계산 도구. 투자 자문이나 매매 권유를 하지 않는다. 남색 머리띠와 흰 면, 각진 모서리, 한 가지 브랜드 인디고, 표처럼 정렬된 숫자로 '장부' 같은 인상을 만든다. 손익 색은 한국 관습(상승·이익 빨강, 하락·손실 파랑)을 따르고 부호를 항상 함께 쓴다.

colors:
  brand: "#533afd"
  brand-deep: "#4434d4"
  brand-soft: "#665efd"
  brand-dark: "#1c1e54"
  on-brand: "#ffffff"
  ink: "#0d253d"
  ink-mute: "#5f6f88"
  canvas: "#ffffff"
  canvas-soft: "#f6f9fc"
  hairline: "#e3e8ee"
  gain: "#d01f2e"
  gain-soft: "#fdf2f2"
  loss: "#1f5ed6"
  loss-soft: "#eef4fe"
  heat-gain-strong: "#8a1620"
  heat-gain: "#b3202c"
  heat-loss: "#1f55c4"
  heat-loss-strong: "#173e8f"
  danger: "#b42318"
  danger-soft: "#fef3f2"
  danger-line: "#fecdca"
  caution: "#9a3412"
  caution-soft: "#fff7ed"
  success: "#047857"
  chart-target: "#8792a2"
  dark-ink: "#f4f4f5"
  dark-ink-mute: "#a1a1aa"
  dark-canvas: "#09090b"
  dark-surface: "#18181b"
  dark-hairline: "#27272a"
  dark-gain: "#ff7b7b"
  dark-loss: "#6aa6ff"
  dark-danger: "#fda29b"
  dark-caution: "#fbbf24"
  dark-success: "#6ee7b7"

typography:
  title-lg:
    fontFamily: "Pretendard, system-ui, -apple-system, sans-serif"
    fontSize: 24px
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: -0.02em
  title-md:
    fontFamily: "Pretendard, system-ui, -apple-system, sans-serif"
    fontSize: 18px
    fontWeight: 700
    lineHeight: 1.35
    letterSpacing: -0.01em
  title-sm:
    fontFamily: "Pretendard, system-ui, -apple-system, sans-serif"
    fontSize: 14px
    fontWeight: 600
    lineHeight: 1.4
  body-md:
    fontFamily: "Pretendard, system-ui, -apple-system, sans-serif"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.6
  body-sm:
    fontFamily: "Pretendard, system-ui, -apple-system, sans-serif"
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.6
  number-lg:
    fontFamily: "Pretendard, system-ui, -apple-system, sans-serif"
    fontSize: 28px
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: -0.02em
    fontFeature: tnum
  number-md:
    fontFamily: "Pretendard, system-ui, -apple-system, sans-serif"
    fontSize: 14px
    fontWeight: 600
    lineHeight: 1.4
    fontFeature: tnum
  label:
    fontFamily: "Pretendard, system-ui, -apple-system, sans-serif"
    fontSize: 12px
    fontWeight: 500
    lineHeight: 1.4

rounded:
  none: 0px
  surface: 0px
  control: 0px
  app-sm: 8px
  app-md: 12px

spacing:
  xxs: 2px
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  xxl: 32px
  huge: 64px

components:
  header:
    backgroundColor: "{colors.brand-dark}"
    textColor: "{colors.on-brand}"
    typography: "{typography.title-sm}"
    rounded: "{rounded.none}"
    padding: 8px 24px
  panel:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
    rounded: "{rounded.surface}"
    padding: 20px
  button-primary:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.on-brand}"
    typography: "{typography.title-sm}"
    rounded: "{rounded.control}"
    padding: 10px 16px
  button-secondary:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.title-sm}"
    rounded: "{rounded.control}"
    padding: 10px 16px
  button-danger:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.on-brand}"
    typography: "{typography.title-sm}"
    rounded: "{rounded.control}"
    padding: 10px 16px
  text-input:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
    rounded: "{rounded.control}"
    padding: 10px 12px
  pnl-gain:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.gain}"
    typography: "{typography.number-md}"
    rounded: "{rounded.none}"
    padding: 0px
  pnl-loss:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.loss}"
    typography: "{typography.number-md}"
    rounded: "{rounded.none}"
    padding: 0px
  notice-danger:
    backgroundColor: "{colors.danger-soft}"
    textColor: "{colors.danger}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.none}"
    padding: 10px 12px
  notice-caution:
    backgroundColor: "{colors.caution-soft}"
    textColor: "{colors.caution}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.none}"
    padding: 10px 12px
  footer:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink-mute}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.none}"
    padding: 16px 24px
---

## Overview

가족연금계획은 **기록하고 계산하는 도구**다. 사용자가 이미 한 거래(매수·매도·배당 수령·연금 납입)를 적으면, 제품은 그 기록으로 세액공제 진행률, 은퇴 시점 예상 월 현금흐름, 목표 비중과의 차이를 계산해 보여준다. 주문을 실행하지 않고, 종목을 권하지 않으며, 계산은 모두 참고용이다.

그래서 화면의 인상은 **장부**에 가깝다. 남색 머리띠(헤더) 아래 흰 면이 놓이고, 숫자는 표처럼 오른쪽 정렬·고정폭 숫자로 줄을 맞춘다. 장식으로 시선을 끌지 않고, 사용자가 확인하려는 숫자(남은 공제 한도, 목표 대비 월 현금흐름, 손익)가 가장 먼저 읽히게 한다.

- 사용 장면: 30~50대가 월말·연말에 데스크톱이나 폰으로 기록을 넣고 진행 상황을 확인한다. 밝은 실내가 기본이라 라이트 모드가 기준이고, 다크 모드는 같은 토큰의 반대 값으로 지원한다.
- 어조: 사실을 말하고 권하지 않는다. "~하세요(매수 권유)", "추천" 같은 표현은 쓰지 않는다(문구 테스트가 막는다). 주문처럼 읽히는 말 대신 기록 용어를 쓴다: 기록 저장, 기록 금액, 기록 단가, 매도 기록.

## Colors

### 브랜드
- `brand` #533afd — 주 버튼, 현재 선택, 링크, 포커스 링. 한 화면에 채운 주 버튼은 하나가 원칙.
- `brand-dark` #1c1e54 — 헤더 면, 앱 아이콘 배경. 웹과 앱이 같은 값을 쓴다.
- 브랜드 색을 본문 글자색으로 쓰지 않는다(링크 제외).

### 잉크·면 (테마에 따라 바뀜)
| 토큰 | 라이트 | 다크 | 용도 |
|---|---|---|---|
| `ink` | #0d253d | #f4f4f5 | 본문·숫자 |
| `ink-mute` | #5f6f88 | #a1a1aa | 보조 글자(흰 면·canvas-soft 위 4.5:1 이상) |
| `surface` | #ffffff | #18181b | 패널 면 |
| `canvas-soft` | #f6f9fc | #09090b | 페이지 바탕 |
| `hairline` | #e3e8ee | #27272a | 구분선·테두리 |

웹에서는 `--color-ink` 등이 `:root`/`.dark`의 변수를 가리키므로 `text-ink`만 쓰면 다크에서도 읽힌다. 데이터·라벨 글자에 `zinc-400`(흰 바탕 2.6:1)을 쓰지 않는다. 회색 보조 글자는 `zinc-500`(라이트, #696972) / `zinc-400`(다크)이 최소다.

### 손익 — 한국 관습
| 토큰 | 라이트 | 다크 | 뜻 |
|---|---|---|---|
| `gain` | #d01f2e | #ff7b7b | 상승·이익 (빨강) |
| `loss` | #1f5ed6 | #6aa6ff | 하락·손실 (파랑) |
| `gain-soft` / `loss-soft` | #fdf2f2 / #eef4fe | #2a1a1c / #18202e | 옅은 바탕 |
| `heat-gain-strong` … `heat-loss-strong` | #8a1620 #b3202c #1f55c4 #173e8f | 같음 | 히트맵 칸(흰 글자 6.6:1 이상) |

- 손익 숫자에는 **항상** `+`/`-` 부호나 ▲▼를 함께 쓴다. 색만으로 방향을 전하지 않는다.
- 보합(0)은 `ink-mute`.
- 웹 코드에서는 `pnlTextClass(value)`(src/lib/utils.ts)만 쓴다. 화면에서 `emerald`·`red`·`blue`를 손익에 직접 쓰지 않는다.
- 매수·매도 기록 버튼은 손익 색을 쓰지 않는다(매수 기록 = 브랜드, 매도 기록 = 일반 테두리 버튼). 기록은 주문이 아니다.

### 상태 — 손익과 섞지 않는다
| 토큰 | 라이트 | 다크 | 뜻 |
|---|---|---|---|
| `danger` / `danger-soft` / `danger-line` | #b42318 / #fef3f2 / #fecdca | #fda29b / #2b1615 / #7a271a | 삭제·오류·되돌릴 수 없는 작업 |
| `caution` / `caution-soft` | #9a3412 / #fff7ed | #fbbf24 / #2a2010 | 주의: 목표 비중 초과, 예산 초과, 한도 초과, 추정값 |
| `success` | #047857 | #6ee7b7 | "저장했습니다" 같은 상태 문구에만. 숫자에는 쓰지 않는다 |

- 위험·오류의 빨강은 손익의 빨강과 색상이 가깝다. 그래서 **위험은 색 하나로 표시하지 않는다**: 테두리(`danger-line`), 선 아이콘, 무엇이 어떻게 되는지 적은 문구, `role="alert"`를 함께 쓴다. 손익 빨강은 언제나 부호가 붙은 숫자에만 나온다.
- 목표 비중 초과는 손실이 아니다. `caution` 글자 + "초과" 문구로, 부족은 일반 잉크 + "부족" 문구로 표시한다.
- 배당 금액은 수입 기록이지 손익이 아니다. 일반 `ink`, 굵기 600, 고정폭 숫자.

### 차트 색
- 비교 시리즈·자산군은 브랜드 인디고를 첫 색으로, 나머지는 흰 바탕 3:1 이상인 색을 쓴다. 손익과 헷갈리지 않게 시리즈 색에 순수 빨강·파랑을 넣지 않는다.
- 목표 막대·보조선은 `chart-target` #8792a2(3:1 이상) + 점선.

## Typography

- 글꼴은 **Pretendard 하나**. 제목·라벨·본문·숫자를 모두 Pretendard로 쓴다. 종목코드·날짜도 고정폭 글꼴 대신 Pretendard + `tabular-nums`.
- 굵기 규칙: 본문 400, 라벨 500, 소제목·숫자 600, 화면 제목 700. 800/900(`font-black`)은 새로 쓰지 않는다.
- 최소 글자 크기 12px. 10·11px 토큰(`text-2xs`·`text-3xs`)은 없앴다.
- 한글 라벨에 `uppercase`·넓은 자간(`tracking-wide` 등)을 쓰지 않는다. 자간은 제목에서만 -0.01~-0.02em.
- 숫자 열·금액은 `tabular-nums`. 설명문은 줄높이 1.6 이상(`leading-relaxed`).
- 한글은 어절 단위로 줄바꿈한다(`word-break: keep-all`, 전역).

## Money

금액 표기는 세 가지뿐이다. 웹은 `src/lib/utils.ts`의 함수만 쓴다.

| 쓰임 | 형식 | 예 | 웹 함수 |
|---|---|---|---|
| 요약 숫자 (패널 머리, 한 줄 상태, 차트 툴팁) | 억·만원, 만원 단위 반올림 | `1억 6,289만원`, `1,628만원`, `9,500원` | `formatKRW` |
| 표·목록·입력 옆·기록 상세 | 원 단위 전체 + 천 단위 쉼표 | `162,890,500원` | `formatKRWFull` |
| 차트 축 눈금 (자리가 아주 좁을 때만) | 짧은 단위, "원" 생략 | `1.6억`, `450만` | `formatKRWAxis` |

- 방향이 있는 금액(손익, 전일 대비)은 양수에 `+`를 붙인다: `formatSignedKRW`. 음수는 `-`.
- `₩` 기호는 쓰지 않는다. 단위는 숫자 뒤 "원".
- 금액 입력칸은 입력 중에도 천 단위 쉼표를 보여 주고(`formatAmountInput`), 저장할 때는 숫자만 보낸다(`parseAmountInput`). 단위 "원"은 칸 안 오른쪽에 둔다.
- **모바일 앱도 같은 규칙**을 따른다: `mobile/src/utils/format.ts`의 `₩162,890,500` 형식을 위 표에 맞춰 `162,890,500원`(목록·상세)과 `1억 6,289만원`(홈 요약)으로 바꾼다. 반올림은 만원 단위 반올림(`Math.round(abs / 10000)`), 1만원 미만은 원 단위 전체.

## Layout

- 데스크톱 본문 최대 폭 1120px(`max-w-280`), 좌우 여백 16/24px.
- 모바일 폭(768px 미만)은 하단 탭 5개 + 고정 헤더. 본문 하단에 탭 높이만큼 여백을 둔다.
- 패널은 한 겹: 패널 안에 다시 테두리 상자를 겹치지 않는다(구분선이나 여백으로 묶는다).
- 간격은 4px 배수. 같은 묶음 안은 8~12px, 묶음 사이는 20~24px.

## Elevation & Depth

- 그림자는 두 단계뿐: `shadow-card`(0 1px 3px, 8%)와 `shadow-float`(드롭다운·대화상자). 둘 다 블러가 있다.
- 블러 없는 오프셋 블록 그림자, 색 발광(오프셋 0 + 색 그림자), 유리 효과는 쓰지 않는다.
- 테두리와 넓은 그림자를 한 요소에 겹치지 않는다. 패널은 1px `hairline` 테두리 + `shadow-card`까지만.

## Shapes

- **각진 모서리(반경 0)가 제품의 기준 모양이다.** 웹 대시보드의 패널·버튼·입력·칩·막대는 모두 반경 0. `rounded-*` 클래스를 쓰지 않는 것이 기본이고, 의도를 드러낼 때는 토큰 `rounded-surface`/`rounded-control`(둘 다 0)을 쓴다. 예전의 `.dashboard-sharp { border-radius: 0 !important }` 덮어쓰기는 없앴다.
- 공개 페이지(랜딩·로그인·정책)도 같은 각진 모양으로 맞춘다.
- 모바일 앱은 플랫폼 관습상 작은 반경을 허용한다: 버튼·입력 `app-sm` 8px, 카드 `app-md` 12px. 알약 모양은 탭·칩 같은 작은 컨트롤에만.
- 원은 색 점(범례·카테고리 표시)에서도 쓰지 않고 정사각 점을 쓴다.

## Components

- **버튼**: 주 버튼(브랜드 채움, 흰 글자), 보조 버튼(흰 면 + hairline 테두리 + 잉크 글자), 위험 버튼(`danger` 채움 — 확인 대화상자 안에서만). 높이 40~44px, 터치 영역 44px 이상.
- **선택 상태**: 색 1종(브랜드). 칩·토글·탭의 선택은 브랜드 채움 또는 브랜드 테두리. 초록·검정 선택색을 섞지 않는다.
- **입력**: 흰 면, hairline 테두리, 포커스 시 브랜드 링. 라벨은 칸 위에 `<label htmlFor>`로 연결.
- **알림 문구**: 오류는 `danger` 테두리 + 원인과 다시 시도 방법, `role="alert"`. 성공은 `success` 글자 한 줄, `role="status"`.
- **카테고리 표시**: 카드 왼쪽 색 띠 대신 정사각 색 점 + 글자 라벨.
- **아이콘**: 내비와 같은 1.5~2px 선 아이콘(SVG, `aria-hidden`). 이모지를 아이콘으로 쓰지 않는다.
- **확인 대화상자**: 브라우저 `confirm()`·`alert()`·`prompt()`를 쓰지 않는다. 삭제 확인은 `useConfirmDialog`(src/components/dashboard/confirm-dialog.tsx) — 제목에 삭제 대상, 본문에 무엇이 함께 지워지는지, 첫 초점은 '취소', Esc·바깥 클릭으로 닫힘. 실패는 `InlineError`(role=alert, 원인 + 다시 시도).
- **아이콘 버튼**: 보이는 크기와 상관없이 누르는 영역 44×44px, `aria-label`에 대상 이름(예: "2026-11-15 배당 기록 삭제").
- **표**: `th scope`, 화면 낭독용 `caption`, 가로 스크롤 영역에는 이름과 안내.
- **차트**: 래퍼에 요약 `aria-label`, 계열 이름은 한글, 목표·보조 계열은 `chart-target` 점선. 동작 줄이기를 켜면 애니메이션을 끈다. recharts 는 `next/dynamic` 으로 지연 로딩.

## Dark Mode

- 테마는 설정의 라이트/다크/시스템. `<html class="dark">`로 전환하고, 토큰(`ink`, `ink-mute`, `surface`, `hairline`, `gain`, `loss`, `danger`, `caution`, `success`)이 자동으로 다크 값으로 바뀐다.
- 다크 바탕은 `#09090b`(페이지)·`#18181b`(패널). 다크에서도 12px 글자 4.5:1 이상을 지킨다(위 표의 다크 값은 모두 #18181b 위 6.6:1 이상).
- 모바일 앱은 아직 라이트만 지원한다. 다크를 붙일 때 위 표의 다크 값을 그대로 쓴다.

## Shared Values (Web ↔ App)

앱(`mobile/src/styles/theme.ts`)이 맞출 값:

| 앱 토큰 | 값 | 웹 대응 |
|---|---|---|
| `brandDark` | #1c1e54 | `brand-dark` |
| `primary` | #533afd | `brand` |
| `primarySoft` | #f1f0ff | `indigo-50` |
| `ink` | #0d253d | `ink` |
| `inkMuted` | #5f6f88 | `ink-mute` |
| `canvas` | #f6f9fc | `canvas-soft` |
| `surface` | #ffffff | `surface` |
| `line` | #e3e8ee | `hairline` |
| `gain` (기존 `positive`) | #d01f2e | `gain` |
| `loss` (기존 `negative`) | #1f5ed6 | `loss` |
| `danger` | #b42318 | `danger` |
| `caution` (기존 `warning`) | #9a3412 | `caution` |
| `success` | #047857 | `success` |

- 손익 규칙(빨강 상승·파랑 하락·부호 병기), 금액 표기 규칙, 기록 용어, 탭 구성(홈/자산/배당/연금/설정)은 웹과 앱이 같다.
- 앱의 숫자에도 `fontVariant: ["tabular-nums"]`를 쓴다.

## Do's and Don'ts

### Do
- 첫 화면의 첫 숫자는 이 제품만의 것으로: 올해 세액공제 한도 진행률과 남은 금액, 은퇴 시점 예상 월 현금흐름 대 목표.
- 손익 숫자에는 부호나 ▲▼를 항상 붙이고 `gain`/`loss` 토큰만 쓴다.
- 금액은 세 가지 표기(요약·전체·축) 중 하나로만 쓴다.
- 계산 결과 옆에 "참고용" 가정과 계산식을 붙인다.
- 삭제 확인에는 무엇이 지워지고 무엇이 되돌아가는지 적는다.

### Don't
- 그라디언트 면·그라디언트 글자·발광 그림자·유리 효과를 쓰지 않는다.
- 이모지를 아이콘으로 쓰지 않는다.
- 제목 위 작은 배지(eyebrow)·장식용 배지·동기부여 문구를 넣지 않는다.
- '큰 숫자 + 작은 라벨' 지표 타일을 같은 숫자로 두 번 보여주지 않는다.
- 카드 안에 카드를 넣지 않는다.
- 카드 왼쪽 색 띠를 쓰지 않는다(색 점 + 라벨로).
- 한글 라벨에 대문자 변환·넓은 자간을 쓰지 않는다.
- 손익에 초록을 쓰지 않는다.
- 위험을 빨강 색 하나로만 표시하지 않는다(테두리·아이콘·문구를 함께).
- "추천", "매수하세요" 같은 권유 표현, "주문" 같은 실행 용어를 쓰지 않는다.
- 12px보다 작은 글자, 흰 바탕 4.5:1 미만의 데이터 글자를 쓰지 않는다.

## Motion

- 상태 변화(열림·선택·저장 완료)에만 150~250ms 전환. `transition-all` 대신 `transition-colors` 등 필요한 속성만.
- `prefers-reduced-motion: reduce`면 전역에서 전환·애니메이션을 끄고, 차트 진입 애니메이션도 끈다.

## Responsive Behavior

- 기준 폭: 390px(폰), 768px(하단 탭 → 상단 내비 전환은 1024px), 1440px.
- 320px에서도 가로 넘침이 없어야 한다. 입력 행은 `min-w-0` + 줄바꿈.
- 고정 헤더·하단 탭이 포커스된 요소를 가리지 않게 `scroll-padding`을 둔다.
- 터치 대상 44×44px 이상, 대상 사이 8px 이상.
