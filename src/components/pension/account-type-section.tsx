"use client";

import { useState } from "react";
import { ACCOUNT_TYPE_LABELS, ACCOUNT_TYPES, type AccountType } from "@/lib/account-types";
import { formatKRW } from "@/lib/utils";
import { Field, SectionCard, inputClass, primaryButtonClass, sendJson } from "./ui";

export type PlanningAccount = {
  id: string;
  name: string;
  owner_type: string;
  account_type: AccountType;
  value: number;
  annual_dividend: number;
};

const OWNER_LABELS: Record<string, string> = { self: "본인", spouse: "배우자", child: "자녀", other: "기타" };

interface Props {
  accounts: PlanningAccount[];
  onChange: (accounts: PlanningAccount[]) => void;
}

export function AccountTypeSection({ accounts, onChange }: Props) {
  const [name, setName] = useState("");
  const [ownerType, setOwnerType] = useState("self");
  const [accountType, setAccountType] = useState<AccountType>("pension_savings");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [nameMissing, setNameMissing] = useState(false);

  const changeType = async (account: PlanningAccount, next: AccountType) => {
    setSavingId(account.id);
    setError("");
    setStatus("");
    try {
      await sendJson(`/api/accounts/${account.id}`, "PATCH", { accountType: next });
      onChange(accounts.map((a) => (a.id === account.id ? { ...a, account_type: next } : a)));
      setStatus(`${account.name} 계좌의 세제 유형을 저장했습니다: ${ACCOUNT_TYPE_LABELS[next]}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSavingId(null);
    }
  };

  const addAccount = async () => {
    setStatus("");
    // 버튼은 미리 막지 않는다 — 누르면 무엇이 빠졌는지 칸 아래에 알려 준다
    if (!name.trim()) {
      setNameMissing(true);
      document.getElementById("account-type-new-name")?.focus();
      return;
    }
    setNameMissing(false);
    setSavingId("new");
    setError("");
    try {
      const data = await sendJson<{ account: { id: string; name: string; owner_type: string; account_type: AccountType } }>(
        "/api/accounts",
        "POST",
        { name: name.trim(), ownerType, accountType }
      );
      onChange([...accounts, { ...data.account, value: 0, annual_dividend: 0 }]);
      setStatus(`${data.account.name} 계좌를 추가했습니다.`);
      setName("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSavingId(null);
    }
  };

  return (
    <SectionCard
      id="account-types"
      title="계좌 세제 유형"
      description="계좌마다 연금저축·IRP·DC·ISA·일반·자녀 중 하나를 지정하세요. 유형을 정하지 않은 기존 계좌는 '일반'으로 계산합니다."
    >
      <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {accounts.map((account) => (
          <li key={account.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <div>
              <p className="text-sm font-medium">{account.name}</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {OWNER_LABELS[account.owner_type] ?? "기타"} · 평가액 {formatKRW(account.value)}
              </p>
            </div>
            <select
              aria-label={`${account.name} 계좌 유형`}
              value={account.account_type}
              disabled={savingId === account.id}
              onChange={(e) => changeType(account, e.target.value as AccountType)}
              className={`${inputClass} sm:w-44`}
            >
              {ACCOUNT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {ACCOUNT_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </li>
        ))}
      </ul>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <Field label="새 계좌 이름">
          <input
            id="account-type-new-name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (e.target.value.trim()) setNameMissing(false);
            }}
            placeholder="예: 아내 IRP"
            aria-invalid={nameMissing || undefined}
            aria-describedby={nameMissing ? "account-type-new-name-error" : undefined}
            className={inputClass}
          />
          {nameMissing && (
            <p id="account-type-new-name-error" role="alert" className="mt-1 text-xs text-danger">
              새 계좌 이름을 입력해 주세요.
            </p>
          )}
        </Field>
        <Field label="명의">
          <select value={ownerType} onChange={(e) => setOwnerType(e.target.value)} className={inputClass}>
            {Object.entries(OWNER_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="세제 유형">
          <select value={accountType} onChange={(e) => setAccountType(e.target.value as AccountType)} className={inputClass}>
            {ACCOUNT_TYPES.map((type) => (
              <option key={type} value={type}>
                {ACCOUNT_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </Field>
        <div className="flex items-end">
          <button onClick={addAccount} disabled={savingId === "new"} className={`${primaryButtonClass} w-full`}>
            {savingId === "new" ? "추가 중..." : "계좌 추가"}
          </button>
        </div>
      </div>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">새로 만든 계좌는 상단 계좌 선택에서 현재 계좌로 바뀝니다.</p>
      {error && <p role="alert" className="text-xs leading-relaxed text-danger">{error}</p>}
      <p role="status" className="min-h-5 text-xs text-success">{status}</p>
    </SectionCard>
  );
}
