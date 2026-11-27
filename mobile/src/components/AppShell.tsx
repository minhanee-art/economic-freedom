import type { PropsWithChildren } from "react";
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, contentMaxWidth, spacing } from "@/styles/theme";

type AppShellProps = PropsWithChildren<{
  refreshing?: boolean;
  onRefresh?: () => void;
  /** iOS 에서 스택 헤더 높이만큼 키보드 회피 위치를 보정한다(헤더가 있는 입력 화면). */
  keyboardOffset?: number;
}>;

/**
 * 모든 화면의 바탕. 내용 사이 간격 16, 태블릿·가로에서 본문 최대 폭 560 가운데 정렬.
 * 입력 화면을 위해 키보드 회피(iOS padding)와 keyboardShouldPersistTaps="handled"(키보드가 열린 채 버튼 한 번에 눌림)를 둔다.
 */
export function AppShell({ children, refreshing = false, onRefresh, keyboardOffset = 0 }: AppShellProps) {
  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={keyboardOffset}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} /> : undefined}
        >
          <View style={styles.column}>{children}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  flex: { flex: 1 },
  content: { flexGrow: 1, padding: spacing.lg, paddingBottom: spacing.xxl },
  column: { width: "100%", maxWidth: contentMaxWidth, alignSelf: "center", gap: spacing.lg },
});
