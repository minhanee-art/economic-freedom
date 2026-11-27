import { Link, router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import Constants from "expo-constants";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { webUrl } from "@/api/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { Card, Rows, ValueRow } from "@/components/Card";
import { PasswordCard } from "@/components/PasswordCard";
import { ScreenTitle } from "@/components/Parts";
import { clearSession, loadSession } from "@/storage/session";
import { colors, spacing, touchTarget, type } from "@/styles/theme";
import type { AuthSession } from "@/types";

export default function SettingsScreen() {
  const [session, setSession] = useState<AuthSession | null>(null);

  const refreshSession = useCallback(async () => {
    setSession(await loadSession());
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshSession();
    }, [refreshSession])
  );

  const handleLogout = async () => {
    await clearSession();
    setSession(null);
    router.replace("/login");
  };

  return (
    <AppShell>
      <ScreenTitle>설정</ScreenTitle>

      <Card title="계정">
        <Text style={type.body} selectable>
          {session?.user.email ?? "로그인하지 않았습니다"}
        </Text>
        {session ? (
          <Button label="로그아웃" variant="secondary" onPress={handleLogout} />
        ) : (
          <Link href="/login" asChild>
            <Button label="로그인하기" />
          </Link>
        )}
      </Card>

      {session ? <PasswordCard session={session} onSessionChange={setSession} /> : null}

      <Card title="약관 및 안내">
        <Rows>
          <LinkRow label="개인정보처리방침" url={webUrl("/privacy")} />
          <LinkRow label="계정 삭제 안내" url={webUrl("/account-deletion")} />
          <ValueRow label="앱 버전" value={Constants.expoConfig?.version ?? "-"} />
        </Rows>
      </Card>

      {session ? (
        <View style={styles.danger}>
          <Link href="/delete-account" asChild>
            <Button label="계정 삭제" variant="dangerLink" accessibilityRole="link" />
          </Link>
        </View>
      ) : null}
    </AppShell>
  );
}

function LinkRow({ label, url }: { label: string; url: string | null }) {
  if (!url) return null;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityHint="브라우저에서 엽니다"
      onPress={() => Linking.openURL(url)}
      android_ripple={{ color: colors.ripple }}
      style={({ pressed }) => [styles.linkRow, pressed && styles.linkRowPressed]}
    >
      <Text style={type.body}>{label}</Text>
      <Text style={[type.label, { color: colors.primary }]}>열기</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  linkRow: {
    minHeight: touchTarget + 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  linkRowPressed: { backgroundColor: colors.surfaceMuted },
  danger: { alignItems: "center" },
});
