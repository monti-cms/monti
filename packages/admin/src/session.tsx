import { createContext, type ReactNode, useContext, useEffect, useState } from "react";
import { devTicket } from "./operations/dev-ticket";
import { useOperation, useRead } from "./operations/use-operation";

/** `auth.state`: the ways to sign in, whether there is an admin, who is signed in (doc 15). */
export type AuthState = {
	/** A password, and sign-ins at another site (GitHub) with the admin API path that starts each. */
	methods: { password: boolean; external: { id: string; label: string; path: string }[] };
	hasAdmin: boolean;
	/** `bypass`: nobody signed in; the dev server let this machine in (doc 16). */
	session: { who: string; bypass?: boolean } | null;
	/** On the dev server, with nobody signed in: where a browser of this machine gets the ticket that lets it in (`auth.devSignIn`). */
	devProof?: string;
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
	const { data, reload } = useRead<AuthState>("auth.state");
	const { run: letIn } = useOperation("auth.devSignIn");
	const proof = data && !data.session ? data.devProof : undefined;
	/** The address tried: once for each, so a refused ticket does not ask again and again. */
	const [tried, setTried] = useState<string | null>(null);
	useEffect(() => {
		if (!proof || tried === proof) return;
		let left = false;
		void (async () => {
			const ticket = await devTicket(proof);
			if (ticket && (await letIn({ ticket })).ok) await reload();
			if (!left) setTried(proof);
		})();
		return () => {
			left = true;
		};
	}, [proof, tried, letIn, reload]);
	// Once in, the try is forgotten: a session that ends later (30 days, the server's sessions emptied) is asked for again without a reload.
	const signedIn = Boolean(data?.session);
	useEffect(() => {
		if (signedIn) setTried(null);
	}, [signedIn]);
	const proving = proof !== undefined && tried !== proof;
	return <SessionContext.Provider value={{ state: proving ? null : data, reload }}>{children}</SessionContext.Provider>;
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
