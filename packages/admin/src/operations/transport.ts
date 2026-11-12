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

/**
 * What stands for an answer that never came (the network is down, the server did not answer), as the byte route does: status 0. It carries its
 * own words, so every place that shows a refusal's reason says this one whole. A transport answers with it and does not throw: whoever calls
 * (a screen's read, the assistant's panel between two requests of a run) is told like any refusal and is never left waiting on nothing.
 */
export const NO_ANSWER: Answer = { status: 0, body: { error: "network", reason: { key: "errors.noAnswer" } } };

/** The admin API over HTTP, at `base` (`/admin/api`). The session cookie goes with every request. */
export function httpTransport(base: string): Transport {
	return async (name, input, { versions, accepted } = {}) => {
		try {
			const response = await fetch(`${base}/operations/${name}`, {
				method: "POST",
				credentials: "same-origin",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ input, versions, accepted }),
			});
			return { status: response.status, body: await response.json().catch(() => null) };
		} catch {
			return NO_ANSWER;
		}
	};
}

/** A stream's answer: its events as they come, or an answer with a status when it never began (a refusal, no session). */
export type StreamAnswer = Answer | { status: 200; events: AsyncIterable<unknown> };

/**
 * How the screens listen to something that takes a while and reports as it goes (docs 00 and 10: the assistant's run, a proposal being applied).
 * Like `Transport`, the admin uses the HTTP one and Storybook one that runs the same admin API in the browser. A stream whose connection is lost
 * ends by throwing from its `events`.
 */
export type StreamTransport = (
	name: string,
	input: unknown,
	options?: { signal?: AbortSignal },
) => Promise<StreamAnswer>;

/** The events of an answer's body: one JSON object per line, given as each line is whole. */
async function* lines(body: ReadableStream<Uint8Array>): AsyncGenerator<unknown> {
	const reader = body.getReader();
	const decoder = new TextDecoder();
	let rest = "";
	try {
		for (;;) {
			const { done, value } = await reader.read();
			rest += decoder.decode(value, { stream: !done });
			const whole = rest.split("\n");
			rest = whole.pop() ?? "";
			for (const line of whole) if (line.trim() !== "") yield JSON.parse(line);
			if (done) break;
		}
		if (rest.trim() !== "") yield JSON.parse(rest);
	} finally {
		await reader.cancel().catch(() => {});
	}
}

/** The admin API's streams over HTTP, at `base`. No answer at all (the network) is status 0, as an upload's. */
export function httpStreams(base: string): StreamTransport {
	return async (name, input, { signal } = {}) => {
		let response: Response;
		try {
			response = await fetch(`${base}/streams/${name}`, {
				method: "POST",
				credentials: "same-origin",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ input }),
				signal,
			});
		} catch {
			return NO_ANSWER;
		}
		if (response.status !== 200 || !response.body)
			return { status: response.status, body: await response.json().catch(() => null) };
		return { status: 200, events: lines(response.body) };
	};
}
