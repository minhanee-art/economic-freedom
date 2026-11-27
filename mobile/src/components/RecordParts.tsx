import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { EmptyHoldings } from "@/components/EmptyHoldings";
import { colors, radius, spacing } from "@/styles/theme";
import type { AccountSummary, Holding } from "@/types";
import { splitHoldingsForPicker, visibleNotHeld } from "@/utils/holdings";

const OWNER_LABELS: Record<string, string> = { self: "본인", spouse: "배우자", child: "자녀" };

/** 기록이 저장될 계좌를 화면 맨 위에 분명히 보여준다. */
export function RecordAccountBanner({ account, label = "기록할 계좌" }: { account: AccountSummary | undefined; label?: string }) {
  if (!account) return null;
  const owner = OWNER_LABELS[account.ownerType];
  return (
    <View style={styles.banner} accessibilityRole="summary">
      <Text style={styles.bannerLabel}>{label}</Text>
      <Text style={styles.bannerName}>
        {account.name}
        {owner ? ` · ${owner}` : ""}
      </Text>
      <Text style={styles.bannerHint}>계좌를 바꾸려면 이전 화면에서 계좌를 선택하세요.</Text>
    </View>
  );
}

/**
 * 현재 계좌의 종목 중 하나를 고른다. 보유 중(수량 > 0)인 종목을 먼저 보이고,
 * 0주 종목(추가만 하고 아직 기록이 없는 종목·전량 매도한 종목)은 펼침 버튼을 눌렀을 때만 보인다.
 * 보유 중 종목이 없으면 처음부터 펼치고, 이미 고른 0주 종목은 접어도 목록에 남긴다.
 */
export function HoldingPicker({
  holdings,
  selectedId,
  onSelect,
}: {
  holdings: Holding[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const { held, notHeld, startExpanded } = splitHoldingsForPicker(holdings);
  // 사용자가 직접 펼치거나 접기 전에는 목록 상태(보유 중 종목 유무)를 따른다.
  const [userExpanded, setUserExpanded] = useState<boolean | null>(null);
  const expanded = userExpanded ?? startExpanded;

  if (holdings.length === 0) {
    return (
      <EmptyHoldings description="기록할 종목이 없습니다. 종목을 먼저 추가하면 이 목록에서 고를 수 있습니다." />
    );
  }
  const shownNotHeld = visibleNotHeld(notHeld, expanded, selectedId);
  return (
    <View style={styles.list}>
      {held.map((holding) => (
        <HoldingOption key={holding.id} holding={holding} active={holding.id === selectedId} onSelect={onSelect} />
      ))}
      {held.length === 0 ? <Text style={styles.hint}>보유 수량이 있는 종목이 없어 등록된 종목을 모두 표시합니다.</Text> : null}
      {notHeld.length > 0 && held.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          aria-expanded={expanded}
          onPress={() => setUserExpanded(!expanded)}
          style={styles.toggle}
        >
          <Text style={styles.toggleText}>
            {expanded ? `보유하지 않은 종목 ${notHeld.length}개 접기` : `보유하지 않은 종목 ${notHeld.length}개 보기`}
          </Text>
        </Pressable>
      ) : null}
      {shownNotHeld.map((holding) => (
        <HoldingOption key={holding.id} holding={holding} active={holding.id === selectedId} onSelect={onSelect} notHeld />
      ))}
    </View>
  );
}

function HoldingOption({
  holding,
  active,
  onSelect,
  notHeld,
}: {
  holding: Holding;
  active: boolean;
  onSelect: (id: string) => void;
  notHeld?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      aria-selected={active}
      onPress={() => onSelect(holding.id)}
      style={[styles.item, active && styles.itemActive]}
    >
      <Text style={[styles.itemName, active && styles.itemNameActive]}>{holding.name}</Text>
      <Text style={[styles.itemCode, active && styles.itemCodeActive]}>
        {notHeld ? `${holding.code} · 보유 0주` : holding.code}
      </Text>
    </Pressable>
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
  list: { gap: spacing.sm },
  hint: { color: colors.inkMuted, fontSize: 12, lineHeight: 18 },
  toggle: {
    alignItems: "center",
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: "dashed",
    borderColor: colors.line,
    padding: spacing.md,
  },
  toggleText: { color: colors.primary, fontSize: 13, fontWeight: "800" },
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
