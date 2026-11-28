"use client";

// 설정 > 계정 — 지금 로그인한 계정(이메일·로그인 방식·로그아웃), 표시 이름, 비밀번호, 계정 삭제(맨 아래 위험 구역).
// 이메일은 입력칸이 아니라 읽을 수 있는 글자로 보여 준다(바꿀 수 없는 값이라 회색 빈칸처럼 보이지 않게).
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { PasswordSection } from "@/components/settings/password-section";
import { AccountDeleteSection } from "@/components/settings/account-delete-section";
import { SaveButton, SaveMessage, type SaveState } from "@/components/settings/save-status";
import { DISPLAY_NAME_EVENT, inputClass, panelClass, secondaryButtonClass, type SettingsTools } from "@/components/settings/settings-shared";

export function loginMethodLabel(hasGoogle: boolean, hasPassword: boolean): string {
  if (hasGoogle && hasPassword) return "Google · 이메일·비밀번호";
  if (hasGoogle) return "Google";
  return "이메일·비밀번호";
}

interface Props {
  email: string;
  initialDisplayName: string;
  hasGoogle: boolean;
  hasPassword: boolean;
  tools: SettingsTools;
}

export function AccountTab({ email, initialDisplayName, hasGoogle, hasPassword, tools }: Props) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [nameState, setNameState] = useState<SaveState>({ kind: "idle" });
  const [copied, setCopied] = useState("");

  // 표시 이름만 보낸다 — API 는 보낸 값만 바꾸므로 월 적립금은 그대로 남는다.
  const saveDisplayName = async (event?: FormEvent) => {
    event?.preventDefault();
    setNameState({ kind: "saving" });
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: displayName.trim() || null }),
      });
      if (!res.ok) throw new Error();
      setDisplayName(displayName.trim());
      window.dispatchEvent(new CustomEvent(DISPLAY_NAME_EVENT, { detail: displayName.trim() || null }));
      setNameState({ kind: "done", message: displayName.trim() ? "표시 이름을 저장했습니다." : "표시 이름을 비웠습니다. 헤더에는 이메일이 보입니다." });
      tools.flash("표시 이름 저장됨");
    } catch {
      setNameState({ kind: "error", message: "표시 이름을 저장하지 못했습니다. 잠시 후 다시 눌러 주세요." });
    }
  };

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(email);
      setCopied("이메일을 복사했습니다.");
    } catch {
      setCopied("복사하지 못했습니다. 이메일을 길게 눌러 직접 복사해 주세요.");
    }
    setTimeout(() => setCopied(""), 2500);
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  return (
    <div className="space-y-5">
      {/* 지금 로그인한 계정 — 헤더의 이름/이메일은 넓은 화면에서만 보이므로 여기서는 어느 폭에서나 보인다 */}
      <section aria-labelledby="settings-current-account" className={panelClass} data-testid="settings-current-account">
        <h2 id="settings-current-account" className="text-base font-bold tracking-tight text-ink">로그인한 계정</h2>
        <dl className="space-y-3">
          <div className="sm:flex sm:items-center sm:gap-6">
          <dt className="text-xs font-medium text-zinc-500 dark:text-zinc-400 sm:w-24 sm:shrink-0">이메일</dt>
          <dd className="flex min-w-0 flex-wrap items-center gap-x-3">
            <span id="settings-email" translate="no" className="min-w-0 break-all text-base font-semibold text-ink select-all">
              {email || "이메일을 불러오지 못했습니다"}
            </span>
            {email && (
              <button
                type="button"
                onClick={copyEmail}
                aria-label="이메일 복사"
                className="inline-flex h-11 items-center px-2 text-xs font-semibold text-brand transition-colors hover:underline focus-visible:outline-2 focus-visible:outline-brand dark:text-indigo-300"
              >
                복사
              </button>
            )}
          </dd>
          </div>
          <div className="sm:flex sm:gap-6">
          <dt className="text-xs font-medium text-zinc-500 dark:text-zinc-400 sm:w-24 sm:shrink-0 sm:pt-0.5">로그인 방식</dt>
          <dd className="mt-1 min-w-0 text-sm text-ink sm:mt-0" data-testid="settings-login-method">
            {loginMethodLabel(hasGoogle, hasPassword)}
            <span className="block text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
              {hasGoogle ? "이메일은 Google 계정에서 가져온 값이라 여기서 바꿀 수 없습니다." : "로그인 아이디로 쓰는 이메일이라 여기서 바꿀 수 없습니다."}
            </span>
          </dd>
          </div>
        </dl>
        {/* 알림 자리는 항상 두되(aria-live) 비어 있을 때는 자리를 차지하지 않는다 */}
        <p aria-live="polite" className={copied ? "text-xs text-success" : "sr-only"}>{copied}</p>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-3 dark:border-zinc-800">
          <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">이 기기에서 로그아웃합니다. 기록은 그대로 남습니다.</p>
          <button type="button" onClick={handleLogout} className={secondaryButtonClass}>
            로그아웃
          </button>
        </div>
      </section>

      {/* 표시 이름 — 따로 저장 */}
      <section aria-labelledby="settings-display-name" className={panelClass}>
        {/* 제목이 곧 입력칸 라벨이다(같은 말을 두 번 적지 않는다) */}
        <h2 id="settings-display-name" className="text-base font-bold tracking-tight text-ink">
          <label htmlFor="settings-field-1">표시 이름</label>
        </h2>
        <form onSubmit={saveDisplayName} className="space-y-2">
          <p id="settings-display-name-help" className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
            화면 오른쪽 위에 이메일 대신 보이는 이름입니다. 비워 두면 이메일이 보입니다.
          </p>
          <div className="flex flex-wrap gap-2">
            <input
              id="settings-field-1"
              name="displayName"
              type="text"
              autoComplete="nickname"
              maxLength={50}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              aria-describedby="settings-display-name-help"
              placeholder="예: 홍길동…"
              className={`${inputClass} min-w-0 flex-1 basis-48`}
            />
            <SaveButton state={nameState} label="표시 이름 저장" testId="settings-save-display-name" />
          </div>
          <SaveMessage state={nameState} />
        </form>
      </section>

      <PasswordSection />

      {/* 위험 구역 — 계정 탭 맨 아래 */}
      <AccountDeleteSection />
    </div>
  );
}
