import { Pressable, StyleSheet, Text, View } from "react-native";
import { Card } from "@/components/Card";
import { colors, radius, spacing } from "@/styles/theme";
import type { AccountSummary, Holding } from "@/types";

const OWNER_LABELS: Record<string, string> = { self: "본인", spouse: "배우자", child: "자녀" };

/** 기록이 저장될 계좌를 화면 맨 위에 분명히 보여준다. */
export function RecordAccountBanner({ account }: { account: AccountSummary | undefined }) {
  if (!account) return null;
  const owner = OWNER_LABELS[account.ownerType];
  return (
    <View style={styles.banner} accessibilityRole="summary">
      <Text style={styles.bannerLabel}>기록할 계좌</Text>
      <Text style={styles.bannerName}>
        {account.name}
        {owner ? ` · ${owner}` : ""}
      </Text>
      <Text style={styles.bannerHint}>계좌를 바꾸려면 이전 화면에서 계좌를 선택하세요.</Text>
    </View>
  );
}

/** 현재 계좌의 보유 종목 중 하나를 고른다. */
export function HoldingPicker({
  holdings,
  selectedId,
  onSelect,
}: {
  holdings: Holding[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (holdings.length === 0) {
    return (
      <Card>
        <Text style={styles.empty}>이 계좌에 보유 종목이 없습니다. 웹에서 종목을 먼저 등록해주세요.</Text>
      </Card>
    );
  }
  return (
    <View style={styles.list}>
      {holdings.map((holding) => {
        const active = holding.id === selectedId;
        return (
          <Pressable
            key={holding.id}
            accessibilityRole="button"
            aria-selected={active}
            onPress={() => onSelect(holding.id)}
            style={[styles.item, active && styles.itemActive]}
          >
            <Text style={[styles.itemName, active && styles.itemNameActive]}>{holding.name}</Text>
            <Text style={[styles.itemCode, active && styles.itemCodeActive]}>{holding.code}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    marginBottom: spacing.lg,
    gap: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    padding: spacing.lg,
  },
  bannerLabel: { color: colors.primary, fontSize: 12, fontWeight: "800" },
  bannerName: { color: colors.ink, fontSize: 18, fontWeight: "900" },
  bannerHint: { color: colors.inkMuted, fontSize: 12, lineHeight: 18 },
  empty: { color: colors.inkMuted, fontSize: 14, lineHeight: 20 },
  list: { gap: spacing.sm },
  item: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  itemActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  itemName: { flex: 1, color: colors.ink, fontSize: 15, fontWeight: "900" },
  itemNameActive: { color: colors.surface },
  itemCode: { color: colors.inkMuted, fontSize: 12, fontWeight: "800" },
  itemCodeActive: { color: "rgba(255,255,255,0.7)" },
});
