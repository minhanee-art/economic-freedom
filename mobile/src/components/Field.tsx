import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from "react-native";
import { Text } from "@/components/AppText";
import { Button } from "@/components/Button";
import { colors, radius, spacing, touchTarget, type } from "@/styles/theme";
import { formatDateInput, quickDates } from "@/utils/records";

type TextFieldProps = Omit<TextInputProps, "style"> & {
  label: string;
  /** 이 칸의 오류. 칸 바로 아래에 보이고 스크린리더가 읽는다. */
  error?: string | null;
  helper?: string;
  ref?: React.Ref<TextInput>;
  /** 비밀번호 칸: 칸 오른쪽에 '표시/숨기기' 전환 버튼을 둔다(웹 auth-form 의 PasswordInput 과 같은 이름·상태). */
  revealable?: boolean;
};

/** 라벨 + 입력칸 + (도움말 또는 오류). 입력칸의 접근성 이름은 라벨과 같다. */
export function TextField({ label, error, helper, ref, revealable, ...input }: TextFieldProps) {
  const [revealed, setRevealed] = useState(false);
  const field = (
    <TextInput
      ref={ref}
      accessibilityLabel={label}
      accessibilityHint={error ?? helper}
      aria-invalid={error ? true : undefined}
      placeholderTextColor={colors.placeholder}
      {...input}
      secureTextEntry={revealable ? !revealed : input.secureTextEntry}
      style={[styles.input, error ? styles.inputError : null, revealable ? styles.inputWithToggle : null]}
    />
  );
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {revealable ? (
        <View style={styles.inputRow}>
          {field}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${label} ${revealed ? "숨기기" : "표시"}`}
            accessibilityState={{ selected: revealed }}
            aria-pressed={revealed}
            onPress={() => setRevealed((v) => !v)}
            android_ripple={{ color: colors.ripple, borderless: false }}
            style={({ pressed }) => [styles.toggle, pressed ? styles.togglePressed : null]}
          >
            <Text style={styles.toggleText}>{revealed ? "숨기기" : "표시"}</Text>
          </Pressable>
        </View>
      ) : (
        field
      )}
      {error ? <FieldError message={error} /> : helper ? <Text style={type.caption}>{helper}</Text> : null}
    </View>
  );
}

export function FieldError({ message }: { message: string }) {
  return (
    <Text style={styles.error} accessibilityRole="alert" accessibilityLiveRegion="polite">
      {message}
    </Text>
  );
}

/**
 * 거래일·수령일 입력. 숫자 키패드로 8자리만 치면 하이픈이 자동으로 들어가고, '오늘'·'어제' 칩으로 바로 고를 수 있다.
 * 네이티브 날짜 선택기는 새 네이티브 의존성이 필요해 넣지 않았다.
 */
export function DateField({
  label,
  value,
  onChange,
  error,
  ref,
  ...input
}: Omit<TextFieldProps, "value" | "onChangeText" | "onChange"> & { value: string; onChange: (next: string) => void }) {
  const { today, yesterday } = quickDates();
  return (
    <View style={styles.field}>
      <TextField
        ref={ref}
        label={label}
        value={value}
        onChangeText={(text) => onChange(formatDateInput(text))}
        error={error}
        helper="숫자 8자리(예: 20260131)를 입력하면 하이픈이 들어갑니다."
        inputMode="numeric"
        keyboardType="number-pad"
        maxLength={10}
        placeholder="YYYY-MM-DD"
        {...input}
      />
      <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel={`${label} 빠른 선택`}>
        {[
          ["오늘", today],
          ["어제", yesterday],
        ].map(([chipLabel, chipValue]) => (
          <Button
            key={chipLabel}
            label={chipLabel}
            variant="secondary"
            compact
            accessibilityRole="radio"
            accessibilityState={{ selected: value === chipValue }}
            aria-checked={value === chipValue}
            onPress={() => onChange(chipValue)}
            style={value === chipValue ? styles.chipActive : null}
          />
        ))}
      </View>
    </View>
  );
}

export const fieldStyles = StyleSheet.create({
  input: {
    minHeight: 48,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    backgroundColor: colors.surface,
    color: colors.ink,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 16,
    fontVariant: ["tabular-nums"],
  },
});

const styles = StyleSheet.create({
  field: { gap: spacing.sm },
  label: { ...type.label, color: colors.ink },
  input: fieldStyles.input,
  inputError: { borderColor: colors.danger, borderWidth: 2 },
  inputRow: { position: "relative", justifyContent: "center" },
  inputWithToggle: { paddingRight: 72 },
  toggle: {
    position: "absolute",
    right: 2,
    top: 2,
    bottom: 2,
    minWidth: 64,
    minHeight: touchTarget,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
  },
  togglePressed: { backgroundColor: colors.surfaceMuted },
  toggleText: { ...type.label, color: colors.ink, fontWeight: "600" },
  error: { ...type.label, color: colors.danger },
  chips: { flexDirection: "row", gap: spacing.sm },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
});
