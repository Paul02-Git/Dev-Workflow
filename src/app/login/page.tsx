import Link from "next/link";
import { loginAction } from "@/lib/auth-actions";
import { AuthCard } from "@/components/auth-card";
import { Input } from "@/components/ui/input";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; minutes?: string }>;
}) {
  const { error, minutes } = await searchParams;

  return (
    <AuthCard
      title="Welcome back"
      subtitle="Sign in to continue"
      googleHref="/api/auth/google/start"
      footer={
        <>
          New agency?{" "}
          <Link href="/signup" className="font-semibold text-primary hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form action={loginAction} className="space-y-3">
        <Input
          id="email"
          type="email"
          name="email"
          placeholder="Email"
          aria-label="Email"
          required
          autoFocus
          autoCapitalize="off"
          autoCorrect="off"
        />
        <Input id="password" type="password" name="password" placeholder="Password" aria-label="Password" required />
        {error === "ratelimited" && (
          <p className="text-xs font-medium text-[#d03b3b]">
            Too many failed attempts. Try again in {minutes ?? "15"} minutes.
          </p>
        )}
        {error === "1" && <p className="text-xs font-medium text-[#d03b3b]">Wrong email or password. Try again.</p>}
        {error === "google_no_account" && (
          <p className="text-xs font-medium text-[#d03b3b]">
            No agency account is linked to that Google email yet. Sign in with your email and password, or{" "}
            <Link href="/signup" className="underline">
              create an account
            </Link>
            .
          </p>
        )}
        {error === "google_failed" && (
          <p className="text-xs font-medium text-[#d03b3b]">Google sign-in didn&apos;t go through. Please try again.</p>
        )}
        <button type="submit" className={cn(buttonVariants(), "w-full")}>
          Sign in
        </button>
      </form>
    </AuthCard>
  );
}
