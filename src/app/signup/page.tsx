import type { Metadata } from "next";
import { AuthForm } from "@/components/ui/auth-form";

export const metadata: Metadata = { title: "회원가입 · 가족연금계획" };

export default function SignupPage() {
  return <AuthForm mode="signup" />;
}
