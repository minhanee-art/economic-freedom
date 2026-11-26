"use client";

import { useMemo, useState } from "react";
import type { IncomeSourceRow, RetirementGoalRow } from "@/lib/pension-data";
import { computeRetirementCashflow, type CashflowRow } from "@/lib/pension-planning";
import { pensionIncomeTaxRate, type PensionRuleSet } from "@/lib/pension-rules";
import { formatFullKRW, formatKRW } from "@/lib/utils";
import type { PlanningAccount } from "./account-type-section";
import {
  Field,
  ProgressBar,
  SectionCard,
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
}

const toText = (value: number | null) => (value === null ? "" : String(value));

/** 표에 보여줄 나이: 은퇴 시점, 5세 단위, 그리고 현금흐름이 바뀌는 나이 */
function pickRows(rows: CashflowRow[]): CashflowRow[] {
  return rows.filter((row, index) => {
    if (index === 0 || index === rows.length - 1 || row.age % 5 === 0) return true;
    return rows[index - 1].total !== row.total;
  });
}

export function RetirementGoalSection({ year, rules, goal, onGoalChange, sources, accounts }: Props) {
  const [form, setForm] = useState({
    targetMonthly: toText(goal.targetMonthly),
    retirementAge: toText(goal.retirementAge),
    birthYear: toText(goal.birthYear),
    spouseBirthYear: toText(goal.spouseBirthYear),
    expectedReturnPct: toText(goal.expectedReturnPct),
  });
  const [isSaving, setIsSaving] = useState(false);
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
        spouseBirthYear: parseNumberInput(form.spouseBirthYear),
        expectedReturnPct: parseNumberInput(form.expectedReturnPct),
      });
      onGoalChange(data.goal);
      setMessage("저장했습니다.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

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
      accounts.map((a) => ({ accountType: a.account_type, value: a.value, annualDividend: a.annual_dividend })),
      { currentYear: year }
    );
  }, [ready, goal, sources, accounts, year]);

  const at = cashflow?.atRetirement;
  const taxRateAtRetirement = at ? pensionIncomeTaxRate(rules, Math.max(at.age, 55)) : null;

  return (
    <SectionCard
      title="은퇴 목표와 예상 월 현금흐름"
      description="국민연금(1층)·퇴직연금(2층)·개인연금(3층)과 연금계좌 밖 계좌의 배당을 합쳐 목표 월 생활비와 비교합니다."
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Field label="목표 월 생활비(원)">
          <input inputMode="numeric" value={form.targetMonthly} onChange={(e) => set("targetMonthly", e.target.value)} placeholder="3000000" className={inputClass} />
        </Field>
        <Field label="은퇴 나이">
          <input inputMode="numeric" value={form.retirementAge} onChange={(e) => set("retirementAge", e.target.value)} placeholder="60" className={inputClass} />
        </Field>
        <Field label={`출생연도 (${currentAgeHint(form.birthYear)})`}>
          <input inputMode="numeric" value={form.birthYear} onChange={(e) => set("birthYear", e.target.value)} placeholder="1980" className={inputClass} />
        </Field>
        <Field label="배우자 출생연도(선택)">
          <input inputMode="numeric" value={form.spouseBirthYear} onChange={(e) => set("spouseBirthYear", e.target.value)} className={inputClass} />
        </Field>
        <Field label="연 기대수익률(%)">
          <input inputMode="decimal" value={form.expectedReturnPct} onChange={(e) => set("expectedReturnPct", e.target.value)} placeholder="4" className={inputClass} />
        </Field>
      </div>
      <div className="flex items-center gap-3">
        <button onClick={save} disabled={isSaving} className={primaryButtonClass}>
          {isSaving ? "저장 중..." : "목표 저장"}
        </button>
        {message && <span className="text-xs text-zinc-500">{message}</span>}
        {error && <span className="text-xs text-red-500">{error}</span>}
      </div>

      {!cashflow || !at ? (
        <p className="text-sm text-zinc-400">목표 월 생활비·은퇴 나이·출생연도를 저장하면 예상 현금흐름을 계산합니다.</p>
      ) : (
        <div className="space-y-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-zinc-500">
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
          <p className="text-xs text-zinc-500">
            올해 {cashflow.currentAge}세 · 은퇴까지 {cashflow.yearsToRetirement}년 · 연금계좌 평가액은 연 {goal.expectedReturnPct ?? 0}%로
            굴려 {cashflow.annuity.startAge}세부터 {cashflow.annuity.years}년간 나눠 받는다고 가정 (은퇴 시점 추정 DC{" "}
            {formatKRW(cashflow.projectedBalances.retirement)}, 연금저축·IRP {formatKRW(cashflow.projectedBalances.private)})
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-xs tabular-nums">
              <thead className="text-zinc-500">
                <tr className="border-b border-zinc-100 dark:border-zinc-800">
                  <th className="py-1.5 text-left font-medium">나이</th>
                  <th className="py-1.5 text-right font-medium">국민연금</th>
                  <th className="py-1.5 text-right font-medium">퇴직연금</th>
                  <th className="py-1.5 text-right font-medium">개인연금</th>
                  <th className="py-1.5 text-right font-medium">배당</th>
                  <th className="py-1.5 text-right font-medium">합계</th>
                  <th className="py-1.5 text-right font-medium">부족액</th>
                </tr>
              </thead>
              <tbody>
                {pickRows(cashflow.rows).map((row) => (
                  <tr key={row.age} className="border-b border-zinc-50 dark:border-zinc-800/60">
                    <td className="py-1.5">{row.age}세</td>
                    <td className="py-1.5 text-right">{formatKRW(row.layers.public)}</td>
                    <td className="py-1.5 text-right">{formatKRW(row.layers.retirement)}</td>
                    <td className="py-1.5 text-right">{formatKRW(row.layers.private)}</td>
                    <td className="py-1.5 text-right">{formatKRW(row.layers.dividend)}</td>
                    <td className="py-1.5 text-right font-semibold">{formatKRW(row.total)}</td>
                    <td className={`py-1.5 text-right ${row.shortfall > 0 ? "text-red-500" : "text-zinc-400"}`}>
                      {row.shortfall > 0 ? formatFullKRW(row.shortfall) : "-"}
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
    </SectionCard>
  );
}
