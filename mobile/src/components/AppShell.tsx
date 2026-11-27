import { useContext, type PropsWithChildren } from "react";
import { HeaderHeightContext } from "expo-router/react-navigation";
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, contentMaxWidth, spacing } from "@/styles/theme";

type AppShellProps = PropsWithChildren<{
  refreshing?: boolean;
  onRefresh?: () => void;
  /** 키보드 회피 위치 보정. 기본은 스택 헤더 높이(헤더 없는 탭 화면은 0). */
  keyboardOffset?: number;
}>;

/**
 * 모든 화면의 바탕. 내용 사이 간격 16, 태블릿·가로에서 본문 최대 폭 560 가운데 정렬.
 * 입력 화면을 위해 키보드 회피(iOS padding)와 keyboardShouldPersistTaps="handled"(키보드가 열린 채 버튼 한 번에 눌림)를 둔다.
 */
export function AppShell({ children, refreshing = false, onRefresh, keyboardOffset }: AppShellProps) {
  // iOS 의 KeyboardAvoidingView(padding)는 자기 위치를 화면 맨 위 기준으로 계산하지 않으므로, 스택 헤더가 있는 화면은 그 높이만큼 보정한다.
  const headerHeight = useContext(HeaderHeightContext) ?? 0;
  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={keyboardOffset ?? headerHeight}
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
