"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import { ArrowRightIcon, SparklesIcon } from "@heroicons/react/24/outline";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { register, isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.push("/sessions");
    }
  }, [isAuthenticated, authLoading, router]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters long");
      return;
    }

    if (password.length > 72) {
      setError("Password is too long. Maximum length is 72 characters.");
      return;
    }

    if (username.length < 3) {
      setError("Username must be at least 3 characters long");
      return;
    }

    setIsLoading(true);

    try {
      await register(email, username, password);
      router.push("/sessions");
    } catch (err: any) {
      setError(err.message || "Registration failed. Please try again.");
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
    <div className="min-h-screen bg-neutral-50 flex flex-col">
      {/* Header */}
      <header className="p-4">
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
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md animate-fade-in-up">
          {/* Logo and Title */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl mb-4 shadow-glow">
              <SparklesIcon className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-neutral-900 mb-2">
              Create your account
            </h1>
            <p className="text-neutral-500">
              Start discovering requirements with AI
            </p>
          </div>

          {/* Register Form */}
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

              {/* Username Field */}
              <div>
                <label
                  htmlFor="username"
                  className="block text-sm font-medium text-neutral-700 mb-1.5"
                >
                  Username
                </label>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  minLength={3}
                  maxLength={100}
                  className="input"
                  placeholder="Choose a username"
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
                  minLength={6}
                  maxLength={72}
                  className="input"
                  placeholder="6-72 characters"
                  disabled={isLoading}
                />
              </div>

              {/* Confirm Password Field */}
              <div>
                <label
                  htmlFor="confirmPassword"
                  className="block text-sm font-medium text-neutral-700 mb-1.5"
                >
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  maxLength={72}
                  className="input"
                  placeholder="Re-enter your password"
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
                    Creating Account...
                  </>
                ) : (
                  <>
                    Create Account
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

            {/* Login Link */}
            <div className="text-center">
              <p className="text-sm text-neutral-600">
                Already have an account?{" "}
                <Link
                  href="/login"
                  className="text-primary-600 font-medium hover:text-primary-700 transition-colors"
                >
                  Sign in
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
  );
}
