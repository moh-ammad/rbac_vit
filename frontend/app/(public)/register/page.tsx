import Link from "next/link";
import { AuthPage } from "@/components/auth/auth-form";

export default function RegisterPage() {
  return <AuthPage title="Join your school" eyebrow="Learning, organised" description="Create your account. An administrator will give you the right role — teacher, student or staff." formTitle="Create an account" mode="register" footer={<span>Already have an account? <Link href="/login" className="font-semibold text-[#365341] hover:underline">Sign in</Link></span>} />;
}
