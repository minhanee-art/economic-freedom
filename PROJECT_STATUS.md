# 가족연금계획 - 프로젝트 현황

## 개요
- **저장소/패키지명**: pension-manager (앱 이름: 가족연금계획)
- **구성**: 웹(Next.js 16) + 모바일 앱(`mobile/`, Expo)이 같은 서버 API를 공유
- **기술스택**: TypeScript / Tailwind CSS v4 / Recharts / Zustand / Neon Postgres / 자체 JWT 인증 / Upstash(레이트리밋) / Vercel(배포·Cron)
- 설치·실행·환경변수·검증 방법은 `README.md` 참고

## 구현된 것 (코드 기준)

### 웹
- 인증: 이메일·비밀번호 가입/로그인, Google OAuth, 비밀번호 변경, 로그아웃, 계정 삭제(`DELETE /api/me`)
- 로그인 시도 제한: Upstash Redis 슬라이딩 윈도우, 미설정 시 메모리 폴백 (`src/lib/rate-limit.ts`)
- 세션: JWT 30일, 웹은 HTTP-only 쿠키 / 모바일은 Bearer 토큰. `src/proxy.ts`가 `/dashboard`, `/api/market`, `/api/prices`를 보호
- 대시보드 화면: 메인, 매수 계획(buy), 손익(pnl), 배당(dividend), 기록(history·엑셀 가져오기), 시장(market), ETF 비교(compare), 자녀 증여(children), 설정(settings)
- 여러 포트폴리오 계좌, 보유 종목·매수/매도 기록, 평균단가·손익, 목표 비중 대비 현재 비중
- 배당 기록·배당 캘린더, 관심종목, 계좌별 기간 수익률 스냅샷
- 시세·시장 정보: 네이버 금융, Yahoo Finance, 한국투자증권 Open API(선택)
- 개인정보처리방침(`/privacy`), 계정 삭제 안내(`/account-deletion`)

### 백엔드/운영
- DB: Neon Postgres, 스키마는 `neon-schema.sql` (users, profiles, holdings, purchase_records/items, dividends, cost_basis, watchlist, dividend_calendar, sell_items, children, child_gifts, child_holdings 등)
- Vercel Cron 7종(`vercel.json`): report, sentiment, market-close, portfolio, dividend-news, dividend-calendar, technical → 텔레그램 전송
- 텔레그램 봇 웹훅(`/api/telegram-bot`), OpenAI 기반 뉴스 감정분석(선택)
- CI(`.github/workflows/ci.yml`): tsc → lint → lint:design → test → build

### 모바일 앱 (`mobile/`)
- Expo SDK 57, expo-router. 탭: 홈·자산·배당·설정. 로그인·회원가입·계정 삭제 화면
- 모바일 전용 API: `/api/mobile/auth/{login,signup}`, `/api/mobile/portfolio-summary`
- 토큰은 expo-secure-store에 저장, 서버 주소는 `EXPO_PUBLIC_API_BASE_URL`
- `mobile/eas.json`의 preview·production 프로필에 운영 API 주소 설정됨
- Android 패키지 `kr.kimvibe.economicfreedom`, versionCode 4 (`mobile/app.json`)

### 테스트
- `npm test`: `src/**/*.test.ts(x)`를 node:test로 실행 (API, 컴포넌트, 계산 로직)
- DB 통합 테스트는 `./scripts/verify-snapshot-db.sh`로 일회용 Docker Postgres에서 실행

## 남은 일 / 확인이 필요한 것
- Play Console 내부 테스트 업로드와 스토어 등록 (코드에서는 진행 여부를 확인할 수 없음)
- EAS production 빌드는 이 문서 작성 시점에 실행·검증하지 않았음
- `supabase/migrations/`는 예전 기록으로 남아 있고 현재 런타임은 Supabase를 쓰지 않음. 정리 여부는 별도 결정 필요
- `mobile/`에서 `npm ci`는 npm 10 환경에서 react-native-reanimated peer 충돌로 실패해 `--legacy-peer-deps`가 필요했음. 정리 필요
- `mobile/src/hooks/usePortfolioSummary.ts`에 lint 경고 1건(`react-hooks/set-state-in-effect`)
