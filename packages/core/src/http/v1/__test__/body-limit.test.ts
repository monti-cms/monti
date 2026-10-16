import { describe, expect, it } from "vitest";
import { testConfig } from "../../../../test/site";
import { fakeCms } from "../../../cms/fake-cms";
import { MAX_FORM_BYTES, MAX_REQUEST_BYTES } from "../../../core/limits";
import { readBodyText, readFormBody, readJsonBody, runRoute } from "../handler";
import { POST as signIn } from "../session/sign-in/[provider]/route";

const post = (body: BodyInit | null, headers: Record<string, string> = {}, init: RequestInit = {}) =>
	new Request("http://cms.local/api/monti/v1/x", { method: "POST", headers, body, ...init });

/** A body streamed in chunks, so the request carries no `Content-Length`. */
const streamed = (chunks: number, size: number, headers: Record<string, string> = {}) => {
	let sent = 0;
	const body = new ReadableStream<Uint8Array>({
		pull(controller) {
			if (sent++ >= chunks) return controller.close();
			controller.enqueue(new Uint8Array(size).fill(97));
		},
	});
	return post(body, headers, { duplex: "half" } as RequestInit);
};

describe("request body reader", () => {
	it("rejects a declared Content-Length over the cap with 413 before reading", async () => {
		const request = post("x", { "content-length": "100" });
		await expect(readBodyText(request, 10)).rejects.toMatchObject({ code: "payload_too_large" });
		expect(request.bodyUsed).toBe(false);
	});

	it("aborts a streamed body without Content-Length once it passes the cap", async () => {
		const request = streamed(10, 100);
		expect(request.headers.get("content-length")).toBeNull();
		await expect(readBodyText(request, 250)).rejects.toMatchObject({ code: "payload_too_large" });
	});

	it("reads a body under the cap", async () => {
		expect(await readBodyText(post("hello"), 10)).toBe("hello");
		expect(await readJsonBody(post(JSON.stringify({ a: 1 })))).toEqual({ a: 1 });
		expect(await readJsonBody(post(null))).toEqual({});
	});

	it("keeps JSON errors at 400", async () => {
		await expect(readJsonBody(post("{"))).rejects.toMatchObject({ code: "invalid_input" });
	});

	it("parses a urlencoded form under the cap and refuses one over it", async () => {
		const headers = { "content-type": "application/x-www-form-urlencoded" };
		const form = await readFormBody(post("email=a%40b.c&password=pw", headers));
		expect(form.get("email")).toBe("a@b.c");
		await expect(readFormBody(post("a=".padEnd(MAX_FORM_BYTES + 10, "x"), headers))).rejects.toMatchObject({
			code: "payload_too_large",
		});
	});

	it("keeps the global cap above the form cap", () => {
		expect(MAX_REQUEST_BYTES).toBeGreaterThan(MAX_FORM_BYTES);
	});
});

describe("public form route", () => {
	it("refuses an oversized sign-in post with 413", async () => {
		const cms = fakeCms({
			config: testConfig,
			auth: { providers: [{ id: "credentials", name: "Email", credentials: true }] as never },
		});
		const body = `email=a&password=${"x".repeat(MAX_FORM_BYTES + 1)}`;
		const request = new Request("http://cms.local/api/monti/v1/session/sign-in/credentials", {
			method: "POST",
			headers: { origin: "http://cms.local", "content-type": "application/x-www-form-urlencoded" },
			body,
		});
		const response = await runRoute(cms, request, { provider: "credentials" }, signIn, "same-origin-form");
		expect(response.status).toBe(413);
	});
});
