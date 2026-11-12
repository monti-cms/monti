import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { type Face, useAdmin } from "./operations/admin-context";
import { useRead } from "./operations/use-operation";

/** `auth.state`: the ways to sign in, whether there is an admin, who is signed in (doc 15), and what the admin draws with (doc 12). */
export type AuthState = {
	/** A password, and sign-ins at another site (GitHub) with the admin API path that starts each. */
	methods: { password: boolean; external: { id: string; label: string; path: string }[] };
	hasAdmin: boolean;
	session: { who: string } | null;
	/** The site's name and the admin's language as the settings hold them, and whether body templates are offered. */
	site: Face;
};

type Session = { state: AuthState | null; reload: () => Promise<void> };

const SessionContext = createContext<Session | null>(null);

/** Reads the session once for the whole admin, so any screen can send the person back to the login screen (doc 15). */
export function SessionProvider({ children }: { children: ReactNode }) {
	const { setFace } = useAdmin();
	const { data, reload } = useRead<AuthState>("auth.state");
	// The screens get the answer in the same step as the name and the language it carries: nothing is drawn in another language first.
	const [state, setState] = useState<AuthState | null>(null);
	useEffect(() => {
		if (!data) return;
		setFace(data.site);
		setState(data);
	}, [data, setFace]);
	const value = useMemo(() => ({ state, reload }), [state, reload]);
	return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

/**
 * The session: who is signed in, and `reload` after signing in or out, or after a save that changes the site's name, the admin's language or a
 * feature switch. A screen whose call was refused for want of a session reloads it: the admin then shows the login screen, and the screen's unsaved
 * input waits in the browser (doc 02).
 */
export function useSession(): Session {
	const session = useContext(SessionContext);
	if (!session) throw new Error("useSession needs a SessionProvider");
	return session;
}
