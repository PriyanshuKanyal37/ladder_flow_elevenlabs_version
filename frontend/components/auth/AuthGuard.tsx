"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getToken, removeToken } from "@/lib/auth";
import { clearCurrentUserCache, fetchCurrentUserCached } from "@/lib/currentUser";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        async function validateSession() {
            const token = getToken();
            if (!token) {
                router.push("/login");
                return;
            }

            const result = await fetchCurrentUserCached();
            if (!result.ok) {
                clearCurrentUserCache();
                removeToken();
                router.push("/login");
                return;
            }

            const profileResponse = await fetch("/api/users/profile", {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: token ? `Bearer ${token}` : "",
                },
            });

            if (!profileResponse.ok) {
                // If profile check fails unexpectedly, treat as unauthenticated session
                clearCurrentUserCache();
                removeToken();
                router.push("/login");
                return;
            }

            const profileData = (await profileResponse.json()) as { onboarding_completed?: boolean };
            if (!profileData.onboarding_completed) {
                router.push("/onboarding");
                return;
            }

            if (!cancelled) {
                setLoading(false);
            }
        }

        void validateSession();
        return () => {
            cancelled = true;
        };
    }, [router]);

    if (loading) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-app">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--accent)] border-t-transparent"></div>
            </div>
        );
    }

    return <>{children}</>;
}
