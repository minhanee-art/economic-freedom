"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const SAVED_EMAIL_KEY = "pension-manager-saved-email";
// 서버 검증(src/lib/auth-account.ts MIN_PASSWORD_LENGTH)과 같은 값. 그 파일은 DB를 불러오므로 클라이언트에서 import 하지 않는다.
const MIN_PASSWORD_LENGTH = 6;
const NETWORK_ERROR = "서버에 연결하지 못했습니다. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.";
const MISMATCH_ERROR = "비밀번호가 서로 다릅니다. 두 칸에 같은 비밀번호를 입력해 주세요.";

interface AuthFormProps {
  mode: "login" | "signup";
  initialError?: string;
}

const inputClass =
  "h-12 w-full border border-zinc-300 bg-white px-3.5 text-base text-ink placeholder:text-zinc-500 transition-colors focus:border-indigo-500 focus:outline-2 focus:outline-offset-0 focus:outline-indigo-500 aria-invalid:border-danger dark:border-zinc-700 dark:bg-zinc-950 dark:text-white dark:placeholder:text-zinc-400";
const labelClass = "block text-sm font-semibold text-ink dark:text-zinc-200";

function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  placeholder,
  hint,
  invalid,
  describedBy,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: "current-password" | "new-password";
  placeholder?: string;
  hint?: { id: string; text: string; tone?: "error" };
  invalid?: boolean;
  describedBy?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required
          minLength={MIN_PASSWORD_LENGTH}
          aria-describedby={[hint?.id, describedBy].filter(Boolean).join(" ") || undefined}
          aria-invalid={invalid || undefined}
          className={`${inputClass} pr-16`}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-pressed={visible}
          aria-controls={id}
          aria-label={`${label} ${visible ? "숨기기" : "표시"}`}
          className="absolute inset-y-0 right-0 flex min-w-14 items-center justify-center px-3 text-sm font-semibold text-zinc-600 hover:text-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-indigo-500 dark:text-zinc-400 dark:hover:text-white"
        >
          {visible ? "숨기기" : "표시"}
        </button>
      </div>
      {hint && (
        <p
          id={hint.id}
          className={
            hint.tone === "error"
              ? "text-sm font-medium text-danger"
              : "text-sm text-zinc-600 dark:text-zinc-400"
          }
        >
          {hint.text}
        </p>
      )}
    </div>
  );
}

export function AuthForm({ mode, initialError }: AuthFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [rememberEmail, setRememberEmail] = useState(false);
  const [error, setError] = useState(initialError ?? "");
  const [loading, setLoading] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const isLogin = mode === "login";
  const mismatch = !isLogin && passwordConfirm.length > 0 && password !== passwordConfirm;

  // 저장된 이메일 불러오기 (localStorage는 클라이언트 전용이라 마운트 후 1회 동기화)
  useEffect(() => {
    const saved = localStorage.getItem(SAVED_EMAIL_KEY);
    if (saved) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setEmail(saved);
      setRememberEmail(true);
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, []);

  const showError = (message: string) => {
    setError(message);
    // 오류가 화면에 그려진 뒤 그 문구로 초점을 옮겨 스크린리더와 키보드 사용자가 바로 알 수 있게 한다.
    requestAnimationFrame(() => errorRef.current?.focus());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError("");

    if (!isLogin && password !== passwordConfirm) {
      showError(MISMATCH_ERROR);
      return;
    }

    setLoading(true);
    let navigating = false;
    try {
      const endpoint = isLogin ? "/api/auth/login" : "/api/auth/signup";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };

      if (!res.ok) {
        showError(data.error ?? "요청을 처리하지 못했습니다. 잠시 뒤 다시 시도해 주세요.");
        return;
      }

      if (isLogin) {
        if (rememberEmail) {
          localStorage.setItem(SAVED_EMAIL_KEY, email);
        } else {
          localStorage.removeItem(SAVED_EMAIL_KEY);
        }
      }
      // 가입 API도 로그인과 같은 세션 쿠키를 준다(src/app/api/auth/signup) — 앱처럼 가입 즉시 홈으로 간다.
      navigating = true;
      router.push("/dashboard");
    } catch {
      showError(NETWORK_ERROR);
    } finally {
      // 대시보드로 이동하는 동안에는 버튼을 '로그인 중'으로 두어 두 번 제출되지 않게 한다.
      if (!navigating) setLoading(false);
    }
  };

  return (
    <AuthShell>
      <h1 className="text-2xl font-bold tracking-tight text-dark-header dark:text-white">{isLogin ? "로그인" : "회원가입"}</h1>

      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
        <div className="space-y-1.5">
          <label htmlFor="email" className={labelClass}>
            이메일
          </label>
          <input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            required
            aria-invalid={(isLogin && Boolean(error)) || undefined}
            aria-describedby={error ? "auth-error" : undefined}
            className={inputClass}
          />
        </div>

        <PasswordField
          id="password"
          label="비밀번호"
          value={password}
          onChange={setPassword}
          autoComplete={isLogin ? "current-password" : "new-password"}
          hint={isLogin ? undefined : { id: "password-hint", text: `${MIN_PASSWORD_LENGTH}자 이상 입력해 주세요.` }}
          invalid={isLogin && Boolean(error)}
          describedBy={isLogin && error ? "auth-error" : undefined}
        />

        {!isLogin && (
          <PasswordField
            id="password-confirm"
            label="비밀번호 확인"
            value={passwordConfirm}
            onChange={setPasswordConfirm}
            autoComplete="new-password"
            placeholder="한 번 더 입력"
            hint={mismatch ? { id: "password-confirm-hint", text: "비밀번호가 서로 다릅니다.", tone: "error" } : undefined}
            invalid={mismatch}
          />
        )}

        {isLogin && (
          <label className="flex min-h-11 cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={rememberEmail}
              onChange={(e) => setRememberEmail(e.target.checked)}
              className="h-5 w-5 accent-indigo-500"
            />
            <span className="text-base text-ink dark:text-zinc-300">아이디 저장</span>
          </label>
        )}

        {error && (
          <div
            ref={errorRef}
            id="auth-error"
            role="alert"
            tabIndex={-1}
            className="flex gap-2 border border-danger-line bg-danger-soft px-3.5 py-3 text-sm font-medium leading-6 text-danger break-keep focus:outline-2 focus:outline-offset-2 focus:outline-danger"
          >
            <svg aria-hidden="true" className="mt-1 h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {!isLogin && (
          <p className="text-sm leading-6 text-zinc-600 break-keep dark:text-zinc-400">
            가입하면{" "}
            <Link href="/privacy" className="font-semibold text-indigo-600 underline underline-offset-4 dark:text-indigo-300">
              개인정보처리방침
            </Link>
            에 동의한 것으로 봅니다.
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="h-12 w-full bg-indigo-500 text-base font-bold text-white transition-colors hover:bg-indigo-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:cursor-not-allowed disabled:bg-indigo-400"
        >
          {loading ? (isLogin ? "로그인 중..." : "가입 중...") : isLogin ? "로그인" : "회원가입"}
        </button>
      </form>

      <div className="my-6 flex items-center gap-3 text-sm text-zinc-600 dark:text-zinc-400">
        <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-700" />
        또는
        <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-700" />
      </div>

      <a
        href="/api/auth/google"
        className="flex h-12 w-full items-center justify-center gap-3 border border-zinc-300 bg-white text-base font-semibold text-ink transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
        Google로 {isLogin ? "로그인" : "회원가입"}
      </a>

      <p className="mt-6 text-center text-base text-zinc-600 dark:text-zinc-400">
        {isLogin ? "계정이 없으신가요?" : "이미 계정이 있으신가요?"}{" "}
        <Link
          href={isLogin ? "/signup" : "/login"}
          className="inline-flex min-h-11 items-center font-semibold text-indigo-600 underline underline-offset-4 hover:text-indigo-700 dark:text-indigo-300"
        >
          {isLogin ? "회원가입" : "로그인"}
        </Link>
      </p>
    </AuthShell>
  );
}

function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-background dark:bg-zinc-950">
      <header className="bg-dark-header text-white">
        <div className="mx-auto flex h-16 max-w-280 items-center px-4 sm:px-6">
          <Link href="/" className="text-lg font-bold tracking-tight">
            가족연금계획
          </Link>
        </div>
      </header>
      <main className="flex flex-1 items-start justify-center px-4 py-10 sm:items-center sm:py-16">
        <div className="w-full max-w-sm border border-zinc-200 bg-white p-6 sm:p-8 dark:border-zinc-800 dark:bg-zinc-900">
          {children}
        </div>
      </main>
    </div>
  );
}
