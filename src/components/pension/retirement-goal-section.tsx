"use client";

import { useConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { useMemo, useState } from "react";
import type { IncomeSourceRow, RetirementGoalRow } from "@/lib/pension-data";
import { ACCOUNT_OWNER_LABELS, computeRetirementCashflow, type CashflowRow } from "@/lib/pension-planning";
import { pensionIncomeTaxRate, type PensionRuleSet, type SalaryBracket } from "@/lib/pension-rules";
import type { SpousePresence } from "@/lib/spouse-presence";
import { formatAmountInput, formatKRWFull, formatKRW, parseAmountInput } from "@/lib/utils";
import type { PlanningAccount } from "./account-type-section";
import {
  Field,
  ProgressBar,
  SectionCard,
  secondaryButtonClass,
  Stat,
  TaxDisclaimer,
  inputClass,
  parseNumberInput,
  primaryButtonClass,
  sendJson,
} from "./ui";

interface Props {
  year: number;
  rules: PensionRuleSet;
  goal: RetirementGoalRow;
  onGoalChange: (goal: RetirementGoalRow) => void;
  sources: IncomeSourceRow[];
  accounts: PlanningAccount[];
  /** 저장된 데이터에서 유도한 배우자 데이터 유무 */
  spousePresence: SpousePresence;
  /** 배우자 입력란 묶음을 펼쳤는지(데이터가 있거나 '배우자 정보 추가'를 눌렀으면 true) */
  spouseOpen: boolean;
  onSpouseOpenChange: (open: boolean) => void;
}

const toText = (value: number | null) => (value === null ? "" : String(value));

/** 표에 보여줄 나이: 은퇴 시점, 5세 단위, 그리고 현금흐름이 바뀌는 나이 */
function pickRows(rows: CashflowRow[]): CashflowRow[] {
  return rows.filter((row, index) => {
    if (index === 0 || index === rows.length - 1 || row.age % 5 === 0) return true;
    return rows[index - 1].total !== row.total;
  });
}

export function RetirementGoalSection({
  year,
  rules,
  goal,
  onGoalChange,
  sources,
  accounts,
  spousePresence,
  spouseOpen,
  onSpouseOpenChange,
}: Props) {
  const { confirm, dialog } = useConfirmDialog();
  const [form, setForm] = useState({
    targetMonthly: toText(goal.targetMonthly),
    retirementAge: toText(goal.retirementAge),
    birthYear: toText(goal.birthYear),
    spouseBirthYear: toText(goal.spouseBirthYear),
    expectedReturnPct: toText(goal.expectedReturnPct),
    spouseSalaryBracket: (goal.spouseSalaryBracket ?? "") as string,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isRemovingSpouse, setIsRemovingSpouse] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const set = (key: keyof typeof form, value: string) => setForm((f) => ({ ...f, [key]: value }));
  const currentAgeHint = (birthYear: string) => {
    const n = parseNumberInput(birthYear);
    return n && Number.isInteger(n) && n > 1900 ? `올해 ${year - n}세` : "4자리 연도";
  };

  const save = async () => {
    setIsSaving(true);
    setError("");
    setMessage("");
    try {
      const data = await sendJson<{ goal: RetirementGoalRow }>("/api/pension/goal", "PATCH", {
        targetMonthly: parseNumberInput(form.targetMonthly),
        retirementAge: parseNumberInput(form.retirementAge),
        birthYear: parseNumberInput(form.birthYear),
        expectedReturnPct: parseNumberInput(form.expectedReturnPct),
        // 배우자 입력란이 접혀 있으면 배우자 항목은 보내지 않는다(API는 보낸 항목만 바꾼다)
        ...(spouseOpen
          ? {
              spouseBirthYear: parseNumberInput(form.spouseBirthYear),
              spouseSalaryBracket: form.spouseSalaryBracket || null,
            }
          : {}),
      });
      onGoalChange(data.goal);
      setMessage("저장했습니다.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  const clearSpouseForm = () => setForm((f) => ({ ...f, spouseBirthYear: "", spouseSalaryBracket: "" }));

  // 배우자 출생연도·총급여 구간만 지운다. 배우자 명의 계좌와 배우자 연금 소득원은 여기서 지우지 않는다.
  const removeSpouse = async () => {
    setError("");
    setMessage("");
    if (!spousePresence.goalFields) {
      // 저장된 값이 없으면 입력 중인 값만 비우고 접는다
      clearSpouseForm();
      onSpouseOpenChange(false);
      return;
    }
    const remaining = [
      spousePresence.spouseAccountCount > 0 ? `배우자 명의 계좌 ${spousePresence.spouseAccountCount}개` : "",
      spousePresence.spouseSourceCount > 0 ? `배우자 연금 소득원 ${spousePresence.spouseSourceCount}개` : "",
    ].filter(Boolean);
    const ok = await confirm({
      title: "배우자 정보를 지울까요?",
      body:
        "저장된 배우자 출생연도와 배우자 총급여 구간을 지웁니다." +
        (remaining.length > 0 ? ` ${remaining.join("와 ")}는 지우지 않고 그대로 남습니다.` : "") +
        " 계속할까요?",
      confirmLabel: "배우자 정보 지우기",
    });
    if (!ok) return;
    setIsRemovingSpouse(true);
    try {
      const data = await sendJson<{ goal: RetirementGoalRow }>("/api/pension/goal", "PATCH", {
        spouseBirthYear: null,
        spouseSalaryBracket: null,
      });
      onGoalChange(data.goal);
      clearSpouseForm();
      onSpouseOpenChange(false);
      setMessage("배우자 출생연도·총급여 구간을 지웠습니다.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsRemovingSpouse(false);
    }
  };

  // 배우자 명의 계좌·연금 소득원이 남아 있으면 배우자 입력란을 접을 수 없다(그 데이터를 계산에 쓰므로)
  const spouseLinkedData = [
    spousePresence.spouseAccountCount > 0 ? `배우자 명의 계좌 ${spousePresence.spouseAccountCount}개` : "",
    spousePresence.spouseSourceCount > 0 ? `배우자 연금 소득원 ${spousePresence.spouseSourceCount}개` : "",
  ].filter(Boolean);
  const canRemoveSpouse = spousePresence.goalFields || spouseLinkedData.length === 0;

  const ready = goal.targetMonthly !== null && goal.retirementAge !== null && goal.birthYear !== null;

  const cashflow = useMemo(() => {
    if (!ready) return null;
    return computeRetirementCashflow(
      {
        targetMonthly: goal.targetMonthly ?? 0,
        retirementAge: goal.retirementAge ?? 60,
        birthYear: goal.birthYear ?? year,
        spouseBirthYear: goal.spouseBirthYear,
        expectedReturnPct: goal.expectedReturnPct ?? 0,
      },
      sources.map((s) => ({
        member: s.member,
        sourceType: s.source_type,
        monthlyAmount: s.monthly_amount,
        startAge: s.start_age,
        endAge: s.end_age,
      })),
      accounts.map((a) => ({
        id: a.id,
        ownerType: a.owner_type,
        accountType: a.account_type,
        value: a.value,
        annualDividend: a.annual_dividend,
      })),
      { currentYear: year }
    );
  }, [ready, goal, sources, accounts, year]);

  const at = cashflow?.atRetirement;
  const taxRateAtRetirement = at ? pensionIncomeTaxRate(rules, Math.max(at.age, 55)) : null;

  return (
    <SectionCard
      id="retirement-goal"
      title="은퇴 목표와 예상 월 현금흐름"
      description="국민연금(1층)·퇴직연금(2층)·개인연금(3층)과 연금계좌 밖 계좌의 배당을 합쳐 목표 월 생활비와 비교합니다."
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Field label="목표 월 생활비(원)">
          <input inputMode="numeric" value={formatAmountInput(form.targetMonthly)} onChange={(e) => set("targetMonthly", parseAmountInput(e.target.value))} placeholder="예: 3,000,000" className={inputClass} />
        </Field>
        <Field label="은퇴 나이">
          <input inputMode="numeric" value={form.retirementAge} onChange={(e) => set("retirementAge", e.target.value)} placeholder="60" className={inputClass} />
        </Field>
        <Field label={`출생연도 (${currentAgeHint(form.birthYear)})`}>
          <input inputMode="numeric" value={form.birthYear} onChange={(e) => set("birthYear", e.target.value)} placeholder="1980" className={inputClass} />
        </Field>
        <Field label="연 기대수익률(%)">
          <input inputMode="decimal" value={form.expectedReturnPct} onChange={(e) => set("expectedReturnPct", e.target.value)} placeholder="4" className={inputClass} />
        </Field>
      </div>

      {spouseOpen ? (
        <fieldset className="space-y-2 border border-zinc-100 p-3 dark:border-zinc-800">
          <legend className="px-1 text-xs font-semibold text-zinc-500 dark:text-zinc-400">배우자 정보</legend>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Field label="배우자 출생연도(선택)">
              <input inputMode="numeric" value={form.spouseBirthYear} onChange={(e) => set("spouseBirthYear", e.target.value)} className={inputClass} />
            </Field>
            <Field label="배우자 총급여 구간(선택)">
              <select
                value={form.spouseSalaryBracket}
                onChange={(e) => set("spouseSalaryBracket", e.target.value)}
                className={inputClass}
              >
                <option value="">미입력 (낮은 공제율로 가정)</option>
                {(["low", "high"] as SalaryBracket[]).map((b) => (
                  <option key={b} value={b}>
                    공제율 {(rules.taxCredit.rates[b].rate * 100).toFixed(1)}% · {rules.taxCredit.rates[b].label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          {spouseLinkedData.length > 0 && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {spouseLinkedData.join("·")}가 있어 배우자 정보를 표시합니다. 이 항목은 배우자 정보 제거로 지워지지 않습니다.
            </p>
          )}
          {canRemoveSpouse && (
            <button type="button" onClick={removeSpouse} disabled={isRemovingSpouse || isSaving} className={secondaryButtonClass}>
              {isRemovingSpouse ? "지우는 중..." : "배우자 정보 제거"}
            </button>
          )}
        </fieldset>
      ) : (
        <div>
          <button type="button" onClick={() => onSpouseOpenChange(true)} className={secondaryButtonClass}>
            배우자 정보 추가
          </button>
        </div>
      )}
      <div className="flex items-center gap-3">
        <button onClick={save} disabled={isSaving} className={primaryButtonClass}>
          {isSaving ? "저장 중..." : "목표 저장"}
        </button>
        {message && <span role="status" className="text-xs text-success">{message}</span>}
        {error && <span role="alert" className="text-xs leading-relaxed text-danger">{error}</span>}
      </div>

      {!cashflow || !at ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">목표 월 생활비·은퇴 나이·출생연도를 저장하면 예상 현금흐름을 계산합니다.</p>
      ) : (
        <div className="space-y-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
              <span>
                {at.age}세 예상 월 {formatKRW(at.total)} / 목표 {formatKRW(goal.targetMonthly ?? 0)}
              </span>
              <span>{cashflow.coveragePctAtRetirement}%</span>
            </div>
            <ProgressBar pct={cashflow.coveragePctAtRetirement} />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            <Stat label="1층 국민연금" value={formatKRW(at.layers.public)} />
            <Stat label="2층 퇴직연금" value={formatKRW(at.layers.retirement)} />
            <Stat label="3층 개인연금" value={formatKRW(at.layers.private)} />
            <Stat label="배당" value={formatKRW(at.layers.dividend)} hint="최근 1년 기준" />
            <Stat
              label="목표 대비 부족액"
              value={at.shortfall > 0 ? formatKRW(at.shortfall) : "없음"}
              hint={cashflow.firstCoveredAge === null ? "목표를 채우는 나이 없음" : `${cashflow.firstCoveredAge}세부터 목표 충족`}
            />
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            올해 {cashflow.currentAge}세 · 은퇴까지 {cashflow.yearsToRetirement}년 · 연금계좌 평가액은 연 {goal.expectedReturnPct ?? 0}%로
            굴려 명의자별로{" "}
            {(cashflow.annuities.some((a) => a.currentBalances.retirement + a.currentBalances.private > 0)
              ? cashflow.annuities.filter((a) => a.currentBalances.retirement + a.currentBalances.private > 0)
              : cashflow.annuities
            )
              .map((a) =>
                a.ownerType === "self"
                  ? `본인 ${a.startAge}세부터`
                  : `배우자 몫은 배우자 ${a.ownerStartAge}세(본인 ${a.startAge}세)부터`
              )
              .join(", ")}{" "}
            {cashflow.annuity.years}년간 나눠 받는다고 가정 (은퇴 시점 추정 DC{" "}
            {formatKRW(cashflow.projectedBalances.retirement)}, 연금저축·IRP {formatKRW(cashflow.projectedBalances.private)})
          </p>
          {cashflow.excludedAccounts.length > 0 && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              현금흐름에서 뺀 계좌:{" "}
              {cashflow.excludedAccounts
                .map((e) => {
                  const name = accounts.find((a) => a.id === e.id)?.name ?? "";
                  const why = e.reason === "spouse_birth_year_missing" ? "배우자 출생연도 미입력" : `${ACCOUNT_OWNER_LABELS[e.ownerType]} 명의`;
                  return `${name} (${why})`;
                })
                .join(", ")}
            </p>
          )}

          <p className="mb-1 text-xs text-zinc-500 dark:text-zinc-400 sm:hidden" aria-hidden="true">좁은 화면에서는 만원 단위로 줄여 보여 줍니다. 표가 넓으면 좌우로 밀어 보세요.</p>

          <div tabIndex={0} role="region" aria-label="나이별 예상 월 현금흐름 표" className="overflow-x-auto">
            <table className="w-full min-w-120 text-xs tabular-nums sm:min-w-168">

            <caption className="sr-only">나이별 예상 월 현금흐름: 국민연금, 퇴직연금, 개인연금, 배당, 합계, 목표 대비 부족액</caption>
              <thead className="text-zinc-500 dark:text-zinc-400">
                <tr className="border-b border-zinc-100 dark:border-zinc-800">
                  <th scope="col" className="py-2 pr-2 text-left font-medium whitespace-nowrap">나이</th>
                  <th scope="col" className="px-2 py-2 text-right font-medium whitespace-nowrap">국민연금</th>
                  <th scope="col" className="px-2 py-2 text-right font-medium whitespace-nowrap">퇴직연금</th>
                  <th scope="col" className="px-2 py-2 text-right font-medium whitespace-nowrap">개인연금</th>
                  <th scope="col" className="px-2 py-2 text-right font-medium whitespace-nowrap">배당</th>
                  <th scope="col" className="px-2 py-2 text-right font-medium whitespace-nowrap">합계</th>
                  <th scope="col" className="py-2 pl-2 text-right font-medium whitespace-nowrap">부족액</th>
                </tr>
              </thead>
              <tbody>
                {pickRows(cashflow.rows).map((row) => (
                  <tr key={row.age} className="border-b border-zinc-50 dark:border-zinc-800/60">
                    <th scope="row" className="py-2 pr-2 text-left font-normal whitespace-nowrap">{row.age}세</th>
                    <td className="px-2 py-2 text-right whitespace-nowrap"><TableAmount value={row.layers.public} /></td>
                    <td className="px-2 py-2 text-right whitespace-nowrap"><TableAmount value={row.layers.retirement} /></td>
                    <td className="px-2 py-2 text-right whitespace-nowrap"><TableAmount value={row.layers.private} /></td>
                    <td className="px-2 py-2 text-right whitespace-nowrap"><TableAmount value={row.layers.dividend} /></td>
                    <td className="px-2 py-2 text-right font-semibold whitespace-nowrap"><TableAmount value={row.total} /></td>
                    <td className={`py-2 pl-2 text-right whitespace-nowrap ${row.shortfall > 0 ? "text-ink" : "text-zinc-500 dark:text-zinc-400"}`}>
                      {row.shortfall > 0 ? <TableAmount value={row.shortfall} /> : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <TaxDisclaimer
            extra={
              <>
                모든 금액은 세전·현재 가치 기준이며 물가상승은 반영하지 않았습니다. 연금계좌에서 연금으로 받을 때 연금소득세가 붙습니다
                {taxRateAtRetirement !== null && ` (${Math.max(at.age, 55)}세 기준 ${(taxRateAtRetirement * 100).toFixed(1)}%, 지방소득세 포함)`}.
                사적연금이 연 {formatKRW(rules.pensionIncomeTax.separateTaxThreshold)}을 넘으면 종합과세 또는 분리과세를 선택해야 합니다.
              </>
            }
          />
        </div>
      )}
      {dialog}
    </SectionCard>
  );
}

/** 표 금액: 폰 폭에서는 만원 단위(요약 표기), sm 이상에서는 원 단위 전체. */
function TableAmount({ value }: { value: number }) {
  return (
    <>
      <span className="sm:hidden">{formatKRW(value)}</span>
      <span className="hidden sm:inline">{formatKRWFull(value)}</span>
    </>
  );
}
