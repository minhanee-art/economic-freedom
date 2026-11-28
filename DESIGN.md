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
  heat-flat: "#6b6b73"
  danger: "#b42318"
  danger-soft: "#fef3f2"
  danger-line: "#fecdca"
  caution: "#8a5a00"
  caution-soft: "#fdf6e3"
  success: "#047857"
  chart-target: "#8792a2"
  dark-ink: "#f4f4f5"
  dark-ink-mute: "#a1a1aa"
  dark-canvas: "#09090b"
  dark-surface: "#18181b"
  dark-hairline: "#27272a"
  dark-gain: "#ff7b7b"
  dark-loss: "#6aa6ff"
  dark-heat-gain-strong: "#ff8f8f"
  dark-heat-gain: "#d23a36"
  dark-heat-flat: "#6b6b73"
  dark-heat-loss: "#3567d6"
  dark-heat-loss-strong: "#7db2ff"
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
  input:
    fontFamily: "Pretendard, system-ui, -apple-system, sans-serif"
    fontSize: 16px
    fontWeight: 400
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
| `heat-gain-strong` / `heat-gain` | #8a1620 / #b3202c | #ff8f8f / #d23a36 | 히트맵 상승 칸(+10% 이상 / +0.5%~+10%) |
| `heat-loss` / `heat-loss-strong` | #1f55c4 / #173e8f | #3567d6 / #7db2ff | 히트맵 하락 칸(-0.5%~-10% / -10% 이하) |
| `heat-flat` | #6b6b73 | #6b6b73 | 히트맵 보합 칸·원가 없음·기타 칸. 손익 색과 섞이지 않는 중립 회색 |
| `heat-on` / `heat-on-strong` | #ffffff / #ffffff | #ffffff / #18181b | 히트맵 칸 글자(보통·보합 칸 / 강한 칸) |

- **히트맵 칸 색의 원칙**: 라이트는 강할수록 **진하게**(흰 바탕에서 멀수록 강함, 글자는 모두 흰색 — 흰 글자 5.3:1 이상). 다크는 강할수록 **밝게**(바탕 #18181b 에서 멀수록 강함). 다크에서 흰 글자를 유지하면 바탕 3:1 과 글자 4.5:1 을 함께 만족하는 밝기 폭이 좁아 강·약을 나눌 수 없으므로, 다크의 강한 칸은 `gain`/`loss` 글자색 계열의 밝은 색에 어두운 글자(#18181b)를 쓴다.
- 다크 대비(바탕 #18181b / 칸 글자): +10% 이상 8.1 / 8.1, 상승 3.7 / 4.8(흰), 보합 3.4 / 5.3(흰), 하락 3.4 / 5.2(흰), -10% 이하 8.2 / 8.2. 강한 칸과 보통 칸은 밝기(CIELAB L* 약 71 대 47)로 나뉘고, 적록·청황 색각 이상 흉내에서도 상승은 노랑·갈색 쪽, 하락은 파랑·청록 쪽으로 남아 서로 뒤바뀌지 않는다.

- 손익 숫자에는 **항상** `+`/`-` 부호나 ▲▼를 함께 쓴다. 색만으로 방향을 전하지 않는다.
- 보합(0)은 `ink-mute`.
- 웹 코드에서는 `pnlTextClass(value)`(src/lib/utils.ts)만 쓴다. 화면에서 `emerald`·`red`·`blue`를 손익에 직접 쓰지 않는다.
- 매수·매도 기록 버튼은 손익 색을 쓰지 않는다(매수 기록 = 브랜드, 매도 기록 = 일반 테두리 버튼). 기록은 주문이 아니다.

### 상태 — 손익과 섞지 않는다
| 토큰 | 라이트 | 다크 | 뜻 |
|---|---|---|---|
| `danger` / `danger-soft` / `danger-line` | #b42318 / #fef3f2 / #fecdca | #fda29b / #2b1615 / #7a271a | 삭제·오류·되돌릴 수 없는 작업 |
| `caution` / `caution-soft` | #8a5a00 / #fdf6e3 | #fbbf24 / #2a2010 | 주의: 목표 비중 초과, 예산 초과, 한도 초과, 추정값 |
| `success` | #047857 | #6ee7b7 | "저장했습니다" 같은 상태 문구에만. 숫자에는 쓰지 않는다 |

- 위험·오류의 빨강은 손익의 빨강과 색상이 가깝다. 그래서 **위험은 색 하나로 표시하지 않는다**: 테두리(`danger-line`), 선 아이콘, 무엇이 어떻게 되는지 적은 문구, `role="alert"`를 함께 쓴다. 손익 빨강은 언제나 부호가 붙은 숫자에만 나온다.
- `caution`은 **호박색**(색상 약 40°)이다. 손익 빨강(`gain`, 약 355°)·위험 빨강(`danger`, 약 4°)과 색상으로 구분되게 고른 값이고, 라이트 #8a5a00은 흰 면 5.9:1, `canvas-soft` 5.6:1, `caution-soft` 5.5:1로 12px 글자 기준을 넘는다. 다크 #fbbf24도 `dark-gain` #ff7b7b와 색상이 다르다.
- 목표 비중 초과는 손실이 아니다. `caution` 글자 + "초과" 문구로, 부족은 일반 잉크 + "부족" 문구로 표시한다. 차이는 `+`/`-` 부호 대신 말로 적는다: "초과 49.4%p", "부족 3.0%p"(`formatTargetGap`). 부호는 손익에만 쓴다.
- 은퇴 목표 대비 부족액, 예산 잔액처럼 손익이 아닌 금액은 `ink`로 적고 열 이름이나 "부족" 문구로 뜻을 전한다. 빨강·파랑을 쓰지 않는다.
- 배당 금액은 수입 기록이지 손익이 아니다. 일반 `ink`, 굵기 600, 고정폭 숫자.

### 차트 색
- 비교 시리즈·자산군은 브랜드 인디고를 첫 색으로, 나머지는 흰 바탕 3:1 이상인 색을 쓴다. 손익과 헷갈리지 않게 시리즈 색에 순수 빨강·파랑을 넣지 않는다.
- 목표 막대·보조선은 `chart-target` #8792a2(3:1 이상) + 점선.

## Typography

- 글꼴은 **Pretendard 하나**. 제목·라벨·본문·숫자를 모두 Pretendard로 쓴다. 종목코드·날짜도 고정폭 글꼴 대신 Pretendard + `tabular-nums`.
- 굵기 규칙: 본문 400, 라벨 500, 소제목·숫자 600, 화면 제목 700. 800/900(`font-black`)은 새로 쓰지 않는다.
- 최소 글자 크기 12px. 10·11px 토큰(`text-2xs`·`text-3xs`)은 없앴다.
- 입력칸(input·select·textarea) 글자는 16px(`input` 토큰). iOS 가 포커스 때 화면을 확대하지 않는 크기다. 대시보드는 `globals.css`의 `#main-content` 규칙이 개별 유틸리티보다 우선해 16px·높이 44px을 보장한다.
- 홈 한 줄 상태의 핵심 숫자(남은 세액공제 한도, 은퇴 시점 예상 월 현금흐름)는 `number-lg` 28px(`text-number-lg`)로 화면에서 가장 큰 숫자다. 총 평가금액은 그 아래 위계(24px).
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

- 방향이 있는 금액(손익, 전일 대비)은 양수에 `+`를 붙인다: `formatSignedKRW`. 음수는 `-`. 손익 금액은 앱과 같이 ▲▼를 앞에 함께 쓴다: `formatPnlKRW`(`▲ +10만원`, `▼ -1,663만원`, 보합은 화살표 없음).
- 원가(매수 기록)가 없으면 손익은 `+0원/+0.00%` 대신 `-`, 값이 0인 설정(월 적립금 등)은 `미설정`으로 쓴다.
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
- **아이콘**: 내비와 같은 1.5~2px 선 아이콘(SVG, `aria-hidden`). 내비게이션·버튼·아이콘 버튼의 아이콘 자리는 언제나 SVG 선 아이콘이고 이모지로 바꾸지 않는다(이모지는 아래 '이모지 줄'에서만).
- **InfoTip(말풍선 안내)**: 화면을 쓰는 데 꼭 필요하지 않은 보충 설명(계산 가정, 용어 풀이, 화면 사용법)은 항상 보이는 회색 문단 대신 제목·라벨 옆 ⓘ 선 아이콘 버튼의 말풍선으로 둔다(`InfoTip`, src/components/ui/info-tip.tsx — 사용 예는 파일 머리 주석).
  - 버튼: `aria-label`(무엇에 대한 설명인지, 예: "기간별 수익률 설명")·`aria-expanded`·`aria-controls`, 보이는 아이콘 16px·누르는 영역 44×44px(음수 margin 으로 줄 높이를 밀지 않는다), 포커스는 아이콘에 붙은 24px 브랜드 윤곽선(앞뒤 글자를 덮지 않는다). 말풍선은 DOM 에서 버튼 바로 뒤에 있어 화면 낭독기로 이어 읽힌다.
  - 동작: 누르면 열리고 다시 누르면 닫힌다(터치). 마우스 호버·키보드 포커스로도 열리고, 버튼에서 말풍선으로 마우스를 옮겨도 닫히지 않는다. Esc·바깥 누르기로 닫히고 초점은 버튼에 남는다.
  - 모양: 각진 모서리, `surface` 면 + `hairline` 테두리 + `shadow-float`, 12px 글자·줄높이 1.6, 최대 폭 18rem(폰에서는 화면 폭 - 16px), 꼬리 삼각형. Popover API(top layer)로 띄워 부모의 `overflow-hidden`·고정 헤더·차트에 가리지 않고, 열릴 때 화면 안으로 좌표를 맞춘다. 세로는 `side="bottom"`(기본)·`"top"` — 숫자를 설명하는 ⓘ 는 `top` 으로 열어 설명 대상 숫자를 가리지 않는다. 고른 쪽 공간이 모자라면 반대쪽으로 연다. 가로 기준은 `align="start" | "center" | "end"`.
  - 등장은 opacity·transform 150ms, 움직임 줄이기에서는 끈다.
  - ⓘ 는 세로로 44px 보다 촘촘히 쌓지 않는다. 목록 항목마다 ⓘ 를 붙이지 말고, 보충 설명은 항목의 한 줄 설명에 합친다. 처음 읽는 화면(랜딩)은 ⓘ 를 되도록 쓰지 않는다.
  - 말풍선 문구는 1~3문장. 원문을 그대로 붓지 않는다. 오류 문구·삭제 확인 내용·"참고용" 표시처럼 꼭 보여야 하는 정보는 말풍선에 숨기지 않는다.
  - **앱**: `mobile/src/components/InfoTip.tsx`. 아이콘은 expo-symbols(iOS `info.circle`, Android·웹 Material `info`), 보이는 16·누르는 영역 44×44(음수 margin), `accessibilityState.expanded`. 말풍선은 `Modal`(투명) 위에 버튼의 `measureInWindow` 좌표로 붙여 ScrollView·카드에 잘리지 않고 화면 안(가장자리 8)으로 당긴다. 화면 전체를 덮는 투명 바탕이 있어 다시 누르기·바깥 누르기가 닫기이고(그래서 한 번에 하나), 안드로이드 뒤로 가기·웹 Esc 는 `onRequestClose`. 열리면 네이티브는 `announceForAccessibility`, 웹은 `aria-live` 로 내용을 읽는다.
  - 앱은 호버·포커스로 열지 않고 누르기만 쓴다. 모양은 반경 8(`radius.sm`)·`lineStrong` 테두리·글자 13. 넣는 자리는 `Card` 의 `info`, `TextField` 의 `info`(칸 아래 helper 대신), `Notice` 의 `info`(핵심 한 문장만 보이고 이유는 말풍선), `EmojiLine` 의 `trailing` — 뒤의 두 줄은 높이 44 이상이라 ⓘ 가 촘촘히 쌓이지 않는다.
- **이모지 줄**: 여러 문장으로 풀어 쓴 안내·빈 상태·단계 설명은 "이모지 한 개 + 짧은 한 줄(20자 안팎)" 목록으로 바꿔 훑어보게 한다(`EmojiList` + `EmojiLine`, src/components/ui/info-tip.tsx).
  - 이모지는 설명을 대신하는 **그림**이다. 항상 `<span aria-hidden="true">`로 감싸고 바로 옆에 글자 라벨을 둔다(이모지 혼자 뜻을 전하지 않는다).
  - 내용에 맞는 것으로: 연금·저축 🏦💰, 세액공제 🧾, 배당 💸, 은퇴 🌴, 자녀·증여 🎁👶, 리밸런싱 ⚖️, 일정 📅, 알림 🔔, 주의 ⚠️.
  - 한 줄에 1개, 제목(h1/h2)과 누르는 제목(`<summary>`·접기 버튼)에는 넣지 않는다. 한 문장을 이모지 여러 줄로 쪼개지 않는다.
  - 뜻이 맞을 때만 쓴다. 같은 이모지를 뜻이 다른 항목에 다시 쓰지 않는다(예: 📅 는 날짜·일정에만).
  - **앱**: 같은 파일의 `EmojiLine`(이모지 `Text` 는 `accessibilityElementsHidden`·`importantForAccessibility="no"`·`aria-hidden`)과 `EmojiList`(줄 사이 8). 글자는 `size="body"`(15)·`"sm"`(13), `tone="mute"`(기본)·`"ink"`. 빈 상태 `EmptyHoldings` 도 이모지 한 줄이다.
  - 가운데 정렬은 `align="center"`, 글자 크기·색은 `size`·`tone`(호출부 className 의 크기·색 클래스가 있으면 그것이 이긴다). 손익(▲▼, `gain`/`loss`)·위험 표시 자리에는 쓰지 않는다. 설명을 실제로 대체하는 곳에만 쓰고 장식으로 뿌리지 않는다.
- **확인 대화상자**: 브라우저 `confirm()`·`alert()`·`prompt()`를 쓰지 않는다. 삭제 확인은 `useConfirmDialog`(src/components/dashboard/confirm-dialog.tsx) — 제목에 삭제 대상, 본문에 무엇이 함께 지워지는지, 첫 초점은 '취소', Esc·바깥 클릭으로 닫힘. 실패는 `InlineError`(role=alert, 원인 + 다시 시도).
- **빈 상태**: 화면 제목(h1)은 화면 이름 그대로 두고, "아직 종목이 없습니다" 같은 빈 상태 문구는 그 아래 h2 와 본문으로 쓴다(`NoHoldingsState`의 `pageTitle`).
- **필수 칸이 빈 제출 버튼**: 입력 전부터 비활성으로 두지 않는다. 요청 중에만 비활성, 누르면 빠진 칸 이름을 알려 준다(`missingFields`).
- **저장 확인**: 바로 저장되는 선택(계좌 세제 유형 등)과 추가 작업 뒤에는 `role="status"` 한 줄로 무엇이 저장됐는지 알린다.
- **히트맵**: 종목이 3개 미만이면 그리지 않는다(한 칸짜리 큰 사각형이 오류처럼 보인다). 높이는 폰 12rem·데스크톱 14rem.
  - 배치는 히트맵 영역의 실제 px 너비·높이 비율로 계산한다(측정 전·서버 렌더는 폰 기준 318×192). 높이가 고정이라 측정 뒤에도 화면이 밀리지 않는다.
  - 칸은 테두리 대신 2px 간격으로 구분하고, 안쪽 여백은 글자가 들어가는 칸만 4px 둔다(작은 칸은 색 면이 항상 보이게 여백 없음).
  - 글자는 칸의 실제 px 크기로 정한다(12px 고정): 72px 이상×40px 이상이면 이름+수익률 두 줄, 68px 이상×24px 이상이면 수익률 한 줄, 그보다 작으면 글자 없음. 기준값은 `dashboard-insights.ts` 의 `HEATMAP_*` 상수. 
  - 비중 2% 미만 종목이 2개 이상이면 "기타 N종목" 한 칸으로 묶는다(면적 = 비중 합, 색 = 보합 회색 `heat-flat` #6b6b73 — 여러 종목의 수익률을 한 색으로 말하지 않는다). 묶어서 3칸 미만이 되면 묶지 않는다.
  - 기타 칸은 보합 칸과 헷갈리지 않게 **빗금 무늬**를 얹고(라이트는 흰 빗금 75%, 합성 #dadadc 로 보합 색 위 3.8:1; 다크는 흰 빗금 65%, 합성 #cbcbce 로 3.3:1; 색 값은 그대로; 글자가 있는 칸에는 글자가 깔끔히 읽히도록 빗금 없이 이름이 구별해 준다), 한 줄이 들어가면 "기타 N종목", 두 줄이면 이름+비중을 쓴다. 범례에도 "기타" 항목이 나오고, 묶인 종목은 펼친 아래 목록에 "· 기타" 표시와 함께 나온다.
  - 아래 종목 목록은 **기본으로 접어 둔다**(폰에서는 종목 수만큼 줄이 생겨 너무 길다). 선택 한 줄 아래의 펼침 버튼("종목별 목록 펼치기 · N종목" / "종목별 목록 접기")으로 펼치고 접는다. `aria-expanded`·`aria-controls`, 높이 44px 이상, 포커스는 브랜드 색 윤곽선. 접힌 상태가 서버 렌더·측정 전·측정 뒤 모두 같아 아래 내용이 밀리지 않는다(펼침은 사용자가 누른 결과). **범례는 접지 않는다**(색의 뜻).
  - 펼친 목록은 **측정과 무관하게 모든 종목**의 이름·비중·수익률을 보여준다(칸에 이름이 들어갔는지와 상관없음). 말줄임으로 잘린 이름은 칸을 눌러 아래 한 줄에서 전체를 본다(칸에 `title` 도 있다).
  - "기타" 칸을 누르면 선택 한 줄에 이름·비중과 함께 안내가 붙는다: 접혀 있으면 "묶인 종목은 아래 '종목별 목록 펼치기'를 눌러 볼 수 있어요.", 펼쳐 있으면 "'· 기타' 표시로 볼 수 있어요." 목록을 자동으로 펼치지는 않는다(누른 칸 아래 화면이 갑자기 밀리는 놀람을 피한다).
  - 화면 측정이 끝나기 전에는 칸을 그리지 않는다(잘못된 비율의 배치가 먼저 보였다 바뀌는 것을 막는다. 높이는 그대로라 밀림 없음).
  - 칸은 버튼이다. 누르거나 키보드로 고르면 히트맵 아래에 이름·비중·수익률 한 줄이 나온다(`aria-live`). 선택·포커스 표시는 어두운 선+흰 선 이중 테두리(어떤 칸 색 위에서도 한쪽은 3:1 이상; 보합 칸 위에서는 어두운 선 3.35:1, 흰 선 5.3:1; 다크의 밝은 강한 칸 위에서는 흰 선이 2.2:1 로 묻히는 대신 어두운 선이 8:1 이상).
  - **44px 규칙 예외**: 히트맵 칸(`data-heat-tile`)은 `#main-content` 의 버튼 최소 44×44px 규칙에서 뺀다. 면적이 곧 비중이라 44px 로 키우면 작은 칸이 이웃 칸과 겹친다. 대신 작은 칸의 정보는 (펼친) 아래 목록과 선택 한 줄로 닿는다.
- **아이콘 버튼**: 보이는 크기와 상관없이 누르는 영역 44×44px, `aria-label`에 대상 이름(예: "2026-11-15 배당 기록 삭제").
- **표**: `th scope`, 화면 낭독용 `caption`, 가로 스크롤 영역에는 이름과 안내.
- **차트**: 래퍼에 요약 `aria-label`, 계열 이름은 한글, 목표·보조 계열은 `chart-target` 점선. 동작 줄이기를 켜면 애니메이션을 끈다. recharts 는 `next/dynamic` 으로 지연 로딩.

## Dark Mode

- 테마는 설정의 라이트/다크/시스템. `<html class="dark">`로 전환하고, 토큰(`ink`, `ink-mute`, `surface`, `hairline`, `gain`, `loss`, `danger`, `caution`, `success`)이 자동으로 다크 값으로 바뀐다.
- 다크 바탕은 `#09090b`(페이지)·`#18181b`(패널). 다크에서도 12px 글자 4.5:1 이상을 지킨다(위 표의 다크 글자색 값은 모두 #18181b 위 6.6:1 이상).
- 면으로 칠하는 색(히트맵 칸 `heat-*`)은 다크에서 따로 정한다: 바탕 #18181b 대비 3:1 이상, 칸 글자 4.5:1 이상, **강할수록 밝게**. 라이트 값을 그대로 쓰면 진한 칸일수록 다크 바탕에 묻힌다.
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
| `caution` (기존 `warning`) | #8a5a00 | `caution` |
| `cautionSoft` | #fdf6e3 | `caution-soft` |
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
- 설명은 기본으로 감추고 필요할 때 연다: 보충 설명은 InfoTip 말풍선이나 `<details>` 접기로, 긴 안내는 이모지 줄 목록으로. 화면에는 제목 → 핵심 숫자·행동 → 보조 정보 순서만 남긴다.

### Don't
- 그라디언트 면·그라디언트 글자·발광 그림자·유리 효과를 쓰지 않는다.
- 이모지를 내비·버튼·아이콘 버튼의 아이콘으로 쓰지 않는다(그 자리는 SVG 선 아이콘). 이모지는 글자 라벨 옆 `aria-hidden` 그림으로만, 제목·손익·위험 표시에는 쓰지 않는다.
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
- 터치 대상 44×44px 이상, 대상 사이 8px 이상. 대시보드는 `globals.css`의 `#main-content` 규칙이 버튼·탭·버튼 모양 링크에 최소 44×44px를 준다(글 속 인라인 링크 제외). 헤더의 계좌 선택·계좌 추가·메뉴도 44px, 서로 8px 간격.
- 계좌 추가 같은 머리 팝오버는 640px 미만에서 화면 기준(`fixed inset-x-3`)으로 놓아 왼쪽이 잘리지 않게 한다.
- 넓은 표(연금 설계 나이별 현금흐름)는 셀 좌우 여백 8px, 최소 폭을 주고 가로 스크롤 안내를 단다. 폰 폭에서는 금액을 만원 단위(`formatKRW`)로 줄인다.
- 늦게 불러오는 영역(홈 한 줄 상태, 설정의 비밀번호·텔레그램, 시세 조회 상태 줄)은 자리를 미리 잡아 레이아웃 이동(CLS)을 0.1 아래로 둔다.
