# 가족연금계획 - 프로젝트 현황

## 개요
- **저장소/패키지명**: pension-manager (앱 이름: 가족연금계획)
- **구성**: 웹(Next.js 16) + 모바일 앱(`mobile/`, Expo)이 같은 서버 API를 공유
- **기술스택**: TypeScript / Tailwind CSS v4 / Recharts / Zustand / Neon Postgres / 자체 JWT 인증 / Upstash(레이트리밋) / Vercel(배포·Cron)
- 설치·실행·환경변수·검증 방법은 `README.md` 참고

## 구현된 것 (코드 기준)

### 웹
- 인증: 이메일·비밀번호 가입/로그인, Google OAuth, 비밀번호 설정·변경(`/api/auth/password`, 변경 시 `session_version`을 올려 다른 기기 토큰 폐기), 로그아웃, 계정 삭제(`DELETE /api/me`, 비밀번호 또는 이메일 확인 + 속도 제한)
- 로그인 시도 제한: Upstash Redis 슬라이딩 윈도우, 미설정 시 메모리 폴백 (`src/lib/rate-limit.ts`)
- 세션: JWT 30일, 웹은 HTTP-only 쿠키 / 모바일은 Bearer 토큰. `src/proxy.ts`가 `/dashboard`, `/api/market`, `/api/prices`를 보호
- 대시보드 화면: 메인, 적립 배분 계산(buy), 손익(pnl), 배당(dividend), 기록(history·엑셀 가져오기), 시장(market), ETF 비교(compare), 자녀 증여(children), 연금 설계(retirement), 설정(settings)
- 연금 설계: 연금계좌 납입, 연금 소득원, 은퇴 목표, 세액공제 진행률, 은퇴 시점 예상 현금흐름(`/api/pension/*`, `src/lib/pension-*.ts`)
- 여러 포트폴리오 계좌, 보유 종목·매수/매도 기록(매수 기록 개별 삭제 `DELETE /api/purchases/{id}` 포함), 평균단가·손익, 목표 비중 대비 현재 비중
- 기록 입력 서버 검증(날짜·수량·금액 범위 등, `src/lib/record-validation.ts`)
- 배당 기록·배당 캘린더, 관심종목, 계좌별 기간 수익률 스냅샷
- 시세·시장 정보: 네이버 금융, Yahoo Finance, 한국투자증권 Open API(선택)
- 개인정보처리방침(`/privacy`), 계정 삭제 안내(`/account-deletion`)

### 백엔드/운영
- DB: Neon Postgres, 스키마는 `neon-schema.sql` (users, profiles, holdings, purchase_records/items, dividends, cost_basis, watchlist, dividend_calendar, sell_items, children, child_gifts, child_holdings 등)
- Vercel Cron 7종(`vercel.json`): report, sentiment, market-close, portfolio, dividend-news, dividend-calendar, technical → 텔레그램 전송
- 텔레그램 봇 웹훅(`/api/telegram-bot`), 허용 chat_id·웹훅 시크릿이 없으면 거부(fail closed)하는 텔레그램 봇, AI 요약은 '정보 정리' 프롬프트와 고지 문구 사용(`src/lib/ai-text.ts`, `src/lib/telegram-bot-auth.ts`). OpenAI 뉴스 감정분석(선택)
- CI(`.github/workflows/ci.yml`): tsc → lint → lint:design → test → build

### 모바일 앱 (`mobile/`)
- Expo SDK 57, expo-router. 탭: 홈·자산·배당·연금·설정. 로그인·회원가입·계정 삭제 화면
- 계좌 전환(본인·배우자·자녀), 연금 설계 요약(읽기 전용), 매수 기록·배당 수령 기록 입력(배당 기록은 삭제 가능), 설정 탭에서 비밀번호 변경
- 앱의 매수 기록 개별 삭제 화면은 아직 없음(서버 API만 있음)
- 모바일 전용 API: `/api/mobile/auth/{login,signup}`, `/api/mobile/portfolio-summary`. 그 외 `/api/accounts`, `/api/pension/*`, `/api/purchases`, `/api/dividends`, `/api/auth/password`, `DELETE /api/me`를 공용으로 호출
- 토큰은 expo-secure-store에 저장, 서버 주소는 `EXPO_PUBLIC_API_BASE_URL`
- `mobile/eas.json`의 preview·production 프로필에 운영 API 주소 설정됨
- Android 패키지 `kr.kimvibe.economicfreedom`, versionCode 4 (`mobile/app.json`)

### 테스트
- `npm test`: `src/**/*.test.ts(x)`를 node:test로 실행 (API, 컴포넌트, 계산 로직)
- DB 통합 테스트는 `./scripts/verify-snapshot-db.sh`로 일회용 Docker Postgres에서 실행

## 남은 일 / 확인이 필요한 것
- Play Console 내부 테스트 업로드와 스토어 등록 (코드에서는 진행 여부를 확인할 수 없음)
- EAS production 빌드는 이 문서 작성 시점에 실행·검증하지 않았음
- `supabase/migrations/`는 예전 기록으로 남아 있고 현재 런타임은 Supabase를 쓰지 않음(코드·스크립트 참조 없음, 주석·문서에서만 언급). 삭제 여부는 별도 결정 필요
- `mobile/npm ci`의 reanimated peer 충돌은 `mobile/.npmrc`(`legacy-peer-deps=true`)와 lockfile 정리로 해결. EAS 빌드 자체는 실행해 확인하지 않음
- `mobile/src/hooks/usePortfolioSummary.ts`에 lint 경고 1건(`react-hooks/set-state-in-effect`)
