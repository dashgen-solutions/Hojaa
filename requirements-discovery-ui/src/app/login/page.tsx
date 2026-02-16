"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import { ArrowRightIcon, SparklesIcon } from "@heroicons/react/24/outline";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { login, isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.push("/sessions");
    }
  }, [isAuthenticated, authLoading, router]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      await login(email, password);
      router.push("/sessions");
    } catch (err: any) {
      setError(err.message || "Login failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <div className="text-center animate-fade-in">
          <div className="relative w-16 h-16 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full border-4 border-neutral-200"></div>
            <div className="absolute inset-0 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
          </div>
          <p className="text-neutral-500 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-neutral-50 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="shrink-0 p-4">
        <Link href="/" className="inline-flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center shadow-soft-sm">
            <span className="text-white font-bold text-sm">M</span>
          </div>
          <span className="text-lg font-semibold text-neutral-900">
            MoMetric
          </span>
        </Link>
      </header>

      {/* Main Content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="flex items-center justify-center min-h-full p-4">
        <div className="w-full max-w-md animate-fade-in-up">
          {/* Logo and Title */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl mb-4 shadow-glow">
              <SparklesIcon className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-neutral-900 mb-2">
              Welcome back
            </h1>
            <p className="text-neutral-500">
              Sign in to continue your requirements discovery
            </p>
          </div>

          {/* Login Form */}
          <div className="card p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Error Message */}
              {error && (
                <div className="p-3 bg-danger-50 border border-danger-200 text-danger-700 rounded-xl text-sm animate-fade-in">
                  {error}
                </div>
              )}

              {/* Email Field */}
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-neutral-700 mb-1.5"
                >
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

              {/* Password Field */}
              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-neutral-700 mb-1.5"
                >
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

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full btn-primary py-3"
              >
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

            {/* Divider */}
            <div className="flex items-center gap-4 my-6">
              <div className="flex-1 divider"></div>
              <span className="text-xs text-neutral-400 font-medium">or</span>
              <div className="flex-1 divider"></div>
            </div>

            {/* Register Link */}
            <div className="text-center">
              <p className="text-sm text-neutral-600">
                Don't have an account?{" "}
                <Link
                  href="/register"
                  className="text-primary-600 font-medium hover:text-primary-700 transition-colors"
                >
                  Create one
                </Link>
              </p>
            </div>

            {/* Guest Access */}
            <div className="mt-4 text-center">
              <Link
                href="/"
                className="text-sm text-neutral-400 hover:text-neutral-600 transition-colors"
              >
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
