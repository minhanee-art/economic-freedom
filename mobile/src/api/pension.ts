import type { ContributionRecord, IncomeSource, PensionSummary, RetirementGoal, RetirementPlan } from "@/types";
import { getAccounts } from "./accounts";
import { ApiError, apiGet } from "./client";

type ContributionRow = { account_id: string; year: number; amount: number; memo: string | null };
type IncomeSourceRow = {
  id: string;
  member: string;
  source_type: string;
  label: string | null;
  monthly_amount: number;
  start_age: number;
  end_age: number | null;
  memo: string | null;
};

const EMPTY_GOAL: RetirementGoal = {
  targetMonthly: null,
  retirementAge: null,
  birthYear: null,
  spouseBirthYear: null,
  expectedReturnPct: null,
  salaryBracket: null,
};

/**
 * 웹 /dashboard/retirement 가 읽는 서버 API를 그대로 읽는다(읽기 전용).
 * 연금 API는 사용자 단위이므로 계좌 지정 헤더를 보내지 않는다.
 * 세율·한도는 이 API들이 주지 않는다(src/lib/pension-rules.ts 는 서버 내부) — 그래서 여기서도 가져오지 않는다.
 */
export async function getRetirementPlan(token: string): Promise<RetirementPlan> {
  const year = new Date().getFullYear();
  const [accounts, contributions, goal, sources] = await Promise.all([
    getAccounts(token),
    apiGet<{ year?: number; contributions?: ContributionRow[] }>(`/api/pension/contributions?year=${year}`, token),
    apiGet<{ goal?: RetirementGoal }>("/api/pension/goal", token),
    apiGet<{ sources?: IncomeSourceRow[] }>("/api/pension/income-sources", token),
  ]);

  return {
    year: contributions.year ?? year,
    accounts,
    contributions: (contributions.contributions ?? []).map(
      (row): ContributionRecord => ({
        accountId: row.account_id,
        year: row.year,
        amount: row.amount,
        memo: row.memo,
      })
    ),
    goal: { ...EMPTY_GOAL, ...(goal.goal ?? {}) },
    sources: (sources.sources ?? []).map(
      (row): IncomeSource => ({
        id: row.id,
        member: row.member,
        sourceType: row.source_type,
        label: row.label,
        monthlyAmount: row.monthly_amount,
        startAge: row.start_age,
        endAge: row.end_age,
        memo: row.memo,
      })
    ),
  };
}

/**
 * 연금 설계 요약(서버 계산값). 사용자 전체(가족 계좌 합산) 기준이라 계좌 지정 헤더를 보내지 않는다.
 * 서버가 아직 이 API를 배포하지 않아 404가 오면 null 을 돌려준다 — '계좌 없음' 404와 달리
 * 이 요청은 계좌 id 를 보내지 않으므로 계좌 선택은 건드리지 않고 기존 화면만 보이게 한다.
 */
export async function getPensionSummary(token: string): Promise<PensionSummary | null> {
  try {
    return await apiGet<PensionSummary>("/api/pension/summary", token);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}
