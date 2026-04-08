"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const isLogin = mode === "login";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setError(getErrorMessage(error.message));
        setLoading(false);
        return;
      }
      router.push("/dashboard");
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });
      if (error) {
        setError(getErrorMessage(error.message));
        setLoading(false);
        return;
      }
      setSuccess(true);
      setLoading(false);
    }
  };

  const handleSocialLogin = async (provider: "kakao" | "google") => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  if (success) {
    return (
      <div className="flex flex-1 items-center justify-center px-4">
        <div className="w-full max-w-sm text-center space-y-4">
          <div className="mx-auto w-12 h-12 bg-indigo-500/10 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold">이메일을 확인해주세요</h2>
          <p className="text-sm text-zinc-500">
            <span className="font-medium text-foreground">{email}</span>
            <br />
            으로 인증 링크를 보냈습니다.
          </p>
          <Link
            href="/login"
            className="inline-block text-sm font-medium text-indigo-500 hover:text-indigo-600"
          >
            로그인으로 돌아가기
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
