export function getToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("ladderflow_token");
}

export function setToken(token: string) {
    if (typeof window !== "undefined") {
        localStorage.setItem("ladderflow_token", token);
    }
}

export function removeToken() {
    if (typeof window !== "undefined") {
        localStorage.removeItem("ladderflow_token");
    }
}

export function authHeaders() {
    const token = getToken();
    return {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
}

