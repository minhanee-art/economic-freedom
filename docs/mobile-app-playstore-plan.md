# 경제적 자유 모바일 앱 / Play Store 출시 계획서

## 1. 목표

기존 `pension-manager` 웹앱을 기반으로, 더리치식 포트폴리오 대시보드 UX를 참고하되 그대로 복제하지 않고 **연금·배당·은퇴 목표 관리에 특화한 Android 앱**을 만든다.

최종 산출물은 Google Play Console에 업로드 가능한 **Android App Bundle(`.aab`)** 이다. APK는 테스트/직접 설치용으로만 사용하고, 스토어 제출은 AAB 기준으로 진행한다.

## 2. 포지셔닝

- 앱 이름 후보: 경제적 자유, 연금 포트폴리오, 은퇴 배당노트
- 핵심 사용자: 연금저축/IRP/ISA/ETF/배당주를 직접 관리하는 개인 투자자
- 핵심 차별점:
  - 일반 주식 커뮤니티가 아니라 **은퇴 목표와 월 현금흐름 중심**
  - 연금계좌, 자녀계좌, 배당 캘린더, 증여 관리까지 확장 가능
  - 수동 입력으로 시작해 개인정보/금융정보 리스크를 낮춤

## 3. 참고 UX 원칙

더리치에서 가져올 수 있는 방향:

- 총자산 요약 카드
- 자산 구성/섹터 구성 시각화
- 종목별 수익률 히트맵
- 배당/분배금 캘린더
- 월별 예상 현금흐름
- 관심종목/포트폴리오 중심 탐색

그대로 사용하면 안 되는 것:

- 더리치 브랜드명, 로고, 문구
- 화면 레이아웃의 직접 복제
- 커뮤니티/피드 구조의 무리한 복제
- 투자 추천처럼 보이는 표현

## 4. 현재 웹앱 기반 자산

이미 구현되어 활용 가능한 기능:

- Next.js 16 / TypeScript / Tailwind 기반 웹앱
- 로그인/회원가입 API
- 보유 종목 CRUD
- 매수 기록 / 평균단가 / 손익 계산
- 배당금 기록
- 배당 캘린더
- 관심종목
- 자녀 계좌 / 증여 관리
- 시세 갱신 API
- 포트폴리오 기간 수익률
- 텔레그램 리포트 일부

모바일 앱에서 재사용할 후보:

- `src/lib/portfolio.ts` 계열 계산 로직
- `src/lib/buy-algorithm.ts` 매수 계획 로직
- `/api/holdings`, `/api/dividends`, `/api/dividend-calendar`, `/api/portfolio-returns`, `/api/prices` API
- 기존 DB 스키마와 인증 세션 정책

## 5. MVP 범위

### 5.1 1차 앱 필수 기능

1. 로그인/회원가입
2. 포트폴리오 홈
   - 총 평가금액
   - 총 손익/수익률
   - 누적 배당
   - 월 적립금
3. 보유자산 목록
   - 종목명/코드
   - 보유수량
   - 평균단가
   - 현재가
   - 평가금액
   - 손익/수익률
4. 자산배분
   - 카테고리 비중
   - 목표비중 대비 현재비중
5. 배당/분배금
   - 누적 배당
   - 월별 배당
   - 배당 캘린더
6. 은퇴 목표 카드
   - 목표 월 현금흐름
   - 예상 연 배당/분배금
   - 현재 달성률
7. 설정
   - 월 적립금
   - 개인정보처리방침 링크
   - 데이터 삭제 안내
   - 로그아웃

### 5.2 1차에서 제외

- 증권사 자동연동
- 계좌 자동 조회
- 매수/매도 추천
- 커뮤니티/피드
- 유료결제/IAP
- 푸시 알림 대량 발송
- 공개 포트폴리오 공유

## 6. 기술 전략

### 권장 방식: Expo React Native 앱 추가

현재 Next.js 웹앱을 그대로 APK로 감싸는 방식보다, Play Store 장기 운영을 위해 Expo 기반 앱을 별도 패키지로 추가한다.

예상 구조:

```text
pension-manager/
├── src/                    # 기존 Next.js 웹앱
├── mobile/                 # 신규 Expo 앱
│   ├── app/
│   ├── src/
│   │   ├── api/
│   │   ├── components/
│   │   ├── screens/
│   │   ├── storage/
│   │   └── utils/
│   ├── app.config.ts
│   ├── eas.json
│   └── package.json
└── docs/
    └── mobile-app-playstore-plan.md
```

### 백엔드 전략

1차는 기존 Next.js API를 모바일 앱에서 호출한다.

- 장점: DB 로직 중복 최소화
- 장점: 기존 인증/가격/포트폴리오 API 활용
- 주의: 모바일 세션 인증 방식을 명확히 설계해야 함

모바일 인증 후보:

- 1안: 기존 이메일/비밀번호 API를 모바일 토큰 방식으로 확장
- 2안: Supabase Auth 직접 사용
- 3안: 웹 로그인 세션 기반은 모바일에서 불편하므로 비권장

## 7. 데이터/개인정보 정책

Play Store 심사를 위해 초기에 명확히 정리한다.

- 수집 데이터: 이메일, 포트폴리오 입력값, 배당 기록, 설정값
- 사용 목적: 포트폴리오 관리, 배당/수익률 계산, 백업/동기화
- 제3자 제공: 없음
- 광고: 없음
- 위치 권한: 사용하지 않음
- 연락처/사진/파일 권한: 1차 버전에서 사용하지 않음
- 계정 삭제: 앱 내 안내 + 웹/API로 삭제 가능해야 함

필요 산출물:

- 개인정보처리방침 페이지
- 계정 삭제 안내 페이지
- Play Console 데이터 보안 답변표

## 8. 출시 단계

### Phase 0. 설계 확정

- MVP 화면 목록 확정
- 앱 이름/패키지명 확정
- 인증 방식 확정
- 개인정보처리방침 초안 작성

완료 기준:

- 이 문서 승인
- 앱 패키지명 결정 예: `kr.kimvibe.economicfreedom`

### Phase 1. 모바일 앱 골격

- `mobile/` Expo 프로젝트 생성
- TypeScript 설정
- 앱 라우팅 구성
- 디자인 토큰/공통 컴포넌트 구성
- 로그인/로그아웃 화면 구현

완료 기준:

- Android 에뮬레이터/실기기에서 앱 실행
- 로그인 화면 접근 가능
- `npm`/`npx expo` 기본 검증 통과

### Phase 2. API 연동

- 모바일 API 클라이언트 작성
- 로그인 토큰 저장
- 포트폴리오 요약 조회
- 보유자산 조회
- 배당 캘린더 조회
- 오류/로딩/빈 상태 처리

완료 기준:

- 실제 계정으로 로그인
- 기존 웹 데이터가 모바일 홈에 표시

### Phase 3. 모바일 대시보드 구현

- 총자산 요약 카드
- 손익/배당/월 적립금 카드
- 자산배분 차트
- 보유종목 리스트
- 수익률 히트맵
- 배당 캘린더
- 은퇴 목표 카드

완료 기준:

- 핵심 화면 4개 이상 실제 데이터로 작동
- 작은 화면에서 가독성 확인

### Phase 4. Play Store 준비

- 앱 아이콘/스플래시
- 앱 이름/설명/스크린샷
- 개인정보처리방침/계정삭제 페이지
- Android 권한 점검
- `eas.json` 작성
- production signing credential 준비

완료 기준:

- `expo-doctor` 통과
- Android production AAB 빌드 성공
- AAB 다운로드 및 `unzip -tq` 검증
- SHA-256 기록

### Phase 5. 내부 테스트

- Play Console 앱 생성
- 내부 테스트 트랙 업로드
- 테스터 등록
- 설치/로그인/조회 테스트
- Play 데이터 보안 답변 입력

완료 기준:

- 내부 테스트 링크로 설치 가능
- 핵심 플로우 정상 동작
- 심사 제출 전 체크리스트 완료

## 9. 파일별 예상 작업

### 신규 파일/디렉터리

- `mobile/package.json`
- `mobile/app.config.ts`
- `mobile/eas.json`
- `mobile/app/_layout.tsx`
- `mobile/app/index.tsx`
- `mobile/app/login.tsx`
- `mobile/app/(tabs)/index.tsx`
- `mobile/app/(tabs)/holdings.tsx`
- `mobile/app/(tabs)/dividends.tsx`
- `mobile/app/(tabs)/settings.tsx`
- `mobile/src/api/client.ts`
- `mobile/src/api/auth.ts`
- `mobile/src/api/portfolio.ts`
- `mobile/src/components/*`
- `mobile/src/storage/session.ts`
- `mobile/src/types.ts`

### 기존 웹앱 수정 후보

- 모바일 토큰 로그인 API 추가
- 계정 삭제 API/페이지 추가
- 개인정보처리방침 페이지 추가
- 모바일용 포트폴리오 요약 API 추가
- CORS/쿠키/토큰 정책 정리

## 10. 리스크와 대응

| 리스크 | 대응 |
|---|---|
| 모바일 인증이 기존 웹 세션과 맞지 않음 | 토큰 기반 모바일 API를 별도 설계 |
| 금융 앱으로 오해받아 심사 부담 | 투자 추천이 아닌 기록/계산 도구로 표현 |
| 민감한 금융정보 저장 부담 | 수집 항목/삭제 방법 명확화, 권한 최소화 |
| 기존 API가 모바일에 비효율적 | `/api/mobile/summary` 같은 집계 API 추가 |
| Play 신규 개발자 계정 테스트 요건 | 내부/폐쇄 테스트 일정을 별도 확보 |

## 11. 우선 결정할 것

1. 앱 이름
2. Android package name
3. 1차 버전 로그인 필수 여부
4. 데이터 저장 방식: 서버 동기화 우선 vs 로컬 우선
5. Play Store 개발자 계정 준비 상태

## 12. 제안 결정안

현재 상황에서는 아래로 진행하는 것이 가장 안전하다.

- 앱 이름: `경제적 자유`
- package name: `kr.kimvibe.economicfreedom`
- 기술: Expo React Native + EAS Build
- 데이터: 기존 서버 DB/API 연동
- 인증: 모바일용 이메일/비밀번호 토큰 로그인 추가
- 1차 출시: 무료 앱, 광고 없음, 투자 추천 없음
- 빌드 산출물: Play Store 업로드용 `.aab`

## 13. 다음 작업 순서

1. 이 문서 기준으로 앱 이름/package name 확정
2. `mobile/` Expo 프로젝트 생성
3. 기존 API 인증 구조 분석 후 모바일 세션 방식 구현
4. 모바일 홈/로그인/보유자산 화면부터 구현
5. 개인정보처리방침/계정삭제 페이지 추가
6. lint/build/export 검증
7. EAS production AAB 빌드
8. Play Console 내부 테스트 업로드
