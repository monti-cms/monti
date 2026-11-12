import { HEAD_BYTES } from "@monti-cms/core";

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

/** One request whose progress can be read: `fetch` cannot say how much of a body has gone. */
function send(
	url: string,
	file: Blob,
	options: { headers?: Record<string, string>; onProgress?: (percent: number) => void; signal?: AbortSignal },
): Promise<Answer> {
	return new Promise((resolve) => {
		const request = new XMLHttpRequest();
		request.open("PUT", url);
		for (const [name, value] of Object.entries(options.headers ?? {})) request.setRequestHeader(name, value);
		request.upload.onprogress = (event) => {
			if (event.lengthComputable) options.onProgress?.(Math.round((event.loaded / event.total) * 100));
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
		options.signal?.addEventListener("abort", () => request.abort());
		request.send(file);
	});
}

/**
 * How a file goes up over HTTP (doc 09, and doc 20's direct way). It asks the server for a ticket first, with the file's name, size and
 * first bytes:
 * - a storage that takes files straight from the browser answers with a signed address: the file is sent there, never through the site (a
 *   host may take smaller requests than the library's largest file), and the server is then told, and looks at what the storage holds;
 * - any other storage answers that it does not, and the file goes to the byte route, as before. That answer holds for this page: a site's
 *   storage does not change under it.
 * Either way the answer is the byte route's: `{ key, mime, size }`, or a refusal.
 */
export function httpUploader(base: string): Uploader {
	let direct: boolean | undefined;
	const post = (route: string, body: unknown, signal?: AbortSignal): Promise<Answer> =>
		fetch(`${base}/media/${route}`, {
			method: "POST",
			credentials: "same-origin",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(body),
			signal,
		})
			.then(async (response) => ({ status: response.status, body: await response.json().catch(() => null) }))
			.catch(() => ({ status: 0, body: null }));
	const throughSite = (file: Blob, name: string, onProgress?: (percent: number) => void, signal?: AbortSignal) =>
		send(`${base}/media/bytes?name=${encodeURIComponent(name)}`, file, { onProgress, signal });

	return async (file, { name, onProgress, signal }) => {
		if (direct === false) return throughSite(file, name, onProgress, signal);
		const head = new Uint8Array(await file.slice(0, HEAD_BYTES).arrayBuffer());
		const asked = await post("ticket", { name, size: file.size, head: btoa(String.fromCharCode(...head)) }, signal);
		if (asked.status !== 200) return asked;
		const ticket = asked.body as { direct?: boolean; key?: string; url?: string; headers?: Record<string, string> };
		direct = ticket.direct === true;
		if (!direct || !ticket.url || !ticket.key) return throughSite(file, name, onProgress, signal);
		// Nothing is added to the address or the headers: they are what the storage signed.
		const put = await send(ticket.url, file, { headers: ticket.headers, onProgress, signal });
		// The storage's own refusal says nothing a screen can show: it is a failed upload, and the file stays to try again.
		if (put.status < 200 || put.status >= 300) return { status: 0, body: null };
		return post("sealed", { key: ticket.key }, signal);
	};
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
