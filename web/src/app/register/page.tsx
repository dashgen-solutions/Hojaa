"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import {
  ArrowRightIcon,
  SparklesIcon,
  BuildingOffice2Icon,
  UserIcon,
} from "@heroicons/react/24/outline";

type RegistrationType = "individual" | "organization";

export default function RegisterPage() {
  const [registrationType, setRegistrationType] =
    useState<RegistrationType>("organization");

  // Account fields
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Organization fields
  const [orgName, setOrgName] = useState("");
  const [industry, setIndustry] = useState("");
  const [companySize, setCompanySize] = useState("");
  const [website, setWebsite] = useState("");

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
    if (registrationType === "organization" && orgName.trim().length < 2) {
      setError("Organization name must be at least 2 characters");
      return;
    }

    setIsLoading(true);
    try {
      const orgData =
        registrationType === "organization"
          ? {
              organization_name: orgName.trim(),
              industry: industry || undefined,
              company_size: companySize || undefined,
              website: website || undefined,
            }
          : undefined;

      await register(email, username, password, orgData);
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

  const industries = [
    "Technology",
    "Finance & Banking",
    "Healthcare",
    "Education",
    "Retail & E-Commerce",
    "Manufacturing",
    "Consulting",
    "Media & Entertainment",
    "Government",
    "Non-Profit",
    "Other",
  ];

  const companySizes = [
    "1-10",
    "11-50",
    "51-200",
    "201-500",
    "501-1000",
    "1001-5000",
    "5000+",
  ];

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
        <div className="flex items-center justify-center min-h-full py-8 px-4">
        <div className="w-full max-w-lg animate-fade-in-up">
          {/* Logo and Title */}
          <div className="text-center mb-6">
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

          {/* Registration Type Toggle */}
          <div className="flex gap-3 mb-6">
            <button
              type="button"
              onClick={() => setRegistrationType("organization")}
              className={`flex-1 flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                registrationType === "organization"
                  ? "border-primary-500 bg-primary-50 shadow-soft-sm"
                  : "border-neutral-200 bg-white hover:border-neutral-300"
              }`}
            >
              <BuildingOffice2Icon
                className={`w-6 h-6 ${
                  registrationType === "organization"
                    ? "text-primary-600"
                    : "text-neutral-400"
                }`}
              />
              <div className="text-left">
                <div
                  className={`text-sm font-semibold ${
                    registrationType === "organization"
                      ? "text-primary-700"
                      : "text-neutral-700"
                  }`}
                >
                  Organization
                </div>
                <div className="text-xs text-neutral-500">
                  Team & enterprise
                </div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setRegistrationType("individual")}
              className={`flex-1 flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                registrationType === "individual"
                  ? "border-primary-500 bg-primary-50 shadow-soft-sm"
                  : "border-neutral-200 bg-white hover:border-neutral-300"
              }`}
            >
              <UserIcon
                className={`w-6 h-6 ${
                  registrationType === "individual"
                    ? "text-primary-600"
                    : "text-neutral-400"
                }`}
              />
              <div className="text-left">
                <div
                  className={`text-sm font-semibold ${
                    registrationType === "individual"
                      ? "text-primary-700"
                      : "text-neutral-700"
                  }`}
                >
                  Individual
                </div>
                <div className="text-xs text-neutral-500">Personal use</div>
              </div>
            </button>
          </div>

          {/* Register Form */}
          <div className="card p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Error */}
              {error && (
                <div className="p-3 bg-danger-50 border border-danger-200 text-danger-700 rounded-xl text-sm animate-fade-in">
                  {error}
                </div>
              )}

              {/* Organization Fields */}
              {registrationType === "organization" && (
                <div className="space-y-4 pb-4 border-b border-neutral-100">
                  <div className="flex items-center gap-2 mb-1">
                    <BuildingOffice2Icon className="w-4 h-4 text-primary-500" />
                    <span className="text-xs font-semibold text-primary-600 uppercase tracking-wider">
                      Organization Details
                    </span>
                  </div>

                  <div>
                    <label
                      htmlFor="orgName"
                      className="block text-sm font-medium text-neutral-700 mb-1.5"
                    >
                      Organization Name <span className="text-danger-500">*</span>
                    </label>
                    <input
                      id="orgName"
                      type="text"
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      required
                      className="input"
                      placeholder="Acme Corporation"
                      disabled={isLoading}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label
                        htmlFor="industry"
                        className="block text-sm font-medium text-neutral-700 mb-1.5"
                      >
                        Industry
                      </label>
                      <select
                        id="industry"
                        value={industry}
                        onChange={(e) => setIndustry(e.target.value)}
                        className="input"
                        disabled={isLoading}
                      >
                        <option value="">Select industry</option>
                        {industries.map((ind) => (
                          <option key={ind} value={ind}>
                            {ind}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label
                        htmlFor="companySize"
                        className="block text-sm font-medium text-neutral-700 mb-1.5"
                      >
                        Company Size
                      </label>
                      <select
                        id="companySize"
                        value={companySize}
                        onChange={(e) => setCompanySize(e.target.value)}
                        className="input"
                        disabled={isLoading}
                      >
                        <option value="">Select size</option>
                        {companySizes.map((sz) => (
                          <option key={sz} value={sz}>
                            {sz} employees
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="website"
                      className="block text-sm font-medium text-neutral-700 mb-1.5"
                    >
                      Website
                    </label>
                    <input
                      id="website"
                      type="url"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      className="input"
                      placeholder="https://example.com"
                      disabled={isLoading}
                    />
                  </div>
                </div>
              )}

              {/* Account Fields */}
              <div className="space-y-4">
                {registrationType === "organization" && (
                  <div className="flex items-center gap-2 mb-1">
                    <UserIcon className="w-4 h-4 text-primary-500" />
                    <span className="text-xs font-semibold text-primary-600 uppercase tracking-wider">
                      Admin Account
                    </span>
                  </div>
                )}

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

                <div className="grid grid-cols-2 gap-3">
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
                      placeholder="6+ characters"
                      disabled={isLoading}
                    />
                  </div>
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
                      placeholder="Re-enter password"
                      disabled={isLoading}
                    />
                  </div>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full btn-primary py-3"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Creating{" "}
                    {registrationType === "organization"
                      ? "Organization..."
                      : "Account..."}
                  </>
                ) : (
                  <>
                    {registrationType === "organization"
                      ? "Create Organization"
                      : "Create Account"}
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
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
