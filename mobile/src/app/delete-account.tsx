import { router } from "expo-router";
import { useState } from "react";
import { Alert, Linking, Pressable, Text, TextInput, View } from "react-native";
import { deleteAccount } from "@/api/auth";
import { webUrl } from "@/api/client";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/Card";
import { clearSession, loadSession } from "@/storage/session";
import { formStyles as styles } from "@/styles/forms";
import { colors } from "@/styles/theme";

export default function DeleteAccountScreen() {
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const guideUrl = webUrl("/account-deletion");

  const performDelete = async () => {
    setIsSubmitting(true);
    setError("");
    try {
      const session = await loadSession();
      if (!session) {
        router.replace("/login");
        return;
      }
      await deleteAccount(session.token, password);
      await clearSession();
      router.replace("/login");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDelete = () => {
    Alert.alert(
      "정말 계정을 삭제할까요?",
      "계정과 모든 포트폴리오 데이터가 영구 삭제되며 되돌릴 수 없습니다.",
      [
        { text: "취소", style: "cancel" },
        { text: "계정 삭제", style: "destructive", onPress: performDelete },
      ]
    );
  };

  const disabled = isSubmitting || !password;

  return (
    <AppShell>
      <Text style={styles.title}>계정 삭제</Text>
      <Text style={styles.subtitle}>계정을 삭제하면 저장된 모든 데이터가 영구적으로 사라지며 복구할 수 없습니다.</Text>

      <Card title="비밀번호 확인">
        <View style={styles.field}>
          <Text style={styles.label}>비밀번호</Text>
          <TextInput
            autoComplete="current-password"
            onChangeText={setPassword}
            placeholder="현재 비밀번호"
            placeholderTextColor={colors.inkSubtle}
            secureTextEntry
            style={styles.input}
            value={password}
          />
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable
          disabled={disabled}
          onPress={confirmDelete}
          style={[styles.button, styles.dangerButton, disabled && styles.buttonDisabled]}
        >
          <Text style={styles.buttonText}>{isSubmitting ? "삭제 중" : "계정 영구 삭제"}</Text>
        </Pressable>
      </Card>

      {guideUrl ? (
        <Pressable style={styles.linkButton} onPress={() => Linking.openURL(guideUrl)}>
          <Text style={styles.linkText}>계정 삭제 안내 보기</Text>
        </Pressable>
      ) : null}
    </AppShell>
  );
}
