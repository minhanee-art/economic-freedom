import { StyleSheet, View } from "react-native";
import { Text } from "@/components/AppText";
import { AppShell } from "@/components/AppShell";
import { Card, Rows, ValueRow } from "@/components/Card";
import { Notice, ProgressBar, RETIREMENT_WEB_PATH, ScreenTitle, WebLinkButton } from "@/components/Parts";
import { PortfolioStatus } from "@/components/PortfolioStatus";
import { useRetirementPlan } from "@/hooks/useRetirementPlan";
import { colors, spacing, type } from "@/styles/theme";
import type { AccountOwner, AccountSummary, IncomeSource, PensionLayers, PensionSummary, RetirementPlan } from "@/types";
import { formatKRW, formatKRWFull } from "@/utils/format";

// 표시용 이름만 둔다(세율·한도 같은 숫자는 두지 않는다). 알 수 없는 값은 서버가 준 값을 그대로 보인다.
const SOURCE_LABELS: Record<string, string> = {
  national_pension: "국민연금",
  retirement_pension: "퇴직연금",
  pension_insurance: "연금보험",
};
const MEMBER_LABELS: Record<string, string> = { self: "본인", spouse: "배우자" };
// 웹 src/lib/pension-planning.ts ACCOUNT_OWNER_LABELS 와 같은 이름
const OWNER_LABELS: Record<AccountOwner, string> = { self: "본인", spouse: "배우자", child: "자녀", other: "기타" };
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
      <ScreenTitle>연금 설계</ScreenTitle>

      {plan ? <PlanContent plan={plan} summary={summary} summaryFailed={summaryFailed} /> : <PortfolioStatus isLoading={isLoading} error={error} onRetry={refresh} />}
    </AppShell>
  );
}

/**
 * 연금 요약이 어떤 계좌를 합친 값인지: 계좌가 하나면 말하지 않고, 여러 개면 명의 구성대로 적는다.
 * (1인 계정에 '가족 전체'라고 쓰지 않는다.)
 */
function scopeText(accounts: AccountSummary[]): string | null {
  if (accounts.length < 2) return null;
  const owners = [...new Set(accounts.map((a) => a.ownerType as AccountOwner))];
  const ownerText = owners.map((o) => OWNER_LABELS[o] ?? o).join("·");
  return `${ownerText} 명의 계좌 ${accounts.length}개를 합산한 값입니다. 다른 탭에서 고른 계좌와 무관합니다.`;
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
  const scope = scopeText(plan.accounts);

  return (
    <>
      {scope ? <Notice>{scope}</Notice> : null}
      {summary ? <SummaryCards summary={summary} /> : null}
      {!summary ? (
        <Notice>
          {summaryFailed
            ? "서버 계산값을 불러오지 못해 납입액과 목록만 표시합니다. 당겨서 새로고침하면 다시 시도합니다."
            : "서버가 아직 연금 요약 계산값을 제공하지 않아 납입액과 목록만 표시합니다."}
        </Notice>
      ) : null}

      <Card title="은퇴 목표" aside={goal.retirementAge ? `${goal.retirementAge}세 은퇴` : undefined}>
        {goal.targetMonthly === null ? (
          <>
            <Text style={type.numberLg}>목표 미설정</Text>
            <Text style={[type.body, styles.muted]}>목표 월 생활비를 저장하면 여기에 표시됩니다. 목표는 웹의 연금 설계 화면에서 입력합니다.</Text>
            <WebLinkButton path={RETIREMENT_WEB_PATH} label="웹에서 목표 입력" />
          </>
        ) : (
          <View style={styles.headline}>
            <Text style={type.label}>목표 월 생활비</Text>
            <Text style={type.numberLg}>{formatKRW(goal.targetMonthly)}</Text>
          </View>
        )}
      </Card>

      <Card title={`${plan.year}년 연금계좌 납입`} aside={formatKRWFull(totalPaid)}>
        {plan.accounts.length === 0 ? <Text style={[type.body, styles.muted]}>계좌가 없습니다.</Text> : null}
        <Rows>
          {plan.accounts.map((account) => {
            const paid = paidByAccount.get(account.id);
            const typeLabel = account.accountType ? (ACCOUNT_TYPE_LABELS[account.accountType] ?? account.accountType) : undefined;
            return <ValueRow key={account.id} label={account.name} sub={typeLabel} value={paid === undefined ? "기록 없음" : formatKRWFull(paid)} />;
          })}
        </Rows>
      </Card>

      <Card title="연금 소득원">
        {plan.sources.length === 0 ? (
          <>
            <Text style={[type.body, styles.muted]}>웹에서 국민연금·퇴직연금·연금보험 예상액을 입력하면 여기에 표시됩니다.</Text>
            <WebLinkButton path={RETIREMENT_WEB_PATH} label="웹에서 소득원 입력" />
          </>
        ) : null}
        <Rows>
          {plan.sources.map((source) => (
            <SourceRow key={source.id} source={source} />
          ))}
        </Rows>
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
      <Card title={`${summary.year}년 세액공제 납입`}>
        {taxCredit === null ? (
          <>
            <Text style={[type.body, styles.muted]}>{taxCreditUnavailableText(summary.taxCreditUnavailableReason)}</Text>
            <WebLinkButton path={RETIREMENT_WEB_PATH} label="웹에서 연금 계좌 등록" />
          </>
        ) : (
          <TaxCreditContent taxCredit={taxCredit} ownerLimit={summary.rules.taxCredit?.combinedLimit ?? null} />
        )}
      </Card>

      <Card title="은퇴 시점 예상 월 현금흐름" aside={cashflow ? `${cashflow.atRetirement.age}세` : undefined}>
        {cashflow === null ? (
          <>
            <Text style={[type.body, styles.muted]}>
              {retirement.unavailableReason === "goal_incomplete"
                ? "은퇴 목표가 모두 입력되지 않아 계산하지 않았습니다."
                : "현금흐름 계산값을 받지 못했습니다."}
            </Text>
            {retirement.missingFields.length > 0 ? (
              <Text style={[type.body, styles.muted]}>
                입력이 필요한 항목: {retirement.missingFields.map((f) => MISSING_LABELS[f] ?? f).join(", ")}
              </Text>
            ) : null}
            <Notice>이 항목은 웹의 연금 설계 화면에서 입력합니다. 모바일에서는 아직 입력할 수 없습니다.</Notice>
            <WebLinkButton path={RETIREMENT_WEB_PATH} label="웹에서 은퇴 목표 입력" />
          </>
        ) : (
          <>
            <View style={styles.headline}>
              <Text style={type.numberLg}>월 {formatKRW(cashflow.atRetirement.total)}</Text>
              <Text style={[type.label, styles.tabular]}>목표 대비 충족률 {cashflow.coveragePctAtRetirement}%</Text>
            </View>
            <ProgressBar pct={cashflow.coveragePctAtRetirement} label="은퇴 목표 대비 충족률" />
            <Rows>
              {LAYER_LABELS.map(([key, label]) => (
                <ValueRow key={key} label={label} value={formatKRWFull(cashflow.atRetirement.layers[key])} />
              ))}
              <ValueRow label="월 합계(추정)" value={formatKRWFull(cashflow.atRetirement.total)} strong />
              <ValueRow
                label={cashflow.atRetirement.shortfall > 0 ? "목표 대비 부족액(월)" : "목표 대비 부족액"}
                value={cashflow.atRetirement.shortfall > 0 ? formatKRWFull(cashflow.atRetirement.shortfall) : "없음"}
                valueColor={cashflow.atRetirement.shortfall > 0 ? colors.caution : undefined}
              />
            </Rows>
            {cashflow.excludedAccounts.length > 0 ? (
              <Notice>
                {`현금흐름에서 뺀 계좌: ${cashflow.excludedAccounts
                  .map((e) => `${e.name || "이름 없는 계좌"} (${e.reason === "spouse_birth_year_missing" ? "배우자 출생연도 미입력" : `${OWNER_LABELS[e.ownerType] ?? e.ownerType} 명의`})`)
                  .join(", ")}`}
              </Notice>
            ) : null}
            {cashflow.expectedReturnAssumed ? (
              <>
                <Notice tone="caution">기대수익률이 저장되어 있지 않아 0%로 계산했습니다. 웹에서 입력하면 값이 달라질 수 있습니다.</Notice>
                <WebLinkButton path={RETIREMENT_WEB_PATH} label="웹에서 기대수익률 입력" />
              </>
            ) : null}
          </>
        )}
      </Card>

      <Card title="계산 가정과 확인 상태">
        <Notice>{summary.disclaimer}</Notice>
        {!summary.rules.exact ? (
          <Notice tone="caution">{`${summary.year}년 기준 규칙이 서버에 등록되어 있지 않아 가까운 연도(${summary.rules.year}년)의 값으로 계산했습니다.`}</Notice>
        ) : null}
        {unverified.length > 0 ? (
          <View style={styles.list}>
            <Notice>서버가 공식 출처로 확인하지 못했다고 표시한 항목(미확인):</Notice>
            {unverified.map((topic) => (
              <Notice key={topic}>{`· ${topic}`}</Notice>
            ))}
          </View>
        ) : null}
      </Card>
    </>
  );
}

function taxCreditUnavailableText(reason: string | null): string {
  if (reason === "no_pension_accounts") {
    return "연금저축·IRP·DC·ISA 계좌가 없어 계산하지 않았습니다. 웹에서 연금 계좌를 등록하면 표시됩니다.";
  }
  if (reason === "only_excluded_owner_accounts") {
    return "연금저축·IRP·DC·ISA 계좌가 모두 자녀·기타 명의라 계산하지 않았습니다. 자녀·기타 명의 계좌는 명의자의 소득 정보가 없어 세액공제 계산에서 뺍니다.";
  }
  return "세액공제 계산값을 받지 못했습니다.";
}

type TaxCredit = NonNullable<PensionSummary["taxCredit"]>;

/**
 * 가장 먼저 읽혀야 하는 숫자는 '남은 공제 한도'(크게), 그 아래 진행 막대와 공제액 두 줄.
 * 명의자별 계산은 명의자마다 한 묶음(납입액·공제 대상/한도·예상 공제액과 공제율)으로 접어 행 수를 줄였다.
 */
function TaxCreditContent({ taxCredit, ownerLimit }: { taxCredit: TaxCredit; ownerLimit: number | null }) {
  const { progress, byOwner, excludedAccounts } = taxCredit;
  const family = byOwner.length > 1;
  const onlySpouse = byOwner.length === 1 && byOwner[0].ownerType === "spouse";
  // 배우자 명의 공제 대상 계좌가 없으면 배우자를 언급하지 않는다
  const hasSpouseOwner = byOwner.some((owner) => owner.ownerType === "spouse");
  const needsWebInput = taxCredit.salaryBracketAssumed || byOwner.some((o) => o.salaryBracketAssumed);
  return (
    <>
      <View style={styles.headline}>
        <Text style={type.label}>{family ? "가족 합계 " : ""}남은 공제 한도</Text>
        <Text style={type.numberLg}>{formatKRW(progress.remainingCreditRoom)}</Text>
      </View>
      <ProgressBar pct={progress.progressPct} label="공제 한도 대비 납입 진행률" />
      <Text style={[type.label, styles.tabular]}>공제 한도 대비 납입 진행률 {progress.progressPct.toFixed(1)}%</Text>
      <Rows>
        <ValueRow label="예상 공제액(현재 납입 기준)" value={formatKRWFull(progress.estimatedCredit)} />
        <ValueRow label="한도까지 납입 시 공제액" value={formatKRWFull(progress.maxCredit)} />
      </Rows>

      {byOwner.length > 0 ? (
        <View style={styles.owners}>
          <Text style={[type.label, styles.ownersTitle]} accessibilityRole="header">
            명의자별 계산
          </Text>
          <Rows>
            {byOwner.map((owner) => (
              <View key={owner.ownerType} style={styles.ownerBlock}>
                <Text style={[type.body, styles.ownerName]}>{OWNER_LABELS[owner.ownerType]}</Text>
                <OwnerLine label="연금계좌 납입액" value={formatKRWFull(owner.progress.pensionPaid)} />
                <OwnerLine
                  label="공제 대상 / 한도"
                  value={`${formatKRWFull(owner.progress.creditableTotal)} / ${ownerLimit === null ? "-" : formatKRWFull(ownerLimit)}`}
                />
                <OwnerLine
                  label={`예상 공제액 (공제율 ${(owner.progress.rate * 100).toFixed(1)}%)`}
                  value={formatKRWFull(owner.progress.estimatedCredit)}
                />
                {owner.salaryBracketAssumed ? (
                  <Notice tone="caution">{`${OWNER_LABELS[owner.ownerType]} 소득 구간 미입력 — 낮은 공제율로 가정했습니다.`}</Notice>
                ) : null}
              </View>
            ))}
          </Rows>
        </View>
      ) : null}

      {onlySpouse ? (
        <Notice>
          {byOwner[0].salaryBracketAssumed
            ? "배우자 명의 계좌만 있어 배우자 기준으로 계산했습니다. 배우자 소득 구간이 입력되지 않아 낮은 공제율로 가정했습니다."
            : "배우자 명의 계좌만 있어 배우자 기준으로 계산했습니다. 웹에 저장된 배우자 소득 구간의 공제율을 썼습니다."}
        </Notice>
      ) : null}
      {excludedAccounts.length > 0 ? (
        <View style={styles.list}>
          <Notice>{`자녀·기타 명의 계좌 ${excludedAccounts.length}개는 명의자의 소득 정보가 없어 세액공제 계산에서 뺐습니다.`}</Notice>
          {excludedAccounts.map((account) => (
            <Notice key={account.id || account.name}>
              {`· ${account.name || "이름 없는 계좌"} (${OWNER_LABELS[account.ownerType] ?? account.ownerType} 명의 · ${ACCOUNT_TYPE_LABELS[account.accountType] ?? account.accountType}) 납입 ${formatKRWFull(account.paid)}`}
            </Notice>
          ))}
        </View>
      ) : null}
      {progress.nonCreditablePaid > 0 ? (
        <Notice tone="caution">{`공제 한도를 넘은 ${formatKRWFull(progress.nonCreditablePaid)}은 올해 세액공제 대상이 아닙니다.`}</Notice>
      ) : null}
      {!taxCredit.contributionsRecorded ? (
        <Notice>올해 납입 기록이 없습니다. 진행률 0%는 납입하지 않았다는 뜻이 아니라 기록이 없다는 뜻일 수 있습니다.</Notice>
      ) : null}
      {taxCredit.salaryBracketAssumed ? (
        <Notice>
          {byOwner.length > 0
            ? `소득 구간이 없는 명의자는 서버가 총급여 5,500만원 초과(공제율이 낮은 쪽)로 가정해 계산했습니다. ${hasSpouseOwner ? "본인·배우자 " : ""}소득 구간은 웹의 연금 설계 화면에서 입력할 수 있습니다.`
            : "소득 구간이 저장되어 있지 않아 서버가 가장 높은 소득 구간(공제율이 낮은 쪽)을 가정해 계산했습니다. 웹에서 소득 구간을 저장하면 달라질 수 있습니다."}
        </Notice>
      ) : null}
      {needsWebInput ? <WebLinkButton path={RETIREMENT_WEB_PATH} label="웹에서 소득 구간 입력" /> : null}
    </>
  );
}

function OwnerLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.ownerLine}>
      <Text style={[type.label, styles.ownerLineLabel]}>{label}</Text>
      <Text style={[type.label, styles.ownerLineValue]}>{value}</Text>
    </View>
  );
}

function SourceRow({ source }: { source: IncomeSource }) {
  const name = source.label || (SOURCE_LABELS[source.sourceType] ?? source.sourceType);
  const member = MEMBER_LABELS[source.member] ?? source.member;
  const period = source.endAge === null ? `${source.startAge}세부터` : `${source.startAge}~${source.endAge}세`;
  return (
    <ValueRow
      label={name}
      sub={`${member} · ${SOURCE_LABELS[source.sourceType] ?? source.sourceType} · ${period}`}
      value={`월 ${formatKRWFull(source.monthlyAmount)}`}
    />
  );
}

const styles = StyleSheet.create({
  muted: { color: colors.inkMuted },
  tabular: { fontVariant: ["tabular-nums"] },
  headline: { gap: spacing.xs },
  list: { gap: spacing.xs },
  owners: { gap: spacing.xs, marginTop: spacing.xs },
  ownersTitle: { color: colors.ink },
  ownerBlock: { gap: 2, paddingVertical: spacing.sm },
  ownerName: { fontWeight: "600" },
  ownerLine: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", columnGap: spacing.md },
  ownerLineLabel: { flexShrink: 1 },
  ownerLineValue: { color: colors.ink, fontWeight: "600", fontVariant: ["tabular-nums"] },
});
