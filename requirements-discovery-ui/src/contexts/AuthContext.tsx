"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";

interface User {
  id: string;
  email: string;
  username: string;
  is_active: boolean;
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string) => Promise<void>;
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

  const register = async (email: string, username: string, password: string) => {
    try {
      // Register user
      await axios.post(`${API_URL}/api/auth/register`, {
        email,
        username,
        password,
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

  const value = {
    user,
    token,
    isLoading,
    isAuthenticated: !!user,
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
