import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Button } from "@/components/Button";
import { EmptyHoldings } from "@/components/EmptyHoldings";
import { colors, radius, spacing, touchTarget, type } from "@/styles/theme";
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
      <Text style={type.heading}>
        {account.name}
        {owner ? ` · ${owner}` : ""}
      </Text>
      <Text style={type.caption}>계좌를 바꾸려면 이전 화면에서 계좌를 선택하세요.</Text>
    </View>
  );
}

/**
 * 현재 계좌의 종목 중 하나를 고른다(라디오 묶음). 보유 중(수량 > 0)인 종목을 먼저 보이고,
 * 0주 종목(추가만 하고 아직 기록이 없는 종목·전량 매도한 종목)은 펼침 버튼을 눌렀을 때만 보인다.
 * 보유 중 종목이 없으면 처음부터 펼치고, 이미 고른 0주 종목은 접어도 목록에 남긴다.
 */
export function HoldingPicker({
  label,
  holdings,
  selectedId,
  onSelect,
  loaded = true,
  error,
}: {
  label: string;
  holdings: Holding[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** 종목 목록(요약 응답)을 받았는지. 받기 전에는 빈 상태를 그리지 않는다(종목이 있는 계좌에서 잠깐 '종목 없음'이 보이지 않게). */
  loaded?: boolean;
  /** 고르지 않고 저장을 누른 경우의 안내 */
  error?: string | null;
}) {
  const { held, notHeld, startExpanded } = splitHoldingsForPicker(holdings);
  // 사용자가 직접 펼치거나 접기 전에는 목록 상태(보유 중 종목 유무)를 따른다.
  const [userExpanded, setUserExpanded] = useState<boolean | null>(null);
  const expanded = userExpanded ?? startExpanded;

  if (holdings.length === 0) {
    if (!loaded) return null;
    return <EmptyHoldings description="이 계좌에 종목을 먼저 추가하면 여기서 골라 기록할 수 있습니다." />;
  }
  const shownNotHeld = visibleNotHeld(notHeld, expanded, selectedId);
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[styles.list, error ? styles.listError : null]} accessibilityRole="radiogroup" accessibilityLabel={label}>
        {held.map((holding, index) => (
          <HoldingOption key={holding.id} holding={holding} active={holding.id === selectedId} onSelect={onSelect} first={index === 0} />
        ))}
        {shownNotHeld.map((holding, index) => (
          <HoldingOption
            key={holding.id}
            holding={holding}
            active={holding.id === selectedId}
            onSelect={onSelect}
            notHeld
            first={held.length === 0 && index === 0}
          />
        ))}
      </View>
      {error ? (
        <Text style={styles.error} accessibilityRole="alert" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
      {held.length === 0 ? <Text style={type.caption}>보유 수량이 있는 종목이 없어 등록된 종목을 모두 표시합니다.</Text> : null}
      {notHeld.length > 0 && held.length > 0 ? (
        <Button
          variant="link"
          compact
          aria-expanded={expanded}
          label={expanded ? `보유하지 않은 종목 ${notHeld.length}개 접기` : `보유하지 않은 종목 ${notHeld.length}개 보기`}
          onPress={() => setUserExpanded(!expanded)}
        />
      ) : null}
    </View>
  );
}

function HoldingOption({
  holding,
  active,
  onSelect,
  notHeld,
  first,
}: {
  holding: Holding;
  active: boolean;
  onSelect: (id: string) => void;
  notHeld?: boolean;
  first?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: active, checked: active }}
      aria-checked={active}
      aria-selected={active}
      onPress={() => onSelect(holding.id)}
      android_ripple={{ color: colors.ripple }}
      style={({ pressed }) => [styles.item, !first && styles.itemDivider, active && styles.itemActive, pressed && !active && styles.itemPressed]}
    >
      <View style={[styles.radio, active && styles.radioActive]}>{active ? <View style={styles.radioDot} /> : null}</View>
      <Text style={[styles.itemName, active && styles.itemNameActive]}>{holding.name}</Text>
      <Text style={styles.itemCode}>{notHeld ? `${holding.code} · 보유 0주` : holding.code}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    gap: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    padding: spacing.lg,
  },
  bannerLabel: { ...type.label, color: colors.primary },
  field: { gap: spacing.sm },
  fieldLabel: { ...type.label, color: colors.ink },
  list: {
    overflow: "hidden",
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  listError: { borderColor: colors.danger, borderWidth: 2 },
  error: { ...type.label, color: colors.danger },
  item: {
    minHeight: touchTarget + 4,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  itemDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  itemActive: { backgroundColor: colors.primarySoft },
  itemPressed: { backgroundColor: colors.surfaceMuted },
  radio: {
    width: 20,
    height: 20,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.lineStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  radioActive: { borderColor: colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: radius.pill, backgroundColor: colors.primary },
  itemName: { ...type.body, flex: 1 },
  itemNameActive: { fontWeight: "600" },
  itemCode: { ...type.caption, fontVariant: ["tabular-nums"] },
});
