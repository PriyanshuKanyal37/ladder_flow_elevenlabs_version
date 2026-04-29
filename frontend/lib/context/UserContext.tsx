'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { fetchCurrentUserCached } from '@/lib/currentUser';

interface User {
    id: string;
    email: string;
    full_name?: string | null;
}

interface UserContextValue {
    user: User | null;
    loading: boolean;
}

const UserContext = createContext<UserContextValue>({ user: null, loading: true });

export function UserProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Fetch user profile ONCE when the dashboard layout mounts.
        // All child components (Sidebar, etc.) read from this context â€”
        // no repeated DB calls, no re-fetches during voice interview.
        let cancelled = false;
        async function fetchUser() {
            const result = await fetchCurrentUserCached();
            if (!cancelled) {
                if (result.ok) {
                    setUser(result.user);
                } else {
                    // silently fail â€” user stays null
                    setUser(null);
                }
                setLoading(false);
            }
        }
        fetchUser();
        return () => { cancelled = true; };
    }, []); // empty deps â€” runs exactly once

    return (
        <UserContext.Provider value={{ user, loading }}>
            {children}
        </UserContext.Provider>
    );
}

export function useUser() {
    return useContext(UserContext);
}

