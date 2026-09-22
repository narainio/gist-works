import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Author } from "@shared/schema";

export function useAuth() {
  const { data: author, isLoading, error } = useQuery<Author | null>({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (res.status === 401) return null;
      if (!res.ok) throw new Error("Failed to fetch auth");
      return res.json();
    },
    retry: false,
    staleTime: 1000 * 60 * 5,
  });

  const requestOtp = useMutation({
    mutationFn: async (email: string) => {
      const res = await apiRequest("POST", "/api/auth/request-otp", { email });
      return res.json();
    },
  });

  const verifyOtp = useMutation({
    mutationFn: async ({ email, code }: { email: string; code: string }) => {
      const res = await apiRequest("POST", "/api/auth/verify-otp", { email, code });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
  });

  const logout = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/auth/logout");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
  });

  return {
    author,
    isLoading,
    isAuthenticated: !!author,
    requestOtp,
    verifyOtp,
    logout,
  };
}
