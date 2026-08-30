import Link from "next/link";
import { SignupForm } from "@/components/signup-form";
import { AuthCard } from "@/components/auth-card";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; email?: string }>;
}) {
  const { error, email } = await searchParams;

  return (
    <AuthCard
      title="Create your agency"
      subtitle="Set up your agency"
      googleHref="/api/auth/google/start?intent=signup"
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-link hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <SignupForm error={error} defaultEmail={email} />
    </AuthCard>
  );
}
