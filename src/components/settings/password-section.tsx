"use client";

// 설정 > 비밀번호 — 비밀번호가 있으면 변경, Google 전용 계정이면 새로 설정(모바일 앱 로그인용).
import { useEffect, useState } from "react";

type Status = { kind: "idle" | "saving" } | { kind: "done"; message: string } | { kind: "error"; message: string };

const inputClass =
  "w-full h-10 rounded-xl border border-hairline bg-white transition px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-800";

export function PasswordSection() {
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/password")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { hasPassword?: boolean } | null) => {
        if (!cancelled && data) setHasPassword(Boolean(data.hasPassword));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      setStatus({ kind: "error", message: "새 비밀번호가 서로 다릅니다." });
      return;
    }
    setStatus({ kind: "saving" });
    try {
      const res = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(hasPassword ? { currentPassword, newPassword } : { newPassword }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setStatus({ kind: "error", message: data.error ?? "비밀번호를 저장하지 못했습니다." });
        return;
      }
      setStatus({ kind: "done", message: hasPassword ? "비밀번호를 변경했습니다." : "비밀번호를 설정했습니다." });
      setHasPassword(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      setStatus({ kind: "error", message: "네트워크 오류로 저장하지 못했습니다." });
    }
  };

  if (hasPassword === null) return null;

  return (
    <section className="rounded-2xl border border-hairline dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-card space-y-3">
      <h3 className="text-sm font-semibold">{hasPassword ? "비밀번호 변경" : "비밀번호 설정"}</h3>
      {!hasPassword && (
        <p className="text-xs text-zinc-500">
          Google로 가입한 계정입니다. 비밀번호를 설정하면 모바일 앱에서 이메일과 비밀번호로 로그인할 수 있습니다.
        </p>
      )}
      <form onSubmit={submit} className="space-y-3">
        {hasPassword && (
          <div>
            <label htmlFor="current-password" className="block text-xs text-zinc-500 mb-1">현재 비밀번호</label>
            <input
              id="current-password"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              className={inputClass}
            />
          </div>
        )}
        <div>
          <label htmlFor="new-password" className="block text-xs text-zinc-500 mb-1">새 비밀번호 (6자 이상)</label>
          <input
            id="new-password"
            type="password"
            autoComplete="new-password"
            minLength={6}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="confirm-password" className="block text-xs text-zinc-500 mb-1">새 비밀번호 확인</label>
          <input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            minLength={6}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            className={inputClass}
          />
        </div>
        {(status.kind === "error" || status.kind === "done") && (
          <p role={status.kind === "error" ? "alert" : "status"} className={status.kind === "error" ? "text-xs text-red-600 dark:text-red-400" : "text-xs text-emerald-600"}>
            {status.message}
          </p>
        )}
        <button
          type="submit"
          disabled={status.kind === "saving"}
          className="w-full h-10 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 shadow-card transition-colors disabled:opacity-60"
        >
          {status.kind === "saving" ? "저장 중…" : hasPassword ? "비밀번호 변경" : "비밀번호 설정"}
        </button>
      </form>
    </section>
  );
}
