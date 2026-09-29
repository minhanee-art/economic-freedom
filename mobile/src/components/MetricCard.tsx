import { StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing } from "@/styles/theme";

type MetricCardProps = {
  label: string;
  value: string;
  caption?: string;
  trend?: "up" | "down" | "neutral";
};

export function MetricCard({ label, value, caption, trend = "neutral" }: MetricCardProps) {
  const trendColor = trend === "up" ? colors.positive : trend === "down" ? colors.negative : colors.inkMuted;

  return (
    <View style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      {caption ? <Text style={[styles.caption, { color: trendColor }]}>{caption}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 152,
    gap: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  label: {
    color: colors.inkMuted,
    fontSize: 12,
    fontWeight: "800",
  },
  value: {
    color: colors.ink,
    fontSize: 19,
    fontWeight: "900",
  },
  caption: {
    fontSize: 12,
    fontWeight: "800",
  },
});
