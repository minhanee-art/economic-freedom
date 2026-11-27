import { Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { colors, radius, spacing } from "@/styles/theme";
import type { AccountSummary } from "@/types";

type AccountSwitcherProps = {
  accounts: AccountSummary[];
  selectedAccountId: string | null;
  onSelect: (accountId: string) => void;
};

const OWNER_LABELS: Record<string, string> = { self: "본인", spouse: "배우자", child: "자녀" };

/** 가족 계좌(본인/배우자/자녀)를 고르는 가로 칩. 계좌가 하나뿐이면 그리지 않는다. */
export function AccountSwitcher({ accounts, selectedAccountId, onSelect }: AccountSwitcherProps) {
  if (accounts.length < 2) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} style={styles.scroll}>
      {accounts.map((account) => {
        const active = account.id === selectedAccountId;
        const owner = OWNER_LABELS[account.ownerType];
        return (
          <Pressable
            key={account.id}
            accessibilityRole="button"
            aria-selected={active}
            onPress={() => onSelect(account.id)}
            style={[styles.chip, active && styles.chipActive]}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{account.name}</Text>
            {owner ? <Text style={[styles.owner, active && styles.ownerActive]}>{owner}</Text> : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0, marginBottom: spacing.lg },
  row: { gap: spacing.sm },
  chip: {
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  chipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { color: colors.ink, fontSize: 14, fontWeight: "900" },
  chipTextActive: { color: colors.surface },
  owner: { color: colors.inkMuted, fontSize: 11, fontWeight: "800" },
  ownerActive: { color: "rgba(255,255,255,0.7)" },
});
