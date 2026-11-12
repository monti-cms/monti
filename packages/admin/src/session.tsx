import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { type Face, useAdmin } from "./operations/admin-context";
import { devTicket } from "./operations/dev-ticket";
import { useOperation, useRead } from "./operations/use-operation";

/** `auth.state`: the ways to sign in, whether there is an admin, who is signed in (doc 15), and what the admin draws with (doc 12). */
export type AuthState = {
	/** A password, and sign-ins at another site (GitHub) with the admin API path that starts each. */
	methods: { password: boolean; external: { id: string; label: string; path: string }[] };
	hasAdmin: boolean;
	/** `bypass`: nobody signed in; the dev server let this machine in (doc 16). */
	session: { who: string; bypass?: boolean } | null;
	/** On the dev server, with nobody signed in: where a browser of this machine gets the ticket that lets it in (`auth.devSignIn`). */
	devProof?: string;
	/** The site's name and the admin's language as the settings hold them, and whether body templates are offered. */
	site: Face;
};

type Session = { state: AuthState | null; reload: () => Promise<void> };

const SessionContext = createContext<Session | null>(null);

/**
 * Reads the session once for the whole admin, so any screen can send the person back to the login screen (doc 15).
 *
 * On the dev server `auth.state` may name where a browser of this machine gets a ticket (`devProof`, doc 16). The admin then tries once to be let
 * in with it, and shows nothing meanwhile: the login screen comes only when that did not work.
 */
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
	const { run: letIn } = useOperation("auth.devSignIn");
	const proof = state && !state.session ? state.devProof : undefined;
	/** The address tried: once for each, so a refused ticket does not ask again and again. */
	const [tried, setTried] = useState<string | null>(null);
	useEffect(() => {
		if (!proof || tried === proof) return;
		let left = false;
		void (async () => {
			try {
				const ticket = await devTicket(proof);
				if (ticket && (await letIn({ ticket })).ok) await reload();
			} catch {
				// The call did not come back (the connection dropped on the way): not let in. The sign-in screen is the way in.
			} finally {
				// Settled whatever happened: an admin that goes on waiting for a try that never ends shows nothing at all.
				if (!left) setTried(proof);
			}
		})();
		return () => {
			left = true;
		};
	}, [proof, tried, letIn, reload]);
	// Once in, the try is forgotten: a session that ends later (30 days, the server's sessions emptied) is asked for again without a reload.
	const signedIn = Boolean(state?.session);
	useEffect(() => {
		if (signedIn) setTried(null);
	}, [signedIn]);
	const proving = proof !== undefined && tried !== proof;
	const value = useMemo(() => ({ state: proving ? null : state, reload }), [state, proving, reload]);
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
