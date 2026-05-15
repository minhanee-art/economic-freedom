"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const SAVED_EMAIL_KEY = "pension-manager-saved-email";

interface AuthFormProps {
  mode: "login" | "signup";
}

const ERROR_MESSAGES: Record<string, string> = {
  "Invalid login credentials": "이메일 또는 비밀번호가 올바르지 않습니다.",
  "Email not confirmed": "이메일 인증이 완료되지 않았습니다. 메일함을 확인해주세요.",
  "User already registered": "이미 가입된 이메일입니다.",
  "Password should be at least 6 characters": "비밀번호는 6자 이상이어야 합니다.",
  "Unable to validate email address: invalid format": "올바른 이메일 형식이 아닙니다.",
  "Email rate limit exceeded": "너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해주세요.",
};

function getErrorMessage(error: string): string {
  return ERROR_MESSAGES[error] || error;
}

export function AuthForm({ mode }: AuthFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberEmail, setRememberEmail] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const isLogin = mode === "login";

  // 저장된 이메일 불러오기
  useEffect(() => {
    const saved = localStorage.getItem(SAVED_EMAIL_KEY);
    if (saved) {
      setEmail(saved);
      setRememberEmail(true);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const endpoint = isLogin ? "/api/auth/login" : "/api/auth/signup";
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? "오류가 발생했습니다.");
      setLoading(false);
      return;
    }

    if (isLogin) {
      if (rememberEmail) {
        localStorage.setItem(SAVED_EMAIL_KEY, email);
      } else {
        localStorage.removeItem(SAVED_EMAIL_KEY);
      }
      router.push("/dashboard");
    } else {
      setSuccess(true);
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex flex-1 items-center justify-center px-4">
        <div className="w-full max-w-sm text-center space-y-4">
          <div className="mx-auto w-12 h-12 bg-indigo-500/10 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold">가입 완료</h2>
          <p className="text-sm text-zinc-500">계정이 생성되었습니다. 로그인해주세요.</p>
          <Link href="/login" className="inline-block text-sm font-medium text-indigo-500 hover:text-indigo-600">
            로그인으로 이동
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        {/* 헤더 */}
        <div className="text-center space-y-2">
          <Link href="/" className="inline-block">
            <h1 className="text-2xl font-bold text-dark-header dark:text-white">
              Pension Manager
            </h1>
          </Link>
          <p className="text-sm text-zinc-500">
            {isLogin ? "계정에 로그인하세요" : "새 계정을 만드세요"}
          </p>
        </div>

        {/* 이메일 폼 */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="email" className="block text-sm font-medium">
              이메일
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              required
              className="w-full h-11 rounded-lg border border-zinc-200 bg-white px-3 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="password" className="block text-sm font-medium">
              비밀번호
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isLogin ? "비밀번호 입력" : "6자 이상 입력"}
              required
              minLength={6}
              className="w-full h-11 rounded-lg border border-zinc-200 bg-white px-3 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>

          {isLogin && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={rememberEmail}
                onChange={(e) => setRememberEmail(e.target.checked)}
                className="w-4 h-4 rounded border-zinc-300 text-indigo-500 focus:ring-indigo-500"
              />
              <span className="text-sm text-zinc-500">아이디 저장</span>
            </label>
          )}

          {error && (
            <div className="rounded-lg bg-red-50 dark:bg-red-900/20 px-3 py-2.5 text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 rounded-lg bg-indigo-500 text-white text-sm font-medium transition-colors hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading
              ? isLogin
                ? "로그인 중..."
                : "가입 중..."
              : isLogin
                ? "로그인"
                : "회원가입"}
          </button>
        </form>

        {/* 구분선 */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-zinc-200 dark:border-zinc-700" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-white dark:bg-zinc-950 px-2 text-zinc-400">또는</span>
          </div>
        </div>

        {/* 구글 로그인 버튼 */}
        <a
          href="/api/auth/google"
          className="flex items-center justify-center gap-3 w-full h-11 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Google로 {isLogin ? "로그인" : "회원가입"}
        </a>

        {/* 하단 링크 */}
        <p className="text-center text-sm text-zinc-500">
          {isLogin ? "계정이 없으신가요?" : "이미 계정이 있으신가요?"}{" "}
          <Link
            href={isLogin ? "/signup" : "/login"}
            className="font-medium text-indigo-500 hover:text-indigo-600"
          >
            {isLogin ? "회원가입" : "로그인"}
          </Link>
        </p>
      </div>
    </div>
  );
}
