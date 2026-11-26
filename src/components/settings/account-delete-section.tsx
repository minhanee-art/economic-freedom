"use client";

// 설정 화면의 계정 삭제 섹션 — 비밀번호 계정은 비밀번호, Google 전용 계정은 이메일 확인으로 본인 확인 후 DELETE /api/me
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type MeInfo = { email: string | null; hasPassword: boolean };

export function AccountDeleteSection() {
  const router = useRouter();
  const [me, setMe] = useState<MeInfo | null>(null);
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) setMe({ email: data.email ?? null, hasPassword: data.hasPassword !== false });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const needsPassword = me?.hasPassword ?? true;

  const close = () => {
    setOpen(false);
    setValue("");
    setError("");
  };

  const handleDelete = async () => {
    if (!value.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/me", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(needsPassword ? { password: value } : { confirmEmail: value }),
      });
      if (res.ok) {
        router.push("/");
        router.refresh();
        return;
      }
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "계정을 삭제하지 못했습니다. 잠시 후 다시 시도해주세요.");
    } catch {
      setError("네트워크 오류로 계정을 삭제하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-red-600 dark:text-red-400">계정 삭제</h2>
      <div className="rounded-xl border border-red-200 bg-white p-4 shadow-card dark:border-red-900 dark:bg-zinc-900">
        <p className="text-sm text-zinc-500">
          계정과 입력한 모든 데이터(보유 종목, 매수·배당 기록, 자녀 증여 기록 등)가 즉시 영구 삭제되며 복구할 수 없습니다.{" "}
          <Link href="/account-deletion" className="underline">
            삭제 안내
          </Link>
        </p>

        {!open ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="mt-3 h-11 w-full rounded-xl border border-red-300 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
          >
            계정 삭제
          </button>
        ) : (
          <div className="mt-3 space-y-3">
            <label className="block text-sm font-medium" htmlFor="account-delete-confirm">
              {needsPassword
                ? "본인 확인을 위해 비밀번호를 입력해주세요"
                : `본인 확인을 위해 계정 이메일${me?.email ? `(${me.email})` : ""}을 입력해주세요`}
            </label>
            <input
              id="account-delete-confirm"
              type={needsPassword ? "password" : "email"}
              autoComplete={needsPassword ? "current-password" : "off"}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              disabled={busy}
              className="h-11 w-full rounded-xl border border-hairline bg-canvas-soft px-3 text-sm focus:outline-none focus:ring-1 focus:ring-red-500 dark:border-zinc-700 dark:bg-zinc-800"
            />
            {error && (
              <p role="alert" className="text-sm text-red-600">
                {error}
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={close}
                disabled={busy}
                className="h-11 flex-1 rounded-xl border border-hairline text-sm font-medium transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={busy || !value.trim()}
                className="h-11 flex-1 rounded-xl bg-red-500 text-sm font-semibold text-white shadow-card transition-colors hover:bg-red-600 disabled:opacity-50"
              >
                {busy ? "삭제 중..." : "계정 영구 삭제"}
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
