"use client";

// 설정 > 텔레그램 연결 — 현재 계좌에 텔레그램 채팅을 연결 코드로 연결·해제한다.
// chat_id를 직접 입력하지 않는다: 봇에게 코드를 보낸 채팅만 연결되므로, 본인이 쓰는 채팅임이 확인된다.
import { useCallback, useEffect, useState } from "react";

type LinkStatus = {
  accountName: string;
  linked: boolean;
  chatIdMasked: string | null;
  verifiedAt: string | null;
  needsRelink: boolean;
  botUsername: string | null;
};

type IssuedCode = {
  code: string;
  expiresAt: string;
  deepLink: string | null;
  botUsername: string | null;
  issuedAt: number;
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("ko-KR", { dateStyle: "medium", timeStyle: "short" });
}

export function TelegramLinkSection() {
  const [status, setStatus] = useState<LinkStatus | null>(null);
  const [issued, setIssued] = useState<IssuedCode | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "error" | "info"; text: string } | null>(null);

  const applyStatus = useCallback((data: LinkStatus) => {
    setStatus(data);
    // 발급한 코드로 새로 연결됐으면 코드 안내를 닫는다
    const verifiedAt = data.verifiedAt ? Date.parse(data.verifiedAt) : 0;
    setIssued((current) => (current && data.linked && verifiedAt >= current.issuedAt - 60_000 ? null : current));
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/telegram-link", { cache: "no-store" });
      if (res.ok) applyStatus((await res.json()) as LinkStatus);
    } catch {
      /* 상태를 못 읽으면 섹션을 그리지 않는다 */
    }
  }, [applyStatus]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/telegram-link", { cache: "no-store" })
      .then((res) => (res.ok ? (res.json() as Promise<LinkStatus>) : null))
      .then((data) => {
        if (!cancelled && data) applyStatus(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [applyStatus]);

  const issue = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/telegram-link", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as Partial<IssuedCode> & { error?: string };
      if (!res.ok || !data.code || !data.expiresAt) {
        setMessage({ kind: "error", text: data.error ?? "연결 코드를 발급하지 못했습니다." });
        return;
      }
      setIssued({
        code: data.code,
        expiresAt: data.expiresAt,
        deepLink: data.deepLink ?? null,
        botUsername: data.botUsername ?? null,
        issuedAt: Date.now(),
      });
    } catch {
      setMessage({ kind: "error", text: "네트워크 오류로 발급하지 못했습니다." });
    } finally {
      setBusy(false);
    }
  };

  const unlink = async () => {
    if (!confirm("이 계좌의 텔레그램 연결을 해제할까요? 해제하면 수익률 리포트를 보낼 수 없습니다.")) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/telegram-link", { method: "DELETE" });
      if (!res.ok) throw new Error();
      setIssued(null);
      setMessage({ kind: "info", text: "연결을 해제했습니다." });
      await load();
    } catch {
      setMessage({ kind: "error", text: "연결을 해제하지 못했습니다." });
    } finally {
      setBusy(false);
    }
  };

  if (!status) return null;

  return (
    <section className="rounded-2xl border border-hairline dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-card space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">텔레그램 연결</h3>
        <span className="text-2xs text-zinc-400">{status.accountName}</span>
      </div>

      {status.linked ? (
        <p className="text-xs text-zinc-500">
          연결됨 · chat_id {status.chatIdMasked}
          {status.verifiedAt ? ` · ${formatDateTime(status.verifiedAt)} 확인` : ""}
          <br />
          대시보드의 수익률 리포트는 이 채팅으로만 전송됩니다.
        </p>
      ) : (
        <p className="text-xs text-zinc-500">
          {status.needsRelink
            ? "예전에 직접 입력한 chat_id는 본인 채팅인지 확인되지 않아 리포트를 보내지 않습니다. 아래에서 다시 연결해 주세요."
            : "연결된 채팅이 없습니다. 연결 코드를 발급해 봇에게 보내면 그 채팅이 이 계좌에 연결됩니다."}
        </p>
      )}

      {issued && (
        <div className="rounded-xl border border-hairline dark:border-zinc-700 bg-canvas-soft dark:bg-zinc-800/50 p-3 space-y-2">
          <p className="text-xs text-zinc-500">
            {issued.botUsername ? `@${issued.botUsername} 봇` : "봇"}에게 아래 메시지를 보내 주세요.{" "}
            {formatTime(issued.expiresAt)}까지 한 번만 쓸 수 있습니다.
          </p>
          <p className="font-mono text-sm font-semibold tracking-wider select-all">/start {issued.code}</p>
          <div className="flex gap-2">
            {issued.deepLink && (
              <a
                href={issued.deepLink}
                target="_blank"
                rel="noreferrer"
                className="h-9 px-3 inline-flex items-center rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors"
              >
                텔레그램에서 열기
              </a>
            )}
            <button
              type="button"
              onClick={load}
              className="h-9 px-3 rounded-xl border border-hairline dark:border-zinc-700 text-xs font-semibold transition-colors"
            >
              연결 상태 새로고침
            </button>
          </div>
        </div>
      )}

      {message && (
        <p
          role={message.kind === "error" ? "alert" : "status"}
          className={message.kind === "error" ? "text-xs text-red-600 dark:text-red-400" : "text-xs text-emerald-600"}
        >
          {message.text}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={issue}
          disabled={busy}
          className="flex-1 h-10 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 shadow-card transition-colors disabled:opacity-60"
        >
          {status.linked ? "다른 채팅으로 다시 연결" : issued ? "새 코드 발급" : "연결 코드 발급"}
        </button>
        {(status.linked || status.needsRelink) && (
          <button
            type="button"
            onClick={unlink}
            disabled={busy}
            className="h-10 px-4 rounded-xl border border-hairline dark:border-zinc-700 text-sm font-semibold text-red-600 transition-colors disabled:opacity-60"
          >
            연결 해제
          </button>
        )}
      </div>
    </section>
  );
}
