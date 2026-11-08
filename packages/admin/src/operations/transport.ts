/** What the admin API answered: its status and its JSON body. */
export type Answer = { status: number; body: unknown };

/**
 * How the screens reach the server: one call per operation, `{ input, versions }` in, the API's answer out. The admin uses the HTTP one; Storybook
 * hands in one that runs the same admin API in the browser on PGlite. Screens never call `fetch` (build.md rule 3): this folder is the one place.
 */
export type Transport = (name: string, input: unknown, options?: CallOptions) => Promise<Answer>;

/** What a call carries besides its input: the versions the screen read, and the proposal items it took into its draft (doc 05). */
export type CallOptions = { versions?: Record<string, number>; accepted?: string[] };

/**
 * How a file's bytes reach the server (doc 09, the way up): the one thing that is not an operation, because a file's bar needs to know how far it is, and an operation
 * is JSON. It answers like a call: `{ key, mime, size }` with 200, a refusal otherwise.
 */
export type Uploader = (
	file: Blob,
	options: { name: string; onProgress?: (percent: number) => void; signal?: AbortSignal },
) => Promise<Answer>;

/** The byte route over HTTP. A request, because `fetch` cannot say how much of a body has gone. */
export function httpUploader(base: string): Uploader {
	return (file, { name, onProgress, signal }) =>
		new Promise((resolve) => {
			const request = new XMLHttpRequest();
			request.open("PUT", `${base}/media/bytes?name=${encodeURIComponent(name)}`);
			request.upload.onprogress = (event) => {
				if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100));
			};
			const answer = (status: number) => {
				try {
					resolve({ status, body: JSON.parse(request.responseText) });
				} catch {
					resolve({ status, body: null });
				}
			};
			request.onload = () => answer(request.status);
			// No answer at all: the network. The caller shows it like any refusal, and the file stays to try again.
			request.onerror = () => answer(0);
			request.onabort = () => answer(0);
			signal?.addEventListener("abort", () => request.abort());
			request.send(file);
		});
}

/** The admin API over HTTP, at `base` (`/admin/api`). The session cookie goes with every request. */
export function httpTransport(base: string): Transport {
	return async (name, input, { versions, accepted } = {}) => {
		const response = await fetch(`${base}/operations/${name}`, {
			method: "POST",
			credentials: "same-origin",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ input, versions, accepted }),
		});
		return { status: response.status, body: await response.json().catch(() => null) };
	};
}
