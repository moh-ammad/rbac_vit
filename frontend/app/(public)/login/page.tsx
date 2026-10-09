import Link from "next/link";
import { AuthPage } from "@/components/auth/auth-form";

export default function LoginPage() {
  return <AuthPage title="Welcome back" eyebrow="Your classroom, in focus" description="Pick up where you left off and keep your school moving forward." formTitle="Sign in to your workspace" mode="login" footer={<span>New here? <Link href="/register" className="font-semibold text-[#365341] hover:underline">Create an account</Link></span>} />;
}
