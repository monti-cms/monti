import { afterEach, describe, expect, it, vi } from "vitest";
import { httpUploader } from "./transport";

/** What left the browser, in order: `fetch` for the JSON routes, a request with progress for the file's bytes. */
type Sent = { via: "fetch" | "xhr"; method: string; url: string; headers: Record<string, string>; body: unknown };

/** A browser whose two ways out are recorded and answered by `answers` (by the address's end; a status and a JSON body). */
function browser(answers: Record<string, { status: number; body?: unknown }>) {
	const sent: Sent[] = [];
	const answerOf = (url: string) => {
		const found = Object.entries(answers).find(([end]) => url.split("?")[0]?.endsWith(end));
		return found?.[1] ?? { status: 404 };
	};
	vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
		sent.push({
			via: "fetch",
			method: init.method ?? "GET",
			url,
			headers: init.headers as Record<string, string>,
			body: JSON.parse(String(init.body)),
		});
		const answer = answerOf(url);
		return new Response(JSON.stringify(answer.body ?? null), { status: answer.status });
	});
	vi.stubGlobal(
		"XMLHttpRequest",
		class {
			upload: { onprogress?: (event: { lengthComputable: boolean; loaded: number; total: number }) => void } = {};
			status = 0;
			responseText = "";
			onload?: () => void;
			private request: Sent = { via: "xhr", method: "", url: "", headers: {}, body: null };
			open(method: string, url: string) {
				this.request = { ...this.request, method, url };
			}
			setRequestHeader(name: string, value: string) {
				this.request.headers[name] = value;
			}
			send(body: Blob) {
				sent.push({ ...this.request, body });
				const answer = answerOf(this.request.url);
				this.upload.onprogress?.({ lengthComputable: true, loaded: body.size, total: body.size });
				this.status = answer.status;
				this.responseText = answer.body === undefined ? "" : JSON.stringify(answer.body);
				this.onload?.();
			}
		},
	);
	return sent;
}

afterEach(() => vi.unstubAllGlobals());

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const file = () => new Blob([PNG], { type: "image/png" });
const KEY = "3f2a1c9e-1111-4222-8333-444455556666.png";
const SIGNED = `https://bucket.example.com/media/${KEY}?X-Amz-Signature=abc`;

describe("httpUploader", () => {
	it("20-11 with a storage that takes files from the browser: a ticket, the file to the signed address as it was signed, then sealed; no byte goes through the site", async () => {
		const sent = browser({
			"/media/ticket": {
				status: 200,
				body: { direct: true, key: KEY, url: SIGNED, headers: { "content-type": "image/png" } },
			},
			[`/media/${KEY}`]: { status: 200 },
			"/media/sealed": { status: 200, body: { key: KEY, mime: "image/png", size: PNG.length } },
		});
		const progress: number[] = [];
		const answer = await httpUploader("/admin/api")(file(), {
			name: "desk.png",
			onProgress: (percent) => progress.push(percent),
		});
		expect(answer).toEqual({ status: 200, body: { key: KEY, mime: "image/png", size: PNG.length } });
		expect(sent.map((each) => `${each.via} ${each.method} ${each.url}`)).toEqual([
			"fetch POST /admin/api/media/ticket",
			`xhr PUT ${SIGNED}`,
			"fetch POST /admin/api/media/sealed",
		]);
		// The server judges the file by its own first bytes, not by what the browser calls it.
		expect(sent[0]?.body).toEqual({ name: "desk.png", size: PNG.length, head: btoa(String.fromCharCode(...PNG)) });
		expect(sent[1]?.headers).toEqual({ "content-type": "image/png" });
		expect(sent[2]?.body).toEqual({ key: KEY });
		expect(progress).toEqual([100]);
	});

	it("20-13 with a storage that does not, the file goes up the byte route, and the page does not ask again", async () => {
		const sent = browser({
			"/media/ticket": { status: 200, body: { direct: false } },
			"/media/bytes": { status: 200, body: { key: KEY, mime: "image/png", size: PNG.length } },
		});
		const upload = httpUploader("/admin/api");
		expect(await upload(file(), { name: "책상 사진.png" })).toEqual({
			status: 200,
			body: { key: KEY, mime: "image/png", size: PNG.length },
		});
		await upload(file(), { name: "b.png" });
		expect(sent.map((each) => `${each.via} ${each.method} ${each.url}`)).toEqual([
			"fetch POST /admin/api/media/ticket",
			`xhr PUT /admin/api/media/bytes?name=${encodeURIComponent("책상 사진.png")}`,
			"xhr PUT /admin/api/media/bytes?name=b.png",
		]);
	});

	it("20-12 a refused ticket is the answer, and nothing is sent; a storage that refuses the file is a failed upload, and nothing is sealed", async () => {
		const refused = browser({
			"/media/ticket": { status: 415, body: { error: "media-refused", reason: { key: "media.badType" } } },
		});
		expect((await httpUploader("/admin/api")(file(), { name: "a.png" })).status).toBe(415);
		expect(refused).toHaveLength(1);
		vi.unstubAllGlobals();

		const blocked = browser({
			"/media/ticket": { status: 200, body: { direct: true, key: KEY, url: SIGNED, headers: {} } },
			[`/media/${KEY}`]: { status: 403 },
		});
		expect(await httpUploader("/admin/api")(file(), { name: "a.png" })).toEqual({ status: 0, body: null });
		expect(blocked.map((each) => each.via)).toEqual(["fetch", "xhr"]);
	});
});
