import { useAuth } from "@/contexts/AuthContext";

/**
 * Hook to determine if the current user has read-only (viewer) access.
 * Returns `true` when the user's app-level role is "viewer".
 *
 * Usage:
 *   const readOnly = useViewerMode();
 *   <button disabled={readOnly}>Save</button>
 */
export function useViewerMode(): boolean {
  const { user } = useAuth();
  return user?.role === "viewer";
}
