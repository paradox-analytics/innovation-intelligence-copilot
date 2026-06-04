"use client";

import { LoginButton } from "@/components/auth/login-button";
import { Sparkles } from "lucide-react";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-primary">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-accent-blue/5 via-transparent to-transparent" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--color-accent-blue)_0%,_transparent_50%)] opacity-10" />

      <div className="relative z-10 flex w-full max-w-md flex-col items-center gap-8 rounded-2xl border border-border-default bg-bg-secondary p-10 shadow-2xl">
        {/* Logo */}
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-blue/10">
            <Sparkles className="h-8 w-8 text-accent-blue" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight text-text-primary">
              Innovation Intelligence
              <br />
              <span className="bg-gradient-to-r from-accent-blue to-accent-cyan bg-clip-text text-transparent">
                Copilot
              </span>
            </h1>
            <p className="mt-2 text-sm text-text-secondary">
              Sign in to continue
            </p>
          </div>
        </div>

        {/* Divider */}
        <div className="w-full border-t border-border-default" />

        {/* Sign-in button */}
        <LoginButton />

        {/* Footer */}
        <p className="text-center text-xs text-text-muted">
          Enterprise Technology Advisory Platform
        </p>
      </div>
    </div>
  );
}
