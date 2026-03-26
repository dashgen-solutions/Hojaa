"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";

interface Organization {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  industry: string | null;
  size: string | null;
  website: string | null;
  is_active: boolean;
  created_at: string;
}

interface User {
  id: string;
  email: string;
  username: string;
  is_active: boolean;
  role: string; // owner | admin | editor | viewer
  organization_id: string | null;
  org_role: string | null; // owner | admin | member
  job_title: string | null;
  /** Slack-style status (also returned from /api/messaging/status) */
  custom_status?: string | null;
  status_emoji?: string | null;
  /** Path e.g. /uploads/avatars/... — prefix with API_URL for <img src> */
  avatar_url?: string | null;
  created_at: string;
  organization?: Organization | null;
  has_own_api_key?: boolean;
  ai_usage_usd?: number;
  ai_usage_limit_usd?: number;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isOrgAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string, orgData?: {
    organization_name: string;
    industry?: string;
    company_size?: string;
    website?: string;
    openai_api_key?: string;
  }) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // Load token from localStorage on mount
  useEffect(() => {
    const loadAuth = async () => {
      try {
        const storedToken = localStorage.getItem("auth_token");
        if (storedToken) {
          setToken(storedToken);
          // Fetch user info
          const response = await axios.get(`${API_URL}/api/auth/me`, {
            headers: { Authorization: `Bearer ${storedToken}` },
          });
          setUser(response.data);
        }
      } catch (error) {
        console.error("Failed to load user:", error);
        // Clear invalid token
        localStorage.removeItem("auth_token");
        setToken(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadAuth();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      // Login and get token
      const loginResponse = await axios.post(`${API_URL}/api/auth/login`, {
        email,
        password,
      });

      const newToken = loginResponse.data.access_token;
      setToken(newToken);
      localStorage.setItem("auth_token", newToken);

      // Fetch user info
      const userResponse = await axios.get(`${API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${newToken}` },
      });

      setUser(userResponse.data);
    } catch (error: any) {
      console.error("Login failed:", error);
      throw new Error(
        error.response?.data?.detail || "Login failed. Please try again."
      );
    }
  };

  const register = async (email: string, username: string, password: string, orgData?: {
    organization_name: string;
    industry?: string;
    company_size?: string;
    website?: string;
    openai_api_key?: string;
  }) => {
    try {
      await axios.post(`${API_URL}/api/auth/register`, {
        email,
        username,
        password,
        ...(orgData || {}),
      });

      // Auto-login after registration
      await login(email, password);
    } catch (error: any) {
      console.error("Registration failed:", error);
      throw new Error(
        error.response?.data?.detail || "Registration failed. Please try again."
      );
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("auth_token");
    router.push("/login");
  };

  const refreshUser = async () => {
    if (!token) return;

    try {
      const response = await axios.get(`${API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUser(response.data);
    } catch (error) {
      console.error("Failed to refresh user:", error);
      logout();
    }
  };

  const isOrgAdmin = !!(user && (user.org_role === "owner" || user.org_role === "admin"));

  const value = {
    user,
    token,
    isLoading,
    isAuthenticated: !!user,
    isOrgAdmin,
    login,
    register,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
