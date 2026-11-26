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
3. 가입하면 기본 ETF 12종이 수량 0으로 자동 생성됩니다(`DEFAULT_HOLDINGS`). 수량 0이면 앱 화면이 대부분 0원으로 보이므로, **웹 대시보드에 같은 계정으로 로그인해 가상의 보유 수량·매수 기록·배당 기록·은퇴 목표를 입력**합니다. 모바일 앱에는 입력 화면이 없습니다.
4. 앱에서 로그인해 홈·자산·배당 탭에 값이 보이는지 직접 확인합니다.
5. 입력한 값은 **가상 데이터**여야 하며 실제 본인 자산을 쓰지 않습니다.
6. 심사 중에는 이 계정의 비밀번호를 바꾸거나 계정을 삭제하지 않습니다. 심사 계정으로 계정 삭제를 시연하게 하려면 삭제용 계정을 **하나 더** 만듭니다.
7. 로그인 시도 제한: 10분에 10회(`src/lib/rate-limit.ts`). 심사자가 오타로 막히지 않도록 안내하세요.

## 2. 로그인 방법 (심사자에게 전달할 문구)

```
앱 실행 → 로그인 화면에서 아래 계정으로 로그인합니다.
이메일: (Console 입력란에 기재)
비밀번호: (Console 입력란에 기재)
이 앱은 이메일/비밀번호 로그인만 지원합니다. Google·Apple 등 외부 로그인과 2단계 인증은 없습니다.
홈·자산·배당 탭은 조회 전용입니다. 보유 내역 입력은 웹 서비스(주소: {웹 주소})에서 합니다.
계정 삭제: 설정 탭 맨 아래 '계정 삭제'.
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
| 매매 기능 없음 | 앱 API 호출은 `/api/mobile/auth/login|signup`, `/api/mobile/portfolio-summary`, `DELETE /api/me` 뿐(`mobile/src/api/*`). 주문·체결 API 없음 |
| 결제·예치·송금 없음 | `src/app/api` 전체에 결제 라우트 없음(라우트 목록 확인). IAP·결제 SDK 없음 |
| 수익 계산은 입력값 기반 | `src/lib/portfolio.ts`(평가·손익 계산), 모바일은 서버 응답 표시만(`mobile/src/components`) |
| 시세는 공개 API 조회 | 네이버·Yahoo 등(`data-safety.md` 2-3). 한국투자증권 API 키는 운영자 시세 조회용(`src/lib/kis.ts`)이며 이용자 계좌가 아님 |
| 매수·매도 추천 문구 | 모바일 앱 문구에 없음. 웹 개인정보처리방침에 "추천·자문·중개·수익 보장 기능을 제공하지 않습니다"(`src/app/privacy/page.tsx` 2항) |

### 3-3. 신고 시 위험 항목 (이용자가 결정해야 함)

1. **웹 전용 기능이 자문처럼 읽힐 수 있음.** 모바일 앱에는 없지만 같은 서비스(웹)에 있습니다.
   - `src/app/api/telegram-bot/route.ts`: 프롬프트가 "너는 한국 배당투자 전문가 AI야…"이고 답변을 그대로 전송.
   - `cron/market-close`: GPT에게 "배당투자 전문 애널리스트" 역할로 코멘트를 쓰게 한 뒤 "AI 코멘트"로 붙임(하단에 "매매 권유가 아닙니다" 문구는 있음).
   - 웹 '매수 계획'(`src/lib/buy-algorithm.ts`)은 다음 매수 수량을 계산해 줌. 문구상 "추천"으로 읽히지 않는지 검토 필요.
   스토어 설명과 신고 답변이 "자문 없음"이라고 말하는데 웹에 이런 기능이 있으면 모순으로 지적될 수 있습니다. 스토어 제출 전에 이 기능들을 웹에서 어떻게 보이게 둘지 결정이 필요합니다. **코드는 이번 작업에서 수정하지 않았습니다.**
2. **Google 금융 기능 선언 옵션**(출처 https://support.google.com/googleplay/android-developer/answer/13849271, 확인일 2026-11-27): "Stock trading and portfolio management", "Financial advice", "My app doesn't provide any financial features" 등. 페이지는 **추적 전용 앱이 신고 대상인지 명시하지 않습니다.** 보수적으로는 "Stock trading and portfolio management"을 선택하는 쪽이 안전할 수 있으나 이는 선택 사항이며 Play 지원센터 확인을 권합니다.
3. **Play 개발자 계정 유형**: 금융 상품·서비스(은행, 대출, 주식 거래, 투자 펀드 등)는 조직 계정 등록 대상이라고 안내됨(출처 https://support.google.com/googleplay/android-developer/answer/10788890). 이 앱이 해당하는지는 페이지에 없음 → 제출 전 확인 필요.
4. **Apple 3.2.1(viii)** 원문: "Apps used for financial trading, investing, or money management should be submitted by the financial institution performing such services and must have necessary licensing and permissions in the locations where you make them available." 개인 기록 도구가 "money management"에 해당하는지는 원문으로 판단되지 않습니다. 심사 메모에 "금융 서비스를 제공하지 않으며 이용자 입력값을 기록·계산만 한다"고 명확히 적고, 거절 시 이의 제기 근거로 3-2를 사용하세요. (법률 자문 아님)

## 4. 계정 삭제 경로

- 앱: 설정 탭 → 맨 아래 '계정 삭제'(로그인 시 표시) → 비밀번호 입력 → '계정 영구 삭제' → 확인 대화상자 '계정 삭제'. 서버가 비밀번호를 확인하고 `users` 행을 삭제, 관련 테이블은 CASCADE로 함께 삭제(`src/app/api/me/route.ts`, `neon-schema.sql`).
- 웹 링크(Play 요건): `{웹 주소}/account-deletion` — 앱·개발자 이름 '가족연금계획' 표기, 삭제 방법 상단 노출(`src/app/account-deletion/page.tsx`).
- 근거 요건: Play는 앱 내 삭제 경로 + 앱을 열지 않고 요청 가능한 웹 링크를 모두 요구(출처 https://support.google.com/googleplay/android-developer/answer/13327111). Apple은 앱 내 삭제 개시 필수, 임시 비활성화만으로는 불충분, 고객센터 전화·이메일만으로는 불가(출처 https://developer.apple.com/support/offering-account-deletion-in-your-app/). 위 두 요건을 코드상 충족하는 것으로 보이나 실제 기기에서 시연 확인은 아직 하지 않았습니다 → **미확인**.
- 웹에서 만든 Google 전용 계정은 모바일에서 삭제 화면(비밀번호 필수)을 쓸 수 없지만, 그런 계정은 모바일 로그인도 불가합니다.

## 5. 심사에서 예상되는 질문

| 예상 질문 | 준비한 답 |
|---|---|
| 앱이 웹뷰/링크 모음 아닌가(Apple 4.2)? | 네이티브 화면(RN) 4개 탭 + 로그인·가입·삭제. 단, **입력 기능이 웹에만 있어 조회 전용이라는 점이 최소 기능으로 보일 위험**이 있음. 원문: "If your app is not particularly useful, unique, or 'app-like,' it doesn't belong on the App Store." → `checklist.md` 위험 항목 |
| 입력 없이 내용이 비어 있다? | 데모 계정에 가상 데이터를 미리 입력(1절 3번) |
| 시세는 어디서? | 공개 시세 조회. 실시간·정확성을 보장하지 않음. 앱 화면 문구는 보장 표현을 쓰지 않음 |
| 개인정보 | 방침 `/privacy`, 삭제 `/account-deletion` |
