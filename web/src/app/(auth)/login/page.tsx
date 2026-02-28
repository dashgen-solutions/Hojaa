"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import { ArrowRightIcon } from "@heroicons/react/24/outline";
import HojaaLogo from '@/components/brand/HojaaLogo';

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { login, isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.push("/projects");
    }
  }, [isAuthenticated, authLoading, router]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      await login(email, password);
      router.push("/projects");
    } catch (err: any) {
      setError(err.message || "Login failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f8f8] dark:bg-[#060606]">
        <div className="text-center animate-fade-in">
          <div className="relative w-16 h-16 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full border-4 border-neutral-200 dark:border-neutral-700"></div>
            <div className="absolute inset-0 rounded-full border-4 border-neutral-900 dark:border-neutral-100 border-t-transparent animate-spin"></div>
          </div>
          <p className="text-neutral-500 dark:text-neutral-400 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#f8f8f8] dark:bg-[#060606] flex flex-col overflow-hidden">
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="flex items-center justify-center min-h-full p-4">
          <div className="w-full max-w-md animate-fade-in-up">
            <div className="text-center mb-8">
              <Link href="/" className="inline-block">
                <HojaaLogo size={48} showText className="justify-center" />
              </Link>
              <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-2 mt-4">Welcome back</h1>
              <p className="text-neutral-500 dark:text-neutral-400">Sign in to continue your requirements discovery</p>
            </div>

            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-md p-6 shadow-sm">
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="p-3 bg-danger-50 border border-danger-200 text-danger-700 rounded-md text-sm animate-fade-in">
                    {error}
                  </div>
                )}

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
                    Email Address
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="input"
                    placeholder="you@example.com"
                    disabled={isLoading}
                  />
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="input"
                    placeholder="Enter your password"
                    disabled={isLoading}
                  />
                </div>

                <button type="submit" disabled={isLoading} className="w-full btn-primary py-3">
                  {isLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Signing in...
                    </>
                  ) : (
                    <>
                      Sign In
                      <ArrowRightIcon className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              <div className="flex items-center gap-4 my-6">
                <div className="flex-1 divider"></div>
                <span className="text-xs text-neutral-400 dark:text-neutral-500 font-medium">or</span>
                <div className="flex-1 divider"></div>
              </div>

              <div className="text-center">
                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                  Don&apos;t have an account?{" "}
                  <Link href="/register" className="text-neutral-700 dark:text-neutral-300 font-medium hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors">
                    Create one
                  </Link>
                </p>
              </div>

              <div className="mt-4 text-center">
                <Link href="/" className="text-sm text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors">
                  Continue as guest
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
