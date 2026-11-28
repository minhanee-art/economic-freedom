"use client";

// 설정 > 비밀번호 — 비밀번호가 있으면 변경, Google 전용 계정이면 새로 설정(모바일 앱 로그인용).
import { useEffect, useState } from "react";
import { InfoTip } from "@/components/ui/info-tip";

type Status = { kind: "idle" | "saving" } | { kind: "done"; message: string } | { kind: "error"; message: string };

const inputClass =
  "w-full h-10 border border-hairline bg-white transition px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-800";

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

  // 불러오는 동안에도 섹션 자리를 잡아 둬 아래 섹션이 늦게 밀려 내려가지 않게 한다(설정 화면 CLS)
  if (hasPassword === null) {
    return (
      <section aria-busy="true" className="min-h-84 border border-hairline dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-card space-y-3">
        <h2 className="text-base font-bold tracking-tight">비밀번호</h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">불러오는 중입니다.</p>
      </section>
    );
  }

  return (
    <section className="border border-hairline dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-card space-y-3">
      <h2 className="text-base font-bold tracking-tight">
        {hasPassword ? "비밀번호 변경" : "비밀번호 설정"}
        {!hasPassword && (
          <InfoTip label="비밀번호 설정 설명" align="start">
            Google로 가입한 계정입니다. 비밀번호를 설정하면 모바일 앱에서 이메일과 비밀번호로 로그인할 수 있습니다.
          </InfoTip>
        )}
      </h2>
      <form onSubmit={submit} className="space-y-3">
        {hasPassword && (
          <div>
            <label htmlFor="current-password" className="block text-xs text-zinc-500 dark:text-zinc-400 mb-1">현재 비밀번호</label>
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
          <label htmlFor="new-password" className="block text-xs text-zinc-500 dark:text-zinc-400 mb-1">새 비밀번호 (6자 이상)</label>
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
          <label htmlFor="confirm-password" className="block text-xs text-zinc-500 dark:text-zinc-400 mb-1">새 비밀번호 확인</label>
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
          <p role={status.kind === "error" ? "alert" : "status"} className={status.kind ==="error" ? "text-xs text-danger" : "text-xs text-success"}>
            {status.message}
          </p>
        )}
        <button
          type="submit"
          disabled={status.kind === "saving"}
          className="w-full h-11 text-sm font-semibold border border-hairline bg-surface text-ink hover:bg-canvas-soft transition-colors disabled:opacity-60 dark:border-zinc-700"
        >
          {status.kind === "saving" ? "저장 중…" : hasPassword ? "비밀번호 변경" : "비밀번호 설정"}
        </button>
      </form>
    </section>
  );
}
