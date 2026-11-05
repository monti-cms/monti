import { useRead } from "./operations/use-operation";

/** `auth.state`: the ways to sign in, whether there is an admin, who is signed in (doc 15). */
export type AuthState = {
	methods: { password: boolean; github: boolean };
	hasAdmin: boolean;
	session: { who: string } | null;
};

/** The session: who is signed in, and `reload` after signing in or out. */
export function useSession() {
	const { data, reload } = useRead<AuthState>("auth.state");
	return { state: data, reload };
}
