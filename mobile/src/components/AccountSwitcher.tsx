import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing, touchTarget, type } from "@/styles/theme";
import type { AccountSummary } from "@/types";

type AccountSwitcherProps = {
  accounts: AccountSummary[];
  selectedAccountId: string | null;
  onSelect: (accountId: string) => void;
};

const OWNER_LABELS: Record<string, string> = { self: "본인", spouse: "배우자", child: "자녀" };

/**
 * 가족 계좌(본인/배우자/자녀)를 고르는 가로 칩(라디오 묶음). 계좌가 하나뿐이면 그리지 않는다.
 * 칩이 화면 폭을 넘으면 가로 스크롤 막대를 보이고 끝 칩이 잘려 보이게 두어 더 있음을 알린다.
 */
export function AccountSwitcher({ accounts, selectedAccountId, onSelect }: AccountSwitcherProps) {
  const [viewWidth, setViewWidth] = useState(0);
  const [contentWidth, setContentWidth] = useState(0);
  const overflow = viewWidth > 0 && contentWidth > viewWidth + 1;
  if (accounts.length < 2) return null;
  return (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={overflow}
        persistentScrollbar
        accessibilityRole="radiogroup"
        accessibilityLabel="계좌 선택"
        onLayout={(e) => setViewWidth(e.nativeEvent.layout.width)}
        onContentSizeChange={(w) => setContentWidth(w)}
        contentContainerStyle={[styles.row, overflow ? styles.rowOverflow : null]}
      >
        {accounts.map((account) => {
          const active = account.id === selectedAccountId;
          const owner = OWNER_LABELS[account.ownerType];
          return (
            <Pressable
              key={account.id}
              accessibilityRole="radio"
              accessibilityState={{ selected: active, checked: active }}
              aria-checked={active}
              aria-selected={active}
              accessibilityLabel={owner ? `${account.name}, ${owner}` : account.name}
              onPress={() => onSelect(account.id)}
              android_ripple={{ color: colors.ripple }}
              style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && !active && styles.chipPressed]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{account.name}</Text>
              {owner ? <Text style={[styles.owner, active && styles.ownerActive]}>{owner}</Text> : null}
            </Pressable>
          );
        })}
      </ScrollView>
      {overflow ? <Text style={styles.hint}>옆으로 밀어 다른 계좌 보기</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.sm },
  rowOverflow: { paddingBottom: spacing.sm },
  chip: {
    minHeight: touchTarget,
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    overflow: "hidden",
  },
  chipActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  chipPressed: { backgroundColor: colors.surfaceMuted },
  chipText: { fontSize: 15, lineHeight: 20, fontWeight: "500", color: colors.ink },
  chipTextActive: { color: colors.primary, fontWeight: "600" },
  owner: { ...type.caption },
  ownerActive: { color: colors.primary },
  hint: { ...type.caption, marginTop: spacing.xs },
});
