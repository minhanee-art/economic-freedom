# 가족연금계획 (pension-manager)

가족의 연금·ETF·배당 자산을 직접 기록하고 계산해 보는 웹 서비스입니다. 사용자가 입력한 기록을 계산해 보여주는 도구이며, 투자 자문이나 매매 권유를 하지 않습니다. 웹(Next.js)과 모바일 앱(`mobile/`, Expo)이 같은 서버 API를 씁니다.

## 주요 기능

- 포트폴리오 대시보드: 자산배분, 목표 비중 대비 현재 비중, 종목 히트맵
- 적립 배분 계산(매수 계획 화면)과 매수 기록(개별 삭제 가능), 평균단가·손익 추적
- 연금 설계: 연금계좌 납입, 연금 소득원, 은퇴 목표, 세액공제 진행률, 은퇴 시점 예상 현금흐름
- 배당 기록과 배당 캘린더
- 여러 포트폴리오 계좌(가족/명의별) 관리
- 자녀 증여 관리
- ETF 비교, 시장 정보(지수·거래대금·캔들·구성종목 등)
- 엑셀 가져오기
- 계정 삭제(설정 화면), 개인정보처리방침(`/privacy`)·계정 삭제 안내(`/account-deletion`) 페이지
- 텔레그램 리포트·알림 (Vercel Cron), 허용된 채팅 전용 봇(웹훅 시크릿·허용 chat_id가 없으면 거부). AI 요약에는 고지 문구가 붙음

## 기술 스택

| 영역 | 사용 기술 |
|------|-----------|
| 웹 | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, Recharts, Zustand |
| DB | Neon Postgres (`@neondatabase/serverless`) — 스키마는 `neon-schema.sql` |
| 인증 | 자체 JWT(`jose`) + 비밀번호(`bcryptjs`), Google OAuth. 웹은 HTTP-only 쿠키, 모바일은 `Authorization: Bearer` |
| 로그인 시도 제한 | Upstash Redis 슬라이딩 윈도우 (미설정 시 인스턴스 메모리 폴백) |
| 시세 | 네이버 금융, Yahoo Finance, 한국투자증권 Open API(선택) |
| 배포 | Vercel (`main` 병합 시 자동 배포), Vercel Cron |
| 모바일 | Expo(React Native) + expo-router, EAS Build — `mobile/` |

> Next.js 16은 기존 버전과 규칙이 다릅니다. 코드를 고치기 전에 `node_modules/next/dist/docs/`의 관련 가이드를 확인하세요 (`AGENTS.md`). 보호 경로 검사는 `middleware.ts`가 아니라 `src/proxy.ts`에 있습니다.

## 로컬 개발

```bash
npm ci
cp .env.example .env.local   # 값을 채운다
npm run dev                  # http://localhost:3000
```

데이터베이스는 Neon 프로젝트를 만들고 `neon-schema.sql`을 실행해 준비합니다. 운영 DB에는 연결하지 말고 개발용 DB를 쓰세요.

## 환경변수

`.env.example`에 전체 목록과 설명이 있습니다.

| 변수 | 설명 | 필수 |
|------|------|------|
| `DATABASE_URL` | Neon Postgres 연결 문자열 | O |
| `JWT_SECRET` | 세션 JWT 서명 키 (32바이트 이상) | O |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google 로그인 | 선택 |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | 인증 레이트리밋 분산 저장소 | 선택 |
| `CRON_SECRET` | Cron 호출 인증 (미설정 시 cron이 401로 차단) | Cron 사용 시 |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `TELEGRAM_WEBHOOK_SECRET` | 텔레그램 리포트·봇. 봇은 `TELEGRAM_WEBHOOK_SECRET`과 허용 chat_id가 없으면 모든 요청을 거부 | 선택 |
| `TELEGRAM_ALLOWED_CHAT_IDS` | 봇과 대화할 수 있는 chat_id(쉼표 구분). `TELEGRAM_CHAT_ID`와 합쳐 허용 목록이 됨 | 봇 사용 시 |
| `TELEGRAM_BOT_USERNAME` | 봇 사용자명(@ 제외). 설정 > 텔레그램 연결에서 `t.me` 딥링크를 만든다. 없으면 코드만 보여 준다 | 선택 |
| `REPORT_USER_EMAIL` 또는 `REPORT_USER_ID` | 리포트 대상 사용자 | 리포트 사용 시 |
| `KIS_APP_KEY`, `KIS_APP_SECRET` | 한국투자증권 시세 | 선택 |
| `OPENAI_API_KEY` | 뉴스 감정분석·봇 답변 | 선택 |
| `APP_URL` | 리포트 링크 기준 주소 (기본 `https://economic-freedom.vercel.app`) | 선택 |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | 개인정보·계정 삭제 안내에 표시할 문의 이메일 | 선택 |

## 스크립트와 검증

```bash
npx tsc --noEmit        # 타입 검사
npm run lint            # ESLint
npm run lint:design     # 디자인 규칙 린트
npm test                # node:test 기반 단위/API/컴포넌트 테스트 (src/**/*.test.ts(x))
npm run build           # 프로덕션 빌드
```

DB 통합 테스트(`src/test/*.db.test.ts`)는 `npm test`에 포함되지 않고, 일회용 Docker Postgres를 띄우는 스크립트로 따로 실행합니다. Docker가 필요합니다.

```bash
./scripts/verify-snapshot-db.sh
```

CI(`.github/workflows/ci.yml`)는 PR과 `main` push에서 타입 검사 → lint → design lint → test → build를 순서대로 실행합니다.

## Cron

`vercel.json`에 등록된 경로: `/api/cron/report`, `sentiment`, `market-close`, `portfolio`, `dividend-news`, `dividend-calendar`, `technical`. 모두 `Authorization: Bearer <CRON_SECRET>` 헤더로만 인증하며(쿼리 `?secret=`는 받지 않음, 상수 시간 비교) 결과를 운영자 채팅(`TELEGRAM_CHAT_ID`)으로 보냅니다. 수동 실행: `curl -H "Authorization: Bearer $CRON_SECRET" https://<도메인>/api/cron/report?type=all`

## 모바일 앱 (`mobile/`)

Expo SDK 57 / expo-router 기반 앱입니다. 홈·자산·배당·연금·설정 탭이 있고, 계좌 전환, 연금 설계 요약(읽기 전용), 매수·배당 수령 기록 입력, 비밀번호 변경, 계정 삭제를 지원합니다. 로그인 토큰은 SecureStore에 저장합니다. 서버 주소는 `EXPO_PUBLIC_API_BASE_URL`로 지정하며, `mobile/eas.json`의 `preview`·`production` 프로필에 운영 주소가 들어 있습니다.

```bash
cd mobile
npm ci                      # mobile/.npmrc의 legacy-peer-deps=true를 자동으로 읽음(EAS 빌드도 동일)
npm run typecheck
npm run lint
npx expo-doctor
EXPO_PUBLIC_API_BASE_URL=http://<개발 서버 주소> npm start
```

## 프로젝트 구조

```
src/
├── app/
│   ├── api/                 # accounts, auth, children, cron, danger, dividend-calendar,
│   │                        # dividends, holdings, import, market, me, mobile, pension, portfolio-returns,
│   │                        # prices, purchases, settings, telegram-bot, trades, watchlist
│   ├── dashboard/           # 메인, buy, pnl, dividend, history, market, compare, children, retirement, settings
│   ├── login/  signup/      # 인증 화면
│   ├── privacy/             # 개인정보처리방침
│   └── account-deletion/    # 계정 삭제 안내
├── components/              # charts, gift, portfolio, settings, ui
├── lib/                     # db, session, rate-limit, portfolio*, buy-algorithm, gift-tax, reports …
├── proxy.ts                 # 보호 경로 JWT 검증 (Next 16 proxy)
├── test/                    # API·컴포넌트·DB 통합 테스트
└── types/
mobile/                      # Expo 앱 (app.json, eas.json, src/)
scripts/                     # test.mjs, verify-snapshot-db.sh
neon-schema.sql              # 현재 DB 스키마
supabase/migrations/         # 예전 Supabase 시절의 마이그레이션 기록(현재 런타임은 사용하지 않음)
docs/                        # 모바일 앱·Play Store 계획서
```
