import { authHeaders, getToken } from "@/lib/auth";

export interface CurrentUser {
    id: string;
    email: string;
    full_name?: string | null;
}

export type CurrentUserResult =
    | { ok: true; user: CurrentUser }
    | { ok: false; status: number };

let inFlight: Promise<CurrentUserResult> | null = null;
let inFlightToken: string | null = null;
let cachedSuccess: { user: CurrentUser; expiresAt: number } | null = null;
let cachedToken: string | null = null;

const SUCCESS_CACHE_TTL_MS = 30_000;

export async function fetchCurrentUserCached(): Promise<CurrentUserResult> {
    const token = getToken();
    const now = Date.now();
    if (cachedSuccess && cachedToken === token && cachedSuccess.expiresAt > now) {
        return { ok: true, user: cachedSuccess.user };
    }

    if (inFlight && inFlightToken === token) {
        return inFlight;
    }

    inFlight = (async () => {
        try {
            const res = await fetch("/api/me", { headers: authHeaders() });
            if (!res.ok) {
                return { ok: false, status: res.status } as const;
            }

            const user = (await res.json()) as CurrentUser;
            cachedSuccess = {
                user,
                expiresAt: Date.now() + SUCCESS_CACHE_TTL_MS,
            };
            cachedToken = token;
            return { ok: true, user } as const;
        } catch {
            return { ok: false, status: 0 } as const;
        } finally {
            inFlight = null;
            inFlightToken = null;
        }
    })();
    inFlightToken = token;

    return inFlight;
}

export function clearCurrentUserCache() {
    inFlight = null;
    inFlightToken = null;
    cachedSuccess = null;
    cachedToken = null;
}
