# 심사자용 메모 초안 (Play 앱 액세스 / App Store 심사 메모)

> 비밀번호·실제 이메일은 이 저장소에 쓰지 않습니다. 제출 시 Play Console '앱 액세스', App Store Connect '심사 정보 → 로그인 정보' 입력란에만 직접 넣으세요.
> 문의 이메일: `NEXT_PUBLIC_SUPPORT_EMAIL`

## 1. 데모 계정 준비 절차

요건(공식 페이지, 확인일 2026-11-27):
- Apple 2.1(a): "include demo account info (and turn on your back-end service!)". 원문 확인. 출처 https://developer.apple.com/app-store/review/guidelines/
- Google: 로그인 정보는 항상 유효하고 재사용 가능해야 하며, 2단계 인증·일회용 코드를 우회해야 하고, 영어로 제공. 비밀번호가 만료되면 심사가 불가할 수 있음. 출처 https://support.google.com/googleplay/android-developer/answer/15748846

절차 (계정을 만드는 방법만 적음):
1. 배포 서버가 살아 있고 `DATABASE_URL`, `JWT_SECRET`이 설정돼 있는지 확인합니다.
2. 모바일 앱(또는 웹 `/signup`)의 회원가입 화면에서 **심사 전용 이메일**로 가입합니다. 이메일 인증 단계는 코드에 없습니다(`src/lib/auth-account.ts`). 비밀번호는 6자 이상 72바이트 이하이며 별도 만료가 없습니다.
3. 가입하면 기본 ETF 12종이 수량 0으로 자동 생성됩니다(`DEFAULT_HOLDINGS`). 수량 0이면 앱 화면이 대부분 0원으로 보이므로(아래 "수량 0 종목" 참고), 가상의 보유 수량·매수 기록·배당 기록을 입력합니다. 매수·배당 기록은 모바일 앱에서도 입력할 수 있고, 잘못 넣은 기록은 매수 기록 화면의 최근 기록에서 한 건씩 '삭제'할 수 있습니다(확인 창이 뜨며, 삭제하면 보유 수량·원가가 되돌아갑니다. 같은 종목 매도 기록이 이후에 있는 등 되돌릴 수 없는 기록은 서버가 거절하고 안내를 표시합니다 — `src/app/api/purchases/[id]/route.ts`). 다만 **은퇴 목표·연금 소득원·연금 납입 기록은 웹 대시보드에서만 입력**하므로 연금 탭까지 채우려면 같은 계정으로 웹에도 로그인해야 합니다.
4. 앱에서 로그인해 홈·자산·배당·연금 탭에 값이 보이는지 직접 확인합니다.
5. 입력한 값은 **가상 데이터**여야 하며 실제 본인 자산을 쓰지 않습니다.
6. 앱에서 비밀번호를 바꾸면 다른 기기의 기존 로그인은 풀립니다(`session_version` 증가, `src/app/api/auth/password/route.ts`). 심사 중에는 이 계정의 비밀번호를 바꾸거나 계정을 삭제하지 않습니다. 심사 계정으로 계정 삭제를 시연하게 하려면 삭제용 계정을 **하나 더** 만듭니다.
7. 로그인 시도 제한: 10분에 10회(`src/lib/rate-limit.ts`, 모바일 로그인은 IP+이메일 기준). 비밀번호 변경·계정 삭제 시도에도 같은 제한이 있습니다. 심사자가 오타로 막히지 않도록 안내하세요.

## 2. 로그인 방법 (심사자에게 전달할 문구)

```
앱 실행 → 로그인 화면에서 아래 계정으로 로그인합니다.
이메일: (Console 입력란에 기재)
비밀번호: (Console 입력란에 기재)
이 앱은 이메일/비밀번호 로그인만 지원합니다. Google·Apple 등 외부 로그인과 2단계 인증은 없습니다.
홈·자산·배당·연금 탭에서 요약을 보고, 자산·배당 탭의 버튼으로 매수·배당 수령 기록을 입력할 수 있습니다(이미 한 거래를 적는 것이며 주문은 실행되지 않습니다).
연금 탭은 읽기 전용이며 은퇴 목표 등 일부 입력은 웹 서비스(주소: {웹 주소})에서 합니다.
비밀번호 변경·계정 삭제: 설정 탭.
```

외부 로그인이 없으므로 App Store 4.8(Sign in with Apple 동등 옵션)은 적용 대상이 아닐 가능성이 높습니다. 4.8 원문 중 일부(예외 목록)는 요약 기준이라 **미확인(원문 재확인 필요)**. 웹에는 Google 로그인이 있지만 모바일 앱에는 없습니다.

## 3. 금융 기능 신고 답변 초안

### 3-1. 답변 문안 (영문/한글 병기 권장)

> 가족연금계획은 이용자가 **직접 입력한** 보유 종목·매수·배당·연금 정보를 기록하고 계산해 보여 주는 개인용 도구입니다. 증권사·은행 계좌와 연결하지 않으며, 매매 중개, 투자 자문·권유, 자금 예치·송금·대출·결제 기능이 없습니다.
> This app is a personal record-keeping and calculation tool for holdings the user types in. It does not connect to brokerage or bank accounts and offers no trading, brokerage, investment advice, deposits, transfers, loans or payments.

### 3-2. 코드 근거

| 주장 | 근거 |
|---|---|
| 계좌 연동·자동 조회 없음 | 모바일 의존성에 금융 SDK 없음(`mobile/package.json`). 스키마에 계좌번호·증권사 인증 컬럼 없음(`neon-schema.sql`). 연동 제외는 계획서에도 명시(`docs/mobile-app-playstore-plan.md` 5.2) |
| 매매 기능 없음 | 앱 API 호출은 `/api/mobile/auth/*`, `/api/mobile/portfolio-summary`, `/api/accounts`, `/api/pension/*`(조회), `/api/purchases`·`/api/dividends`(기록 입력·조회, 매수·배당 개별 삭제 `DELETE /api/purchases/{id}`·`DELETE /api/dividends`), `/api/auth/password`, `DELETE /api/me`(`mobile/src/api/*`). 주문·체결 API 없음(`/api/trades`는 웹의 기록용 매수·매도 입력이며 외부 주문을 내지 않는지는 이번에 코드 전체를 읽어 확인하지 않음 → **확인 필요**) |
| 결제·예치·송금 없음 | `src/app/api` 전체에 결제 라우트 없음(라우트 목록 확인). IAP·결제 SDK 없음 |
| 수익 계산은 입력값 기반 | `src/lib/portfolio.ts`(평가·손익 계산), 모바일은 서버 응답 표시만(`mobile/src/components`) |
| 시세는 공개 API 조회 | 네이버·Yahoo 등(`data-safety.md` 2-3). 한국투자증권 API 키는 운영자 시세 조회용(`src/lib/kis.ts`)이며 이용자 계좌가 아님 |
| 매수·매도 추천 문구 | 사용자 문구에는 금지 표현(`추천`·`매수하세요` 등)이 없도록 테스트가 막음(`src/test/wording.test.ts`). 예외는 부정문 2문장뿐: 방침 "매수·매도 권유, 투자 자문, 중개, 수익 보장 기능을 제공하지 않습니다"(`src/app/privacy/page.tsx` 2항), AI 프롬프트의 금지 지시(`src/lib/ai-text.ts`) |

### 3-3. 신고 시 위험 항목 (이용자가 결정해야 함)

1. **웹·운영자 전용 기능의 문구.** 아래는 이전 조사 때의 우려였고, 현재 main 코드는 다음과 같이 바뀌었습니다(2026-11-27 재확인).
   - `src/app/api/telegram-bot/route.ts`: `TELEGRAM_WEBHOOK_SECRET`이 없으면 503, 헤더가 다르면 401(연결 코드 메시지 포함). 질문 답변은 허용 chat_id(`TELEGRAM_ALLOWED_CHAT_IDS`+`TELEGRAM_CHAT_ID`)에 없으면 응답·OpenAI 호출 없이 무시(fail closed, `src/lib/telegram-bot-auth.ts`)하고 이 경로는 DB를 조회하지 않음. 예외로 연결 코드 메시지(`/start <코드>`)만 허용 목록과 무관하게 받으며, 이 경로는 chat_id별 레이트리밋·코드 확인·고정 문구 답장만 하고 OpenAI를 호출하지 않음.
   - 이용자 텔레그램 리포트(PR #41): 웹 설정 > 텔레그램 연결에서 일회용 연결 코드(10자리·10분·1회용, DB에는 해시만)를 발급받아 봇에 보내 그 채팅의 chat_id 소유를 확인한 계좌로만 리포트가 나갑니다(`src/lib/telegram-link.ts`, `src/app/api/portfolio-returns/route.ts`). 이용자가 chat_id를 직접 입력·저장하는 경로는 없습니다. 연결 해제는 웹 설정에서 합니다. 모바일 앱에는 텔레그램 기능이 없습니다. 크론은 `Authorization: Bearer <CRON_SECRET>` 헤더만 받습니다(`src/lib/cron-auth.ts`). 프롬프트는 "정보 정리 도구"이며 전문가 사칭·매매 권유·단정 전망 금지, 답변 끝에 고지 문구 `ℹ️ AI가 공개 정보를 정리한 것으로, 투자 권유가 아닌 정보 정리입니다.`(`src/lib/ai-text.ts`).
   - `cron/market-close`·`sentiment`·`dividend-news`: 같은 공통 프롬프트와 고지 문구 사용(코드상 `withAiDisclaimer` 호출 확인, 이번 작업에서 이 파일들은 수정하지 않음).
   - 웹 '매수 계획'은 화면 이름이 '적립 배분 계산'으로 바뀜(`src/lib/dashboard-navigation.tsx`, `buy-client.tsx`). 계산 결과 문구 전체를 이번에 모두 읽지는 않음 → **확인 필요**(금지 표현 테스트는 통과).
   남은 확인: 운영 환경의 `TELEGRAM_WEBHOOK_SECRET`·허용 목록 설정값, 웹훅이 시크릿과 함께 다시 등록됐는지는 코드로 알 수 없음 → **미확인**. 연결 코드로 이용자 계좌를 연결하는 기능이 실제로 동작하려면 시크릿 설정과 웹훅 재등록이 필요합니다(`checklist.md` C절). 모바일 앱에는 이 기능들이 없지만 같은 서비스에 있으므로 신고 답변과 모순되지 않는지 제출 전 한 번 더 판단하세요.
2. **Google 금융 기능 선언 옵션**(출처 https://support.google.com/googleplay/android-developer/answer/13849271, 확인일 2026-11-27): "Stock trading and portfolio management", "Financial advice", "My app doesn't provide any financial features" 등. 페이지는 **추적 전용 앱이 신고 대상인지 명시하지 않습니다.** 보수적으로는 "Stock trading and portfolio management"을 선택하는 쪽이 안전할 수 있으나 이는 선택 사항이며 Play 지원센터 확인을 권합니다.
3. **Play 개발자 계정 유형**: 금융 상품·서비스(은행, 대출, 주식 거래, 투자 펀드 등)는 조직 계정 등록 대상이라고 안내됨(출처 https://support.google.com/googleplay/android-developer/answer/10788890). 이 앱이 해당하는지는 페이지에 없음 → 제출 전 확인 필요.
4. **Apple 3.2.1(viii)** 원문: "Apps used for financial trading, investing, or money management should be submitted by the financial institution performing such services and must have necessary licensing and permissions in the locations where you make them available." 개인 기록 도구가 "money management"에 해당하는지는 원문으로 판단되지 않습니다. 심사 메모에 "금융 서비스를 제공하지 않으며 이용자 입력값을 기록·계산만 한다"고 명확히 적고, 거절 시 이의 제기 근거로 3-2를 사용하세요. (법률 자문 아님)

## 4. 계정 삭제 경로

- 앱: 설정 탭 → 맨 아래 '계정 삭제'(로그인 시 표시) → 비밀번호 입력 → '계정 영구 삭제' → 확인 대화상자 '계정 삭제'. 서버가 비밀번호를 확인하고 `users` 행을 삭제, 관련 테이블은 CASCADE로 함께 삭제(`src/app/api/me/route.ts`, `neon-schema.sql`). 삭제 시도에는 IP+사용자 기준 속도 제한이 있습니다.
- 수량 0 종목: 가입 직후 기본 종목은 모두 수량 0입니다. 모바일 기록 입력의 종목 목록에서 0주 종목을 기본 숨기고 펼쳐서 고르게 하는 변경은 **PR #46(수정 중, 미머지)** 이므로 머지된 뒤의 화면 기준으로 심사 안내를 다시 확인하세요(그때까지 이 문서는 현재 main 화면을 설명하지 않고 동작을 단정하지 않음).
- 서버 참고(PR #45, 머지됨): `GET /api/me` 가 Bearer 토큰을 받고, `GET /api/purchases` 의 `date` 는 `YYYY-MM-DD` 문자열입니다(시간대 때문에 하루 밀리지 않음). 이 PR 의 문서 서술에는 이와 어긋나는 문장이 없었습니다(`grep` 확인).
- 개별 기록 삭제(계정 삭제와 별개): 모바일 매수 기록 화면의 최근 기록 '삭제'(확인 창), 배당 수령 기록 삭제. 심사자가 시연하려면 가상 매수 기록을 하나 입력한 뒤 삭제해 보면 됩니다(그 종목에 이후 매도 기록이 없는 상태에서).
- 웹 링크(Play 요건): `{웹 주소}/account-deletion` — 앱·개발자 이름 '가족연금계획' 표기, 삭제 방법 상단 노출(`src/app/account-deletion/page.tsx`).
- 근거 요건: Play는 앱 내 삭제 경로 + 앱을 열지 않고 요청 가능한 웹 링크를 모두 요구(출처 https://support.google.com/googleplay/android-developer/answer/13327111). Apple은 앱 내 삭제 개시 필수, 임시 비활성화만으로는 불충분, 고객센터 전화·이메일만으로는 불가(출처 https://developer.apple.com/support/offering-account-deletion-in-your-app/). 위 두 요건을 코드상 충족하는 것으로 보이나 실제 기기에서 시연 확인은 아직 하지 않았습니다 → **미확인**.
- 웹에서 만든 Google 전용 계정은 모바일에서 삭제 화면(비밀번호 필수)을 쓸 수 없지만, 그런 계정은 모바일 로그인도 불가합니다.

## 5. 심사에서 예상되는 질문

| 예상 질문 | 준비한 답 |
|---|---|
| 앱이 웹뷰/링크 모음 아닌가(Apple 4.2)? | 네이티브 화면(RN) 5개 탭(홈·자산·배당·연금·설정) + 로그인·가입·기록 입력·비밀번호 변경·계정 삭제. 조회 전용이던 이전보다 앱다운 기능이 늘었으나, 은퇴 목표·연금 소득원 입력은 웹에만 있음(`retirement.tsx`는 읽기 전용). 원문: "If your app is not particularly useful, unique, or 'app-like,' it doesn't belong on the App Store." → `checklist.md` 위험 항목 |
| 입력 없이 내용이 비어 있다? | 데모 계정에 가상 데이터를 미리 입력(1절 3번) |
| 시세는 어디서? | 공개 시세 조회. 실시간·정확성을 보장하지 않음. 앱 화면 문구는 보장 표현을 쓰지 않음 |
| 개인정보 | 방침 `/privacy`, 삭제 `/account-deletion` |
