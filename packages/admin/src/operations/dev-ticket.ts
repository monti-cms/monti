/**
 * The ticket that proves this browser runs on the dev server's own machine (doc 16): fetched from the loopback address `auth.state` names, which
 * only a program on that machine reaches, and handed in with `auth.devSignIn`. It is not a call to the server's operations, so it is here, with
 * the transport, and not in a screen. `null` when there is none to get (another machine, a container, the listener gone): the admin then asks to
 * sign in.
 */
export async function devTicket(url: string): Promise<string | null> {
	try {
		const answer = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(3000) });
		if (!answer.ok) return null;
		const { ticket } = (await answer.json()) as { ticket?: unknown };
		return typeof ticket === "string" && ticket !== "" ? ticket : null;
	} catch {
		return null;
	}
}
