"use client";

import { useMemo, useState } from "react";
import { EmojiLine } from "@/components/ui/info-tip";
import { ACCOUNT_TYPE_LABELS, isPensionAccountType } from "@/lib/account-types";
import { ACCOUNT_OWNER_LABELS, computeFamilyTaxCredit, normalizeAccountOwner } from "@/lib/pension-planning";
import type { PensionRuleSet, SalaryBracket } from "@/lib/pension-rules";
import { formatAmountInput, formatKRWFull, formatKRW, parseAmountInput } from "@/lib/utils";
import type { PlanningAccount } from "./account-type-section";
import {
  ProgressBar,
  SectionCard,
  Stat,
  TaxDisclaimer,
  inputClass,
  parseNumberInput,
  secondaryButtonClass,
  sendJson,
} from "./ui";

export type ContributionMap = Record<string, number>;

interface Props {
  year: number;
  rules: PensionRuleSet & { exact: boolean };
  accounts: PlanningAccount[];
  contributions: ContributionMap;
  onContributionsChange: (next: ContributionMap) => void;
  salaryBracket: SalaryBracket | null;
  /** 배우자 총급여 구간 — 은퇴 목표 폼에서 입력한다. null이면 낮은 공제율로 가정 */
  spouseSalaryBracket: SalaryBracket | null;
  onSalaryBracketChange: (next: SalaryBracket) => void;
}

export function ContributionSection({
  year,
  rules,
  accounts,
  contributions,
  onContributionsChange,
  salaryBracket,
  spouseSalaryBracket,
  onSalaryBracketChange,
}: Props) {
  const targetAccounts = accounts.filter((a) => isPensionAccountType(a.account_type) || a.account_type === "isa");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const bracket: SalaryBracket = salaryBracket ?? "high";
  // 한도·공제율은 명의자 개인 기준 — 본인·배우자를 따로 계산해 더하고, 자녀·기타 명의는 뺀다.
  // 소득 구간이 미입력인 명의자는 낮은 공제율로 가정한다.
  const family = useMemo(
    () =>
      computeFamilyTaxCredit(
        targetAccounts.map((a) => ({
          accountId: a.id,
          ownerType: a.owner_type,
          accountType: a.account_type,
          amount: contributions[a.id] ?? 0,
        })),
        { self: salaryBracket, spouse: spouseSalaryBracket },
        rules
      ),
    [targetAccounts, contributions, salaryBracket, spouseSalaryBracket, rules]
  );
  const progress = family.total;
  const totalLimit = rules.taxCredit.combinedLimit * family.byOwner.length;
  const excludedIds = new Set(family.excluded.map((e) => e.accountId));

  const save = async (accountId: string) => {
    const raw = drafts[accountId];
    const amount = parseNumberInput(raw ?? "");
    if (amount === null || !Number.isInteger(amount) || amount < 0) {
      setError("납입액은 0 이상의 숫자(원)로 입력해주세요.");
      return;
    }
    setSavingId(accountId);
    setError("");
    try {
      await sendJson("/api/pension/contributions", "PUT", { accountId, year, amount });
      onContributionsChange({ ...contributions, [accountId]: amount });
      setDrafts((d) => {
        const next = { ...d };
        delete next[accountId];
        return next;
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSavingId(null);
    }
  };

  const rateLabel = (b: SalaryBracket) =>
    `${rules.taxCredit.rates[b].label} · 공제율 ${(rules.taxCredit.rates[b].rate * 100).toFixed(1)}%`;

  return (
    <SectionCard
      title={`${year}년 연금계좌 세액공제 진행률`}
      description={`연금저축 ${formatKRW(rules.taxCredit.pensionSavingsLimit)}, 연금저축+IRP·DC 본인 납입 합산 ${formatKRW(
        rules.taxCredit.combinedLimit
      )}까지 세액공제 대상입니다.`}
    >
      <fieldset className="space-y-1">
        <legend className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">본인 총급여 구간</legend>
        {(["low", "high"] as SalaryBracket[]).map((b) => (
          <label key={b} className="flex min-h-11 items-center gap-3 text-sm">
            <input type="radio" className="h-5 w-5 accent-brand" name="salary-bracket" checked={bracket === b} onChange={() => onSalaryBracketChange(b)} />
            {rateLabel(b)}
          </label>
        ))}
        {salaryBracket === null && <p className="text-xs text-zinc-500 dark:text-zinc-400">구간을 고르지 않으면 낮은 공제율로 계산합니다.</p>}
      </fieldset>

      {targetAccounts.length === 0 ? (
        <EmojiLine emoji="🏦" as="p" className="text-sm text-zinc-500 dark:text-zinc-400">
          연금저축·IRP·DC·ISA 계좌가 없습니다. 아래 &lsquo;계좌 세제 유형&rsquo;에서 지정하세요.
        </EmojiLine>
      ) : (
        <ul className="space-y-2">
          {targetAccounts.map((account) => {
            const saved = contributions[account.id] ?? 0;
            const draft = drafts[account.id];
            return (
              <li key={account.id} className="flex flex-wrap items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{account.name}</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {ACCOUNT_OWNER_LABELS[normalizeAccountOwner(account.owner_type)]} · {ACCOUNT_TYPE_LABELS[account.account_type]} · 저장된 {year}년 납입 {formatKRWFull(saved)}
                    {account.account_type === "dc" && " (본인 추가납입분만 입력)"}
                    {excludedIds.has(account.id) && " · 세액공제 계산 제외"}
                  </p>
                </div>
                <input
                  inputMode="numeric"
                  aria-label={`${account.name} ${year}년 납입액`}
                  value={formatAmountInput(draft ?? String(saved))}
                  onChange={(e) => setDrafts((d) => ({ ...d, [account.id]: parseAmountInput(e.target.value) }))}
                  className={`${inputClass} sm:w-40`}
                />
                <button
                  onClick={() => save(account.id)}
                  disabled={draft === undefined || savingId === account.id}
                  className={secondaryButtonClass}
                >
                  {savingId === account.id ? "저장 중" : "저장"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {error && <p role="alert" className="text-xs leading-relaxed text-danger">{error}</p>}

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
          <span>
            {family.byOwner.length > 1 ? "가족 합계 " : ""}공제 대상 {formatKRW(progress.creditableTotal)} / {formatKRW(totalLimit)}
          </span>
          <span>{progress.progressPct.toFixed(0)}%</span>
        </div>
        <ProgressBar pct={progress.progressPct} />
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="예상 세액공제액" value={formatKRWFull(progress.estimatedCredit)} hint={`한도 채우면 ${formatKRW(progress.maxCredit)}`} />
        <Stat label="남은 공제 한도" value={formatKRW(progress.remainingCreditRoom)} hint={`연금저축으로는 ${formatKRW(progress.remainingPensionSavingsRoom)}까지`} />
        <Stat label="연금저축 납입" value={formatKRW(progress.pensionSavingsPaid)} hint={`공제 대상 ${formatKRW(progress.creditablePensionSavings)}`} />
        <Stat label="IRP·DC 납입" value={formatKRW(progress.retirementPaid)} hint={`ISA ${formatKRW(progress.isaPaid)}`} />
      </div>

      {family.byOwner.length > 1 && (
        <details className="text-xs text-zinc-500 dark:text-zinc-400">
          <summary className="flex min-h-11 cursor-pointer items-center font-medium text-ink focus-visible:outline-2 focus-visible:outline-brand">명의별 계산 보기</summary>
          <ul className="space-y-1 pb-2">
          {family.byOwner.map((o) => (
            <li key={o.ownerType}>
              {ACCOUNT_OWNER_LABELS[o.ownerType]}: 공제 대상 {formatKRW(o.progress.creditableTotal)} /{" "}
              {formatKRW(rules.taxCredit.combinedLimit)} · 예상 공제액 {formatKRWFull(o.progress.estimatedCredit)} · 공제율{" "}
              {(o.progress.rate * 100).toFixed(1)}%{o.salaryBracketAssumed &&
                (o.ownerType === "spouse"
                  ? " (배우자 소득 구간 미입력 — 낮은 공제율로 가정, 위 은퇴 목표에서 입력)"
                  : " (소득 구간 미입력 — 낮은 공제율로 가정)")}
            </li>
          ))}
          </ul>
        </details>
      )}
      {family.byOwner.length === 1 && family.byOwner[0].ownerType === "spouse" && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          배우자 명의 계좌만 있어 배우자 기준으로 계산했습니다 (공제율 {(family.byOwner[0].progress.rate * 100).toFixed(1)}%).
          {family.byOwner[0].salaryBracketAssumed && " 배우자 소득 구간이 미입력이라 낮은 공제율로 가정했습니다. 위 은퇴 목표에서 입력할 수 있습니다."}
        </p>
      )}
      {family.excluded.length > 0 && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          자녀·기타 명의 계좌 {family.excluded.length}개는 명의자의 소득 정보가 없어 세액공제 계산에서 뺐습니다.
        </p>
      )}

      {progress.nonCreditablePaid > 0 && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          공제 한도를 넘은 {formatKRW(progress.nonCreditablePaid)}은 올해 세액공제 대상이 아닙니다.
        </p>
      )}
      {progress.overAnnualContributionLimit && (
        <p className="text-xs text-caution">
          연금계좌 납입 합계가 연 납입 한도 {formatKRW(rules.annualContributionLimit)}을 넘었습니다. 금융회사 납입 내역을 확인하세요.
        </p>
      )}
      {progress.overIsaAnnualLimit && (
        <p className="text-xs text-caution">ISA 납입이 연 {formatKRW(rules.isa.annualLimit)}을 넘었습니다. 이월 한도를 포함한 실제 한도는 금융회사에서 확인하세요.</p>
      )}

      <TaxDisclaimer
        extra={
          <>
            예상 세액공제액은 결정세액보다 클 수 없고, 다른 공제·감면에 따라 실제 환급액은 달라집니다. 공제율은 지방소득세를 포함한 값입니다.
            {!rules.exact && ` ${year}년 수치가 등록되지 않아 ${rules.year}년 기준으로 계산했습니다.`}
          </>
        }
      />
    </SectionCard>
  );
}
