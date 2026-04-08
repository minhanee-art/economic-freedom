# Pension Manager

연금 ETF 포트폴리오 관리 웹 서비스

## 주요 기능

- 포트폴리오 대시보드 (자산배분 차트, 리밸런싱 알림)
- 목표 비중 기반 자동 매수 계획 & 실행
- 종목별 손익 추적 (평균단가, 수익률)
- 배당금 기록 관리 (월별 차트)
- 매수 기록 히스토리
- 네이버 금융 연동 실시간 시세 조회
- 모바일 반응형 UI

## 기술 스택

- **프레임워크**: Next.js 16 (App Router)
- **언어**: TypeScript
- **스타일**: Tailwind CSS v4
- **차트**: Recharts
- **인증/DB**: Supabase
- **상태관리**: Zustand
- **배포**: Vercel

---

## 배포 가이드 (비개발자용)

### 1단계: Supabase 프로젝트 만들기

1. https://supabase.com 접속 → **Start your project** 클릭
2. GitHub 계정으로 로그인
3. **New project** 클릭
4. 설정 입력:
   - **Name**: pension-manager (아무 이름)
   - **Database Password**: 안전한 비밀번호 입력 (메모해두기)
   - **Region**: Northeast Asia (Tokyo) 선택
5. **Create new project** 클릭 → 2분 정도 기다림

### 2단계: 데이터베이스 테이블 만들기

1. Supabase 대시보드 왼쪽 메뉴에서 **SQL Editor** 클릭 (번개 아이콘)
2. **New query** 클릭
3. 아래 3개 파일의 내용을 **순서대로** 복사/붙여넣기하고 각각 **Run** 클릭:

| 순서 | 파일 | 설명 |
|------|------|------|
| 1 | `supabase/migrations/20260407000001_create_tables.sql` | 테이블 생성 |
| 2 | `supabase/migrations/20260407000002_rls_policies.sql` | 보안 정책 |
| 3 | `supabase/migrations/20260407000003_default_holdings_trigger.sql` | 기본 종목 자동 생성 |

4. 추가로 아래 SQL도 실행:
```sql
alter table profiles add column if not exists last_price_update timestamptz;
```

5. 각 쿼리 실행 후 **Success** 메시지가 나오면 정상

### 3단계: Supabase API 키 확인

1. 왼쪽 하단 **톱니바퀴** 아이콘 (Project Settings) 클릭
2. **Data API** 탭 클릭
3. 두 가지 값을 복사해서 메모장에 붙여넣기:
   - **Project URL**: `https://xxxxxxxx.supabase.co` 형태
   - **anon public** (Project API keys 섹션): `eyJhbGci...` 형태의 긴 문자열

### 4단계: GitHub에 코드 올리기

1. https://github.com 접속 → 로그인
2. 오른쪽 상단 **+** → **New repository** 클릭
3. Repository name: `pension-manager` 입력
4. **Private** 선택 (공개하고 싶으면 Public)
5. **Create repository** 클릭
6. 컴퓨터 터미널에서 프로젝트 폴더로 이동 후 아래 명령어 실행:

```bash
cd pension-manager
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/당신의아이디/pension-manager.git
git push -u origin main
```

### 5단계: Vercel에 배포하기

1. https://vercel.com 접속 → **Sign Up** → GitHub으로 로그인
2. **Add New...** → **Project** 클릭
3. **Import Git Repository** 에서 `pension-manager` 찾기 → **Import** 클릭
4. **Environment Variables** 섹션에서 2개 추가:

| Key | Value |
|-----|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | 3단계에서 복사한 Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 3단계에서 복사한 anon public 키 |

   각각 입력 후 **Add** 클릭

5. **Deploy** 클릭 → 1~2분 기다림
6. 초록색 **Congratulations!** 가 나오면 배포 완료
7. 표시된 URL (예: `pension-manager-xxxx.vercel.app`)로 접속

### 6단계: Supabase 인증 URL 설정 (중요!)

배포 후 반드시 해야 합니다. 안 하면 회원가입 이메일 인증이 작동하지 않습니다.

1. Supabase 대시보드 → **Authentication** (왼쪽 메뉴 사람 아이콘)
2. **URL Configuration** 클릭
3. **Site URL** 에 Vercel 배포 URL 입력:
   - 예: `https://pension-manager-xxxx.vercel.app`
4. **Redirect URLs** 에 추가:
   - `https://pension-manager-xxxx.vercel.app/auth/callback`
5. **Save** 클릭

---

## 로컬 개발 환경

```bash
# 의존성 설치
npm install

# 환경변수 설정
cp .env.example .env.local
# .env.local 파일을 열어서 실제 Supabase 값으로 수정

# 개발 서버 실행
npm run dev
```

http://localhost:3000 에서 확인

## 프로젝트 구조

```
src/
├── app/
│   ├── api/prices/          # 시세 조회 API
│   ├── auth/callback/       # OAuth 콜백
│   ├── dashboard/           # 대시보드 (메인/매수/손익/배당/기록/설정)
│   ├── login/               # 로그인
│   └── signup/              # 회원가입
├── components/
│   ├── charts/              # Recharts 차트 컴포넌트
│   ├── portfolio/           # 포트폴리오 컴포넌트
│   └── ui/                  # 공통 UI
├── lib/
│   ├── supabase/            # Supabase 클라이언트
│   ├── buy-algorithm.ts     # 매수 배분 알고리즘
│   ├── colors.ts            # 자산군별 색상
│   ├── constants.ts         # 기본 종목 데이터
│   └── utils.ts             # 유틸리티
├── stores/                  # Zustand 상태관리
└── types/                   # TypeScript 타입
```

## 환경변수

| 변수 | 설명 | 필수 |
|------|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL | O |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon 공개 키 | O |
