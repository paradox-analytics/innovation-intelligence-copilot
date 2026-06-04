"use client";

import { signIn } from "next-auth/react";
import { Sparkles, Mail, Loader2 } from "lucide-react";
import { useState } from "react";

export default function LoginPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCredentialAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        fullName: isSignUp ? fullName : undefined,
        isSignUp: isSignUp ? "true" : "false",
        redirect: false,
      });

      if (result?.error) {
        setError(result.error);
      } else {
        window.location.href = "/dashboard";
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-primary">
      <div className="absolute inset-0 bg-gradient-to-b from-accent-blue/5 via-transparent to-transparent" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--color-accent-blue)_0%,_transparent_50%)] opacity-10" />

      <div className="relative z-10 flex w-full max-w-md flex-col items-center gap-6 rounded-2xl border border-border-default bg-bg-secondary p-10 shadow-2xl">
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
              {isSignUp ? "Create an account" : "Sign in to continue"}
            </p>
          </div>
        </div>

        {/* Google Sign In */}
        <button
          onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
          className="flex w-full items-center justify-center gap-3 rounded-lg border border-border-default bg-bg-tertiary px-4 py-2.5 text-sm font-medium text-text-primary transition-colors hover:bg-bg-hover"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </button>

        {/* Divider */}
        <div className="flex w-full items-center gap-3">
          <div className="h-px flex-1 bg-border-default" />
          <span className="text-xs text-text-muted">or</span>
          <div className="h-px flex-1 bg-border-default" />
        </div>

        {/* Email/Password Form */}
        <form onSubmit={handleCredentialAuth} className="flex w-full flex-col gap-3">
          {isSignUp && (
            <input
              type="text"
              placeholder="Full Name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-lg border border-border-default bg-bg-tertiary px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-blue"
            />
          )}
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-lg border border-border-default bg-bg-tertiary px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-blue"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            className="w-full rounded-lg border border-border-default bg-bg-tertiary px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-blue"
          />

          {error && (
            <p className="text-xs text-accent-rose">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent-blue px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-blue-hover disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Mail className="h-4 w-4" />
            )}
            {isSignUp ? "Create Account" : "Sign In"}
          </button>
        </form>

        {/* Toggle Sign In / Sign Up */}
        <p className="text-center text-sm text-text-secondary">
          {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
          <button
            onClick={() => { setIsSignUp(!isSignUp); setError(""); }}
            className="font-medium text-accent-blue hover:text-accent-blue-hover"
          >
            {isSignUp ? "Sign In" : "Sign Up"}
          </button>
        </p>

        {/* Footer */}
        <p className="text-center text-xs text-text-muted">
          Enterprise Technology Advisory Platform
        </p>
      </div>
    </div>
  );
}
