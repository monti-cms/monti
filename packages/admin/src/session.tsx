import { createContext, type ReactNode, useContext } from "react";
import { useRead } from "./operations/use-operation";

/** `auth.state`: the ways to sign in, whether there is an admin, who is signed in (doc 15). */
export type AuthState = {
	/** A password, and sign-ins at another site (GitHub) with the admin API path that starts each. */
	methods: { password: boolean; external: { id: string; label: string; path: string }[] };
	hasAdmin: boolean;
	session: { who: string } | null;
};

type Session = { state: AuthState | null; reload: () => Promise<void> };

const SessionContext = createContext<Session | null>(null);

/** Reads the session once for the whole admin, so any screen can send the person back to the login screen (doc 15). */
export function SessionProvider({ children }: { children: ReactNode }) {
	const { data, reload } = useRead<AuthState>("auth.state");
	return <SessionContext.Provider value={{ state: data, reload }}>{children}</SessionContext.Provider>;
}

/**
 * The session: who is signed in, and `reload` after signing in or out. A screen whose call was refused for want of a session reloads it: the admin then
 * shows the login screen, and the screen's unsaved input waits in the browser (doc 02).
 */
export function useSession(): Session {
	const session = useContext(SessionContext);
	if (!session) throw new Error("useSession needs a SessionProvider");
	return session;
}
