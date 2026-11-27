"use client";

import { useState } from "react";
import type { AccountSnapshotRow, IncomeSourceRow, RetirementGoalRow } from "@/lib/pension-data";
import { getPensionRules, type SalaryBracket } from "@/lib/pension-rules";
import { AccountTypeSection, type PlanningAccount } from "@/components/pension/account-type-section";
import { ContributionSection, type ContributionMap } from "@/components/pension/contribution-section";
import { IncomeSourcesSection } from "@/components/pension/income-sources-section";
import { RetirementGoalSection } from "@/components/pension/retirement-goal-section";
import { sendJson } from "@/components/pension/ui";
import { getSpousePresence } from "@/lib/spouse-presence";

interface Props {
  year: number;
  initialAccounts: AccountSnapshotRow[];
  initialContributions: ContributionMap;
  initialSources: IncomeSourceRow[];
  initialGoal: RetirementGoalRow;
}

export function RetirementClient({ year, initialAccounts, initialContributions, initialSources, initialGoal }: Props) {
  const rules = getPensionRules(year);
  const [accounts, setAccounts] = useState<PlanningAccount[]>(initialAccounts);
  const [contributions, setContributions] = useState(initialContributions);
  const [sources, setSources] = useState(initialSources);
  const [goal, setGoal] = useState(initialGoal);
  const [bracketError, setBracketError] = useState("");
  // 배우자 항목은 기본으로 숨긴다. 배우자 데이터가 하나라도 있거나 '배우자 정보 추가'를 누르면 보인다.
  const [spouseAdded, setSpouseAdded] = useState(false);
  const spousePresence = getSpousePresence({ goal, accounts, sources });
  const spouseOpen = spousePresence.any || spouseAdded;

  const changeSalaryBracket = async (salaryBracket: SalaryBracket) => {
    const previous = goal;
    setGoal({ ...goal, salaryBracket });
    setBracketError("");
    try {
      await sendJson("/api/pension/goal", "PATCH", { salaryBracket });
    } catch (err) {
      setGoal(previous);
      setBracketError((err as Error).message);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold">연금 설계</h2>
        <p className="text-sm text-zinc-400 mt-0.5">
          가족의 연금계좌 납입, 국민연금·퇴직연금 예상액, 은퇴 목표를 한곳에서 정리하세요.
        </p>
      </div>

      <RetirementGoalSection
        year={year}
        rules={rules}
        goal={goal}
        onGoalChange={setGoal}
        sources={sources}
        accounts={accounts}
        spousePresence={spousePresence}
        spouseOpen={spouseOpen}
        onSpouseOpenChange={setSpouseAdded}
      />

      <ContributionSection
        year={year}
        rules={rules}
        accounts={accounts}
        contributions={contributions}
        onContributionsChange={setContributions}
        salaryBracket={goal.salaryBracket}
        spouseSalaryBracket={goal.spouseSalaryBracket}
        onSalaryBracketChange={changeSalaryBracket}
      />
      {bracketError && <p className="text-xs text-red-500">{bracketError}</p>}

      <IncomeSourcesSection sources={sources} onChange={setSources} showSpouse={spouseOpen} />

      <AccountTypeSection accounts={accounts} onChange={setAccounts} />
    </div>
  );
}
