import { StyleSheet, Text, View } from "react-native";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/Card";
import { PortfolioStatus } from "@/components/PortfolioStatus";
import { useRetirementPlan } from "@/hooks/useRetirementPlan";
import { colors, spacing } from "@/styles/theme";
import type { IncomeSource, RetirementPlan } from "@/types";
import { formatKRW } from "@/utils/format";

// 표시용 이름만 둔다(세율·한도 같은 숫자는 두지 않는다). 알 수 없는 값은 서버가 준 값을 그대로 보인다.
const SOURCE_LABELS: Record<string, string> = {
  national_pension: "국민연금",
  retirement_pension: "퇴직연금",
  pension_insurance: "연금보험",
};
const MEMBER_LABELS: Record<string, string> = { self: "본인", spouse: "배우자" };
const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  pension_savings: "연금저축",
  irp: "IRP",
  dc: "DC(확정기여형)",
  isa: "ISA",
  general: "일반",
  child: "자녀",
};

export default function RetirementScreen() {
  const { plan, isLoading, error, refresh } = useRetirementPlan();

  return (
    <AppShell refreshing={isLoading} onRefresh={refresh}>
      <Text style={styles.title}>연금 설계</Text>
      <Text style={styles.subtitle}>가족의 연금계좌 납입, 연금 소득원, 은퇴 목표를 읽기 전용으로 확인합니다.</Text>

      {plan ? <PlanContent plan={plan} /> : <PortfolioStatus isLoading={isLoading} error={error} onRetry={refresh} />}
    </AppShell>
  );
}

function PlanContent({ plan }: { plan: RetirementPlan }) {
  const { goal } = plan;
  const paidByAccount = new Map(plan.contributions.map((item) => [item.accountId, item.amount]));
  const totalPaid = plan.contributions.reduce((sum, item) => sum + item.amount, 0);

  return (
    <>
      <Card title="은퇴 목표" action={goal.retirementAge ? `${goal.retirementAge}세 은퇴` : undefined}>
        {goal.targetMonthly === null ? (
          <Text style={styles.muted}>웹의 연금 설계 화면에서 목표 월 생활비를 저장하면 여기에 표시됩니다.</Text>
        ) : (
          <>
            <Text style={styles.label}>목표 월 생활비</Text>
            <Text style={styles.bigNumber}>{formatKRW(goal.targetMonthly)}</Text>
          </>
        )}
        <Notice>
          목표 대비 예상 월 현금흐름은 서버가 계산해 내려주는 값이 아직 없어 이 화면에서 보여주지 않습니다. 웹의 연금 설계 화면에서
          확인할 수 있습니다.
        </Notice>
      </Card>

      <Card title={`${plan.year}년 연금계좌 납입`} action={formatKRW(totalPaid)}>
        {plan.accounts.length === 0 ? <Text style={styles.muted}>계좌가 없습니다.</Text> : null}
        {plan.accounts.map((account) => {
          const paid = paidByAccount.get(account.id);
          const typeLabel = account.accountType ? (ACCOUNT_TYPE_LABELS[account.accountType] ?? account.accountType) : null;
          return (
            <View key={account.id} style={styles.row}>
              <View style={styles.rowMain}>
                <Text style={styles.rowTitle}>{account.name}</Text>
                {typeLabel ? <Text style={styles.rowSub}>{typeLabel}</Text> : null}
              </View>
              <Text style={styles.rowValue}>{paid === undefined ? "기록 없음" : formatKRW(paid)}</Text>
            </View>
          );
        })}
        <Notice>
          세액공제 한도와 공제율은 서버가 API로 내려주지 않아 납입 진행률(%)은 표시하지 않습니다. 공제 한도 대비 진행률은 웹의 연금
          설계 화면에서 확인할 수 있습니다.
        </Notice>
      </Card>

      <Card title="연금 소득원">
        {plan.sources.length === 0 ? (
          <Text style={styles.muted}>웹에서 국민연금·퇴직연금·연금보험 예상액을 입력하면 여기에 표시됩니다.</Text>
        ) : null}
        {plan.sources.map((source) => (
          <SourceRow key={source.id} source={source} />
        ))}
      </Card>
    </>
  );
}

function SourceRow({ source }: { source: IncomeSource }) {
  const name = source.label || (SOURCE_LABELS[source.sourceType] ?? source.sourceType);
  const member = MEMBER_LABELS[source.member] ?? source.member;
  const period = source.endAge === null ? `${source.startAge}세부터` : `${source.startAge}~${source.endAge}세`;
  return (
    <View style={styles.row}>
      <View style={styles.rowMain}>
        <Text style={styles.rowTitle}>{name}</Text>
        <Text style={styles.rowSub}>
          {member} · {SOURCE_LABELS[source.sourceType] ?? source.sourceType} · {period}
        </Text>
      </View>
      <Text style={styles.rowValue}>월 {formatKRW(source.monthlyAmount)}</Text>
    </View>
  );
}

function Notice({ children }: { children: string }) {
  return <Text style={styles.notice}>{children}</Text>;
}

const styles = StyleSheet.create({
  title: { color: colors.ink, fontSize: 28, fontWeight: "900" },
  subtitle: { marginBottom: spacing.lg, color: colors.inkMuted, fontSize: 14, lineHeight: 20 },
  label: { color: colors.inkMuted, fontSize: 13, fontWeight: "800" },
  bigNumber: { color: colors.ink, fontSize: 26, fontWeight: "900", letterSpacing: -0.5 },
  muted: { color: colors.inkMuted, fontSize: 14, lineHeight: 20 },
  notice: { color: colors.inkSubtle, fontSize: 12, lineHeight: 18 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
  rowMain: { flex: 1, gap: 2 },
  rowTitle: { color: colors.ink, fontSize: 14, fontWeight: "900" },
  rowSub: { color: colors.inkMuted, fontSize: 12, fontWeight: "700" },
  rowValue: { color: colors.ink, fontSize: 14, fontWeight: "900" },
});
