/** What the admin API answered: its status and its JSON body. */
export type Answer = { status: number; body: unknown };

/**
 * How the screens reach the server: one call per operation, `{ input, versions }` in, the API's answer out. The admin uses the HTTP one; Storybook
 * hands in one that runs the same admin API in the browser on PGlite. Screens never call `fetch` (build.md rule 3): this folder is the one place.
 */
export type Transport = (name: string, input: unknown, versions?: Record<string, number>) => Promise<Answer>;

/** The admin API over HTTP, at `base` (`/admin/api`). The session cookie goes with every request. */
export function httpTransport(base: string): Transport {
	return async (name, input, versions) => {
		const response = await fetch(`${base}/operations/${name}`, {
			method: "POST",
			credentials: "same-origin",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ input, versions }),
		});
		return { status: response.status, body: await response.json().catch(() => null) };
	};
}
