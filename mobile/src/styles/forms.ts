import { StyleSheet } from "react-native";
import { colors, radius, spacing } from "@/styles/theme";

export const formStyles = StyleSheet.create({
  title: {
    color: colors.ink,
    fontSize: 28,
    fontWeight: "900",
  },
  subtitle: {
    marginBottom: spacing.lg,
    color: colors.inkMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  field: {
    gap: spacing.sm,
  },
  label: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "900",
  },
  input: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    backgroundColor: colors.canvas,
    color: colors.ink,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 16,
  },
  error: {
    borderRadius: radius.md,
    backgroundColor: colors.negativeSoft,
    color: colors.negative,
    padding: spacing.md,
    fontSize: 13,
    fontWeight: "800",
  },
  button: {
    marginTop: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.ink,
    padding: spacing.lg,
  },
  dangerButton: {
    backgroundColor: colors.negative,
  },
  buttonDisabled: {
    backgroundColor: colors.inkSubtle,
  },
  buttonText: {
    color: colors.surface,
    textAlign: "center",
    fontSize: 16,
    fontWeight: "900",
  },
  linkButton: {
    marginTop: spacing.lg,
    padding: spacing.md,
  },
  linkText: {
    color: colors.primary,
    textAlign: "center",
    fontSize: 14,
    fontWeight: "800",
  },
  helper: {
    marginTop: spacing.lg,
    color: colors.inkMuted,
    fontSize: 12,
    lineHeight: 18,
  },
});
