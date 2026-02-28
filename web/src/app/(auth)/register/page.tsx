"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import {
  ArrowRightIcon,
  BuildingOffice2Icon,
  UserIcon,
} from "@heroicons/react/24/outline";
import HojaaLogo from '@/components/brand/HojaaLogo';

type RegistrationType = "individual" | "organization";

export default function RegisterPage() {
  const [registrationType, setRegistrationType] =
    useState<RegistrationType>("organization");

  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

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
      router.push("/projects");
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
      router.push("/projects");
    } catch (err: any) {
      setError(err.message || "Registration failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-[#060606]">
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

  const industries = [
    "Technology", "Finance & Banking", "Healthcare", "Education",
    "Retail & E-Commerce", "Manufacturing", "Consulting",
    "Media & Entertainment", "Government", "Non-Profit", "Other",
  ];

  const companySizes = ["1-10", "11-50", "51-200", "201-500", "501-1000", "1001-5000", "5000+"];

  return (
    <div className="h-screen bg-neutral-50 dark:bg-[#060606] flex flex-col overflow-hidden">
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="flex items-center justify-center min-h-full py-8 px-4">
          <div className="w-full max-w-lg animate-fade-in-up">
            <div className="text-center mb-6">
              <Link href="/" className="inline-block">
                <HojaaLogo size={48} showText className="justify-center" />
              </Link>
              <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-2 mt-4">Create your account</h1>
              <p className="text-neutral-500 dark:text-neutral-400">Start discovering requirements with AI</p>
            </div>

            <div className="flex gap-3 mb-6">
              <button
                type="button"
                onClick={() => setRegistrationType("organization")}
                className={`flex-1 flex items-center gap-3 p-4 rounded-md border-2 transition-all ${
                  registrationType === "organization"
                    ? "border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 shadow-sm"
                    : "border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:border-neutral-300 dark:hover:border-neutral-600"
                }`}
              >
                <BuildingOffice2Icon className={`w-6 h-6 ${registrationType === "organization" ? "text-neutral-900 dark:text-neutral-100" : "text-neutral-400 dark:text-neutral-500"}`} />
                <div className="text-left">
                  <div className={`text-sm font-semibold ${registrationType === "organization" ? "text-neutral-900 dark:text-neutral-100" : "text-neutral-700 dark:text-neutral-300"}`}>Organization</div>
                  <div className="text-xs text-neutral-500 dark:text-neutral-400">Team & enterprise</div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setRegistrationType("individual")}
                className={`flex-1 flex items-center gap-3 p-4 rounded-md border-2 transition-all ${
                  registrationType === "individual"
                    ? "border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 shadow-sm"
                    : "border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:border-neutral-300 dark:hover:border-neutral-600"
                }`}
              >
                <UserIcon className={`w-6 h-6 ${registrationType === "individual" ? "text-neutral-900 dark:text-neutral-100" : "text-neutral-400 dark:text-neutral-500"}`} />
                <div className="text-left">
                  <div className={`text-sm font-semibold ${registrationType === "individual" ? "text-neutral-900 dark:text-neutral-100" : "text-neutral-700 dark:text-neutral-300"}`}>Individual</div>
                  <div className="text-xs text-neutral-500 dark:text-neutral-400">Personal use</div>
                </div>
              </button>
            </div>

            <div className="card p-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="p-3 bg-danger-50 border border-danger-200 text-danger-700 rounded-md text-sm animate-fade-in">
                    {error}
                  </div>
                )}

                {registrationType === "organization" && (
                  <div className="space-y-4 pb-4 border-b border-neutral-100 dark:border-neutral-700">
                    <div className="flex items-center gap-2 mb-1">
                      <BuildingOffice2Icon className="w-4 h-4 text-neutral-900 dark:text-neutral-100" />
                      <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider">Organization Details</span>
                    </div>
                    <div>
                      <label htmlFor="orgName" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
                        Organization Name <span className="text-danger-500">*</span>
                      </label>
                      <input id="orgName" type="text" value={orgName} onChange={(e) => setOrgName(e.target.value)} required className="input" placeholder="Acme Corporation" disabled={isLoading} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="industry" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">Industry</label>
                        <select id="industry" value={industry} onChange={(e) => setIndustry(e.target.value)} className="input" disabled={isLoading}>
                          <option value="">Select industry</option>
                          {industries.map((ind) => (<option key={ind} value={ind}>{ind}</option>))}
                        </select>
                      </div>
                      <div>
                        <label htmlFor="companySize" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">Company Size</label>
                        <select id="companySize" value={companySize} onChange={(e) => setCompanySize(e.target.value)} className="input" disabled={isLoading}>
                          <option value="">Select size</option>
                          {companySizes.map((sz) => (<option key={sz} value={sz}>{sz} employees</option>))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label htmlFor="website" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">Website</label>
                      <input id="website" type="url" value={website} onChange={(e) => setWebsite(e.target.value)} className="input" placeholder="https://example.com" disabled={isLoading} />
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  {registrationType === "organization" && (
                    <div className="flex items-center gap-2 mb-1">
                      <UserIcon className="w-4 h-4 text-neutral-900 dark:text-neutral-100" />
                      <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider">Admin Account</span>
                    </div>
                  )}
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">Email Address</label>
                    <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="input" placeholder="you@example.com" disabled={isLoading} />
                  </div>
                  <div>
                    <label htmlFor="username" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">Username</label>
                    <input id="username" type="text" value={username} onChange={(e) => setUsername(e.target.value)} required minLength={3} maxLength={100} className="input" placeholder="Choose a username" disabled={isLoading} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="password" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">Password</label>
                      <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} maxLength={72} className="input" placeholder="6+ characters" disabled={isLoading} />
                    </div>
                    <div>
                      <label htmlFor="confirmPassword" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">Confirm Password</label>
                      <input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required maxLength={72} className="input" placeholder="Re-enter password" disabled={isLoading} />
                    </div>
                  </div>
                </div>

                <button type="submit" disabled={isLoading} className="w-full btn-primary py-3">
                  {isLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Creating {registrationType === "organization" ? "Organization..." : "Account..."}
                    </>
                  ) : (
                    <>
                      {registrationType === "organization" ? "Create Organization" : "Create Account"}
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
                  Already have an account?{" "}
                  <Link href="/login" className="text-neutral-700 dark:text-neutral-300 font-medium hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors">
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
