// 연금 설계 서버 컴포넌트
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import {
  getAccountSnapshots,
  getContributions,
  getIncomeSources,
  getRetirementGoal,
} from "@/lib/pension-data";
import { ScrollToHash } from "@/components/ui/scroll-to-hash";
import { RetirementClient } from "./retirement-client";

export default async function RetirementPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const userId = session.userId;
  const year = new Date().getFullYear();

  const [accounts, contributions, sources, goal] = await Promise.all([
    getAccountSnapshots(userId),
    getContributions(userId, year),
    getIncomeSources(userId),
    getRetirementGoal(userId),
  ]);

  return (
    <>
      <ScrollToHash />
      <RetirementClient
        year={year}
        initialAccounts={accounts}
        initialContributions={Object.fromEntries(contributions.map((c) => [c.account_id, c.amount]))}
        initialSources={sources}
        initialGoal={
          goal ?? {
            targetMonthly: null,
            retirementAge: null,
            birthYear: null,
            spouseBirthYear: null,
            expectedReturnPct: null,
            salaryBracket: null,
            spouseSalaryBracket: null,
          }
        }
      />
    </>
  );
}
