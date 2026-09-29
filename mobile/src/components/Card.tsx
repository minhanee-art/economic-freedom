import type { PropsWithChildren } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing } from "@/styles/theme";

type CardProps = PropsWithChildren<{
  title?: string;
  action?: string;
}>;

export function Card({ title, action, children }: CardProps) {
  return (
    <View style={styles.card}>
      {title ? (
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          {action ? <Text style={styles.action}>{action}</Text> : null}
        </View>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  title: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "900",
  },
  action: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800",
  },
});
