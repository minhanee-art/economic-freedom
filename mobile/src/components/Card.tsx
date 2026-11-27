import { Children, Fragment, isValidElement, type PropsWithChildren, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "@/components/AppText";
import { colors, radius, spacing, type } from "@/styles/theme";

type CardProps = PropsWithChildren<{
  title?: string;
  /** 제목 오른쪽의 짧은 값(예: "65세"). 버튼이 아니다. */
  aside?: string;
}>;

/** 한 겹짜리 묶음. 카드 안에 다시 테두리 상자를 넣지 않는다(행은 Rows 의 구분선으로 나눈다). */
export function Card({ title, aside, children }: CardProps) {
  return (
    <View style={styles.card}>
      {title ? (
        <View style={styles.header}>
          <Text style={styles.title} accessibilityRole="header">
            {title}
          </Text>
          {aside ? <Text style={styles.aside}>{aside}</Text> : null}
        </View>
      ) : null}
      {children}
    </View>
  );
}

/** 자식 사이에 얇은 구분선을 넣어 목록 행으로 보인다. null 자식은 건너뛴다. */
export function Rows({ children }: { children: ReactNode }) {
  const items = Children.toArray(children).filter(isValidElement);
  return (
    <View>
      {items.map((child, index) => (
        <Fragment key={child.key ?? index}>
          {index > 0 ? <View style={styles.divider} /> : null}
          {child}
        </Fragment>
      ))}
    </View>
  );
}

/** 왼쪽 라벨 + 오른쪽 숫자 한 줄. */
export function ValueRow({ label, value, sub, strong, valueColor }: { label: string; value: string; sub?: string; strong?: boolean; valueColor?: string }) {
  return (
    <View style={styles.valueRow}>
      <View style={styles.valueRowMain}>
        <Text style={strong ? styles.valueLabelStrong : styles.valueLabel}>{label}</Text>
        {sub ? <Text style={type.caption}>{sub}</Text> : null}
      </View>
      <Text style={[type.number, strong ? styles.valueStrong : null, valueColor ? { color: valueColor } : null]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  header: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  title: { ...type.heading, flexShrink: 1 },
  aside: { ...type.label, fontVariant: ["tabular-nums"] },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.line },
  valueRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    minHeight: 40,
    paddingVertical: spacing.sm,
  },
  valueRowMain: { flex: 1, gap: 2 },
  valueLabel: { ...type.body, color: colors.inkMuted },
  valueLabelStrong: { ...type.body, fontWeight: "600" },
  valueStrong: { fontSize: 17, lineHeight: 24 },
});
