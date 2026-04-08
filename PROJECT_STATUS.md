# Pension Manager - 프로젝트 진행 현황

## 프로젝트 개요
- **이름**: pension-manager
- **설명**: 연금 ETF 포트폴리오 관리 웹 서비스 (다중 사용자)
- **기술스택**: Next.js 16 / TypeScript / Tailwind CSS v4 / Recharts / Supabase / Zustand
- **배포**: Vercel
- **작업일**: 2026-04-07

---

## 완료된 작업

### Phase 1: 프로젝트 초기 세팅

| 항목 | 상태 |
|------|------|
| Next.js 16 App Router + TypeScript 프로젝트 생성 | ✅ |
| 패키지 설치 (supabase, recharts, date-fns, zustand) | ✅ |
| Pretendard 한글 폰트 적용 (CDN) | ✅ |
| 모바일 반응형 레이아웃 (max-w-860px) | ✅ |
| `.env.local` 환경변수 템플릿 | ✅ |

**생성된 페이지** (10개 라우트):
- `/` - 랜딩 페이지 (로그인/회원가입 링크)
- `/login` - 로그인 (Supabase Auth 연동)
- `/signup` - 회원가입 (Supabase Auth 연동)
- `/dashboard` - 대시보드 메인 (탭 네비게이션 포함)
- `/dashboard/buy` - 매수 계획
- `/dashboard/pnl` - 손익 추적
- `/dashboard/dividend` - 배당금
- `/dashboard/history` - 매수 기록
- `/dashboard/settings` - 설정

**생성된 인프라 파일**:
- `src/lib/supabase/client.ts` - 브라우저용 Supabase 클라이언트
- `src/lib/supabase/server.ts` - 서버용 Supabase 클라이언트
- `src/lib/supabase/middleware.ts` - 인증 미들웨어 (비로그인 시 /login 리다이렉트)
- `src/middleware.ts` - Next.js 미들웨어 (dashboard 경로 보호)
- `src/stores/portfolio-store.ts` - Zustand 상태관리
- `src/types/index.ts` - 전체 TypeScript 타입 정의
- `src/lib/constants.ts` - 기본 종목 데이터, 상수
- `src/lib/utils.ts` - 날짜/통화/퍼센트 포매팅, cn 유틸

### Phase 2: Supabase 데이터베이스 스키마

| 항목 | 상태 |
|------|------|
| 6개 테이블 생성 SQL | ✅ |
| RLS 정책 (모든 테이블 CRUD) | ✅ |
| 인덱스 (unique 포함) | ✅ |
| updated_at 자동갱신 트리거 | ✅ |
| 신규가입 시 기본 종목 15개 자동 생성 트리거 | ✅ |

**테이블 구조**:
| 테이블 | 설명 |
|--------|------|
| `profiles` | 사용자 프로필 (월 예산 기본 30만원) |
| `holdings` | 보유 종목 15개 (user_id+code unique) |
| `purchase_records` | 매수 기록 헤더 (날짜, 총액) |
| `purchase_items` | 매수 상세 (종목별 수량/가격) |
| `dividends` | 배당금 수령 기록 |
| `cost_basis` | 평균단가 계산용 원가 기록 |

**마이그레이션 파일** (`supabase/migrations/`):
1. `20260407000001_create_tables.sql` - 테이블, 인덱스, updated_at 트리거
2. `20260407000002_rls_policies.sql` - RLS 정책
3. `20260407000003_default_holdings_trigger.sql` - 기본 종목 자동 생성

---

## 내가 해야 할 일

### 1단계: Supabase 프로젝트 설정 (필수, 먼저)

1. **Supabase 프로젝트 생성**
   - https://supabase.com 에서 새 프로젝트 생성
   - Region: Northeast Asia (ap-northeast-1) 권장

2. **환경변수 설정**
   - `.env.local` 파일을 열어서 실제 값으로 교체:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
   ```
   - 값은 Supabase 대시보드 → Settings → API 에서 확인

3. **SQL 마이그레이션 실행**
   - Supabase 대시보드 → SQL Editor 접속
   - 아래 3개 파일을 **순서대로** 복사/붙여넣기 후 실행:
     1. `supabase/migrations/20260407000001_create_tables.sql`
     2. `supabase/migrations/20260407000002_rls_policies.sql`
     3. `supabase/migrations/20260407000003_default_holdings_trigger.sql`

4. **동작 확인**
   ```bash
   cd pension-manager
   npm run dev
   ```
   - http://localhost:3000 접속
   - 회원가입 → 이메일 확인 → 로그인 → 대시보드 진입 확인

### 2단계: 기능 구현 (다음 개발 세션)

| 우선순위 | 페이지 | 구현 내용 |
|---------|--------|----------|
| 1 | `/dashboard` | 포트폴리오 요약 (보유종목 테이블, 자산배분 파이차트) |
| 2 | `/dashboard/buy` | 월 예산 기반 매수 수량 자동 계산, 매수 실행 |
| 3 | `/dashboard/pnl` | 종목별 손익 현황, 수익률 차트 |
| 4 | `/dashboard/history` | 매수 기록 리스트, 월별 필터 |
| 5 | `/dashboard/dividend` | 배당금 입력/조회, 월별 배당금 차트 |
| 6 | `/dashboard/settings` | 월 예산 변경, 종목 추가/삭제, 목표비중 수정 |

### 3단계: 고도화 (선택)

- 현재가 자동 업데이트 (크롤링 또는 API)
- 리밸런싱 알림
- 배당 캘린더
- 다크모드 토글
- Vercel 배포

---

## 프로젝트 구조

```
pension-manager/
├── .env.local                          # Supabase 환경변수 (수정 필요)
├── package.json
├── supabase/
│   └── migrations/
│       ├── 20260407000001_create_tables.sql
│       ├── 20260407000002_rls_policies.sql
│       └── 20260407000003_default_holdings_trigger.sql
└── src/
    ├── app/
    │   ├── globals.css
    │   ├── layout.tsx                  # 루트 레이아웃 (Pretendard 폰트)
    │   ├── page.tsx                    # 랜딩 페이지
    │   ├── login/page.tsx              # 로그인
    │   ├── signup/page.tsx             # 회원가입
    │   └── dashboard/
    │       ├── layout.tsx              # 대시보드 레이아웃 (헤더+탭)
    │       ├── page.tsx                # 대시보드 메인
    │       ├── buy/page.tsx            # 매수 계획
    │       ├── pnl/page.tsx            # 손익 추적
    │       ├── dividend/page.tsx       # 배당금
    │       ├── history/page.tsx        # 매수 기록
    │       └── settings/page.tsx       # 설정
    ├── components/
    │   ├── ui/                         # 공통 UI (버튼, 인풋 등)
    │   ├── charts/                     # Recharts 차트
    │   └── portfolio/                  # 포트폴리오 관련
    ├── lib/
    │   ├── supabase/
    │   │   ├── client.ts               # 브라우저용
    │   │   ├── server.ts               # 서버용
    │   │   └── middleware.ts           # 인증 미들웨어
    │   ├── constants.ts                # 기본 종목 데이터
    │   └── utils.ts                    # 유틸리티 함수
    ├── middleware.ts                    # Next.js 미들웨어
    ├── stores/
    │   └── portfolio-store.ts          # Zustand 스토어
    └── types/
        └── index.ts                    # TypeScript 타입
```
