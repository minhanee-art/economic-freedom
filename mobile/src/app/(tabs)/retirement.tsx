import { StyleSheet, Text, View } from "react-native";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/Card";
import { PortfolioStatus } from "@/components/PortfolioStatus";
import { useRetirementPlan } from "@/hooks/useRetirementPlan";
import { colors, spacing } from "@/styles/theme";
import type { IncomeSource, PensionLayers, PensionSummary, RetirementPlan } from "@/types";
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
  const { plan, summary, summaryFailed, isLoading, error, refresh } = useRetirementPlan();

  return (
    <AppShell refreshing={isLoading} onRefresh={refresh}>
      <Text style={styles.title}>연금 설계</Text>
      <Text style={styles.subtitle}>가족의 연금계좌 납입, 연금 소득원, 은퇴 목표를 읽기 전용으로 확인합니다.</Text>

      {plan ? <PlanContent plan={plan} summary={summary} summaryFailed={summaryFailed} /> : <PortfolioStatus isLoading={isLoading} error={error} onRetry={refresh} />}
    </AppShell>
  );
}

function PlanContent({
  plan,
  summary,
  summaryFailed,
}: {
  plan: RetirementPlan;
  summary: PensionSummary | null;
  summaryFailed: boolean;
}) {
  const { goal } = plan;
  const paidByAccount = new Map(plan.contributions.map((item) => [item.accountId, item.amount]));
  const totalPaid = plan.contributions.reduce((sum, item) => sum + item.amount, 0);

  return (
    <>
      {summary ? <SummaryCards summary={summary} /> : null}
      {!summary ? (
        <Notice>
          {summaryFailed
            ? "서버 계산값을 불러오지 못해 납입액과 목록만 표시합니다. 당겨서 새로고침하면 다시 시도합니다."
            : "서버가 아직 연금 요약 계산값을 제공하지 않아 납입액과 목록만 표시합니다."}
        </Notice>
      ) : null}

      <Card title="은퇴 목표" action={goal.retirementAge ? `${goal.retirementAge}세 은퇴` : undefined}>
        {goal.targetMonthly === null ? (
          <Text style={styles.muted}>웹의 연금 설계 화면에서 목표 월 생활비를 저장하면 여기에 표시됩니다.</Text>
        ) : (
          <>
            <Text style={styles.label}>목표 월 생활비</Text>
            <Text style={styles.bigNumber}>{formatKRW(goal.targetMonthly)}</Text>
          </>
        )}
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

const MISSING_LABELS: Record<string, string> = {
  targetMonthly: "목표 월 생활비",
  retirementAge: "은퇴 나이",
  birthYear: "출생연도",
};
const LAYER_LABELS: [keyof PensionLayers, string][] = [
  ["public", "공적연금(국민연금 등)"],
  ["retirement", "퇴직연금"],
  ["private", "개인연금"],
  ["dividend", "배당"],
];

function SummaryCards({ summary }: { summary: PensionSummary }) {
  const { taxCredit, retirement } = summary;
  const cashflow = retirement.cashflow;
  const unverified = summary.rules.unverifiedTopics;
  return (
    <>
      <Text style={styles.scope}>가족 전체 계좌를 합산한 값입니다(계좌별 값이 아닙니다). 현재 선택한 계좌와 무관합니다.</Text>

      <Card title={`${summary.year}년 세액공제 납입`}>
        {taxCredit === null ? (
          <Text style={styles.muted}>
            {summary.taxCreditUnavailableReason === "no_pension_accounts"
              ? "연금저축·IRP·DC·ISA 계좌가 없어 계산하지 않았습니다. 웹에서 연금 계좌를 등록하면 표시됩니다."
              : "세액공제 계산값을 받지 못했습니다."}
          </Text>
        ) : (
          <>
            <Text style={styles.label}>공제 한도 대비 납입 진행률</Text>
            <Text style={styles.bigNumber}>{taxCredit.progress.progressPct.toFixed(1)}%</Text>
            <Metric label="남은 공제 한도" value={formatKRW(taxCredit.progress.remainingCreditRoom)} />
            <Metric label="예상 공제액(현재 납입 기준)" value={formatKRW(taxCredit.progress.estimatedCredit)} />
            <Metric label="한도까지 납입 시 공제액" value={formatKRW(taxCredit.progress.maxCredit)} />
            {!taxCredit.contributionsRecorded ? (
              <Notice>올해 납입 기록이 없습니다. 진행률 0%는 납입하지 않았다는 뜻이 아니라 기록이 없다는 뜻일 수 있습니다.</Notice>
            ) : null}
            {taxCredit.salaryBracketAssumed ? (
              <Notice>소득 구간이 저장되어 있지 않아 서버가 가장 높은 소득 구간(공제율이 낮은 쪽)을 가정해 계산했습니다. 웹에서 소득 구간을 저장하면 달라질 수 있습니다.</Notice>
            ) : null}
          </>
        )}
      </Card>

      <Card title="은퇴 시점 예상 월 현금흐름" action={cashflow ? `${cashflow.atRetirement.age}세` : undefined}>
        {cashflow === null ? (
          <>
            <Text style={styles.muted}>
              {retirement.unavailableReason === "goal_incomplete"
                ? "은퇴 목표가 모두 입력되지 않아 계산하지 않았습니다."
                : "현금흐름 계산값을 받지 못했습니다."}
            </Text>
            {retirement.missingFields.length > 0 ? (
              <Text style={styles.muted}>
                입력이 필요한 항목: {retirement.missingFields.map((f) => MISSING_LABELS[f] ?? f).join(", ")}
              </Text>
            ) : null}
            <Notice>이 항목은 웹의 연금 설계 화면에서 입력합니다. 모바일에서는 아직 입력할 수 없습니다.</Notice>
          </>
        ) : (
          <>
            {LAYER_LABELS.map(([key, label]) => (
              <Metric key={key} label={label} value={formatKRW(cashflow.atRetirement.layers[key])} />
            ))}
            <Metric label="월 합계(추정)" value={formatKRW(cashflow.atRetirement.total)} strong />
            <Metric label="목표 대비 충족률" value={`${cashflow.coveragePctAtRetirement}%`} />
            <Metric
              label={cashflow.atRetirement.shortfall > 0 ? "목표 대비 부족액(월)" : "목표 대비 부족액"}
              value={cashflow.atRetirement.shortfall > 0 ? formatKRW(cashflow.atRetirement.shortfall) : "없음"}
            />
            {cashflow.expectedReturnAssumed ? (
              <Notice>기대수익률이 저장되어 있지 않아 0%로 계산했습니다. 웹에서 입력하면 값이 달라질 수 있습니다.</Notice>
            ) : null}
          </>
        )}
      </Card>

      <Card title="계산 가정과 확인 상태">
        <Notice>{summary.disclaimer}</Notice>
        {!summary.rules.exact ? (
          <Notice>{`${summary.year}년 기준 규칙이 서버에 등록되어 있지 않아 가까운 연도(${summary.rules.year}년)의 값으로 계산했습니다.`}</Notice>
        ) : null}
        {unverified.length > 0 ? (
          <>
            <Notice>서버가 공식 출처로 확인하지 못했다고 표시한 항목(미확인):</Notice>
            {unverified.map((topic) => (
              <Notice key={topic}>{`· ${topic}`}</Notice>
            ))}
          </>
        ) : null}
      </Card>
    </>
  );
}

function Metric({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowSub, styles.rowMain]}>{label}</Text>
      <Text style={[styles.rowValue, strong ? styles.strong : null]}>{value}</Text>
    </View>
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
  scope: { color: colors.inkMuted, fontSize: 12, fontWeight: "800", lineHeight: 18 },
  strong: { fontSize: 16 },
  muted: { color: colors.inkMuted, fontSize: 14, lineHeight: 20 },
  notice: { color: colors.inkSubtle, fontSize: 12, lineHeight: 18 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
  rowMain: { flex: 1, gap: 2 },
  rowTitle: { color: colors.ink, fontSize: 14, fontWeight: "900" },
  rowSub: { color: colors.inkMuted, fontSize: 12, fontWeight: "700" },
  rowValue: { color: colors.ink, fontSize: 14, fontWeight: "900" },
});
