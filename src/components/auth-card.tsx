import Image from "next/image";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.57-5.17 3.57-8.82Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.88-3c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.95H1.27v3.1A12 12 0 0 0 12 24Z"
      />
      <path fill="#FBBC05" d="M5.27 14.29a7.2 7.2 0 0 1 0-4.58v-3.1H1.27a12 12 0 0 0 0 10.78l4-3.1Z" />
      <path
        fill="#EA4335"
        d="M12 4.77c1.77 0 3.35.61 4.6 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.27 6.61l4 3.1C6.22 6.88 8.87 4.77 12 4.77Z"
      />
    </svg>
  );
}

export function AuthCard({
  title,
  subtitle,
  tabs,
  children,
  footer,
  googleHref,
}: {
  title: string;
  subtitle: string;
  tabs?: React.ReactNode;
  children: React.ReactNode;
  footer: React.ReactNode;
  googleHref?: string;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="app-card w-full max-w-sm rounded-xl border border-border bg-card p-6">
        <div className="mb-4 flex flex-col items-center">
          <Image src="/logo.png" alt="" width={64} height={64} loading="eager" className="shrink-0 rounded-md" />
          <div className="mt-2 text-lg font-semibold leading-tight">
            DEV<span className="text-[#2a78d6]">OS</span>
          </div>
          <h1 className="mt-3 text-sm font-semibold text-foreground">{title}</h1>
          <p className="mt-1 text-center text-xs text-muted-foreground">{subtitle}</p>
        </div>

        {tabs && <div className="mb-4">{tabs}</div>}

        {children}

        {googleHref && (
          <>
            <div className="my-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="shrink-0 text-[11px] text-muted-foreground">Or continue with</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <a href={googleHref} className={cn(buttonVariants({ variant: "outline" }), "w-full gap-2")}>
              <GoogleIcon className="size-4" />
              Continue with Google
            </a>
          </>
        )}

        <div className="mt-4 text-center text-xs text-muted-foreground">{footer}</div>
      </div>
    </div>
  );
}
