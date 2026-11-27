import type { Metadata } from "next";
import { AuthForm } from "@/components/ui/auth-form";
import { loginErrorMessage } from "@/lib/login-errors";

export const metadata: Metadata = { title: "로그인 · 가족연금계획" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { error } = await searchParams;
  return <AuthForm mode="login" initialError={loginErrorMessage(error) ?? undefined} />;
}
