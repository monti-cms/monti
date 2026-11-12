import { createServer, type IncomingHttpHeaders, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import { aiServices, CHECK_MS, checkKey, type KeyService, MOST_ANSWER_BYTES } from "./services";

const service = (id: string) => aiServices.find((each) => each.id === id) as KeyService;

const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const KEY = "sk-test-key-for-services-9a9a";

describe("a redirect is not followed (review 4)", () => {
	const servers: Server[] = [];
	const listen = (handle: Parameters<typeof createServer>[1]) =>
		new Promise<string>((resolve) => {
			const server = createServer(handle);
			servers.push(server);
			server.listen(0, "127.0.0.1", () => resolve(`http://127.0.0.1:${(server.address() as AddressInfo).port}`));
		});
	afterEach(async () => {
		await Promise.all(servers.splice(0).map((server) => new Promise((done) => server.close(done))));
	});

	it.each([
		301, 302, 307, 308,
	])("14-4 a server that answers %i sends the check nowhere else: the other origin gets no request and no key", async (status) => {
		const reached: IncomingHttpHeaders[] = [];
		// The place a redirect would lead: another origin, or a machine inside the server's own network.
		const inside = await listen((request, response) => {
			reached.push(request.headers);
			response.setHeader("content-type", "application/json");
			response.end(JSON.stringify({ data: [{ id: "internal-model" }] }));
		});
		const outside = await listen((_request, response) => {
			response.statusCode = status;
			response.setHeader("location", `${inside}/v1/models`);
			response.end();
		});

		const checked = await checkKey(
			service("openai-compatible"),
			{ secret: KEY, baseUrl: `${outside}/v1` },
			globalThis.fetch,
		);
		expect(checked).toEqual({ ok: false, reason: "unreachable" });
		expect(reached).toEqual([]);
	});

	it("14-4 every built-in service asks with redirects refused, whatever header carries its key", async () => {
		for (const each of aiServices) {
			const asked: RequestInit[] = [];
			await checkKey(each, { secret: KEY, baseUrl: "http://server.test/v1" }, async (_url, init) => {
				asked.push(init ?? {});
				return json({ data: [], models: [] });
			});
			expect(asked.length).toBeGreaterThan(0);
			for (const init of asked) expect(init.redirect).toBe("error");
		}
	});
});

describe("how much of an answer is read (review 9)", () => {
	/** A body of `megabytes` that counts what is pulled from it. */
	function heavy(megabytes: number, status = 200) {
		const chunk = new TextEncoder().encode(" ".repeat(1024 * 1024));
		const pulled = { bytes: 0 };
		let sent = 0;
		const body = new ReadableStream<Uint8Array>(
			{
				pull(controller) {
					if (sent === megabytes) return controller.close();
					sent += 1;
					pulled.bytes += chunk.length;
					controller.enqueue(chunk);
				},
			},
			{ highWaterMark: 0 },
		);
		return { response: new Response(body, { status }), pulled };
	}

	it("an answer over the limit is not read to its end, and counts as no answer", async () => {
		const { response, pulled } = heavy(16);
		const checked = await checkKey(service("anthropic"), { secret: KEY, baseUrl: null }, async () => response);
		expect(checked).toEqual({ ok: false, reason: "unreachable" });
		expect(pulled.bytes).toBeLessThanOrEqual(MOST_ANSWER_BYTES + 1024 * 1024);
	});

	it("the body of an answer that is not a success is not read at all", async () => {
		const { response, pulled } = heavy(16, 401);
		const checked = await checkKey(service("anthropic"), { secret: KEY, baseUrl: null }, async () => response);
		expect(checked).toEqual({ ok: false, reason: "refused" });
		expect(pulled.bytes).toBeLessThanOrEqual(1024 * 1024);
	});

	it("a long list under the limit is read whole", async () => {
		const data = Array.from({ length: 20_000 }, (_unused, index) => ({ id: `model-${index}-${"x".repeat(60)}` }));
		const checked = await checkKey(
			service("openai-compatible"),
			{ secret: KEY, baseUrl: "http://s.test/v1" },
			async () => json({ data }),
		);
		expect(checked.ok && checked.models.length).toBe(20_000);
	});
});

describe("one deadline for a whole check (review 10)", () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	/** A fetch that answers after `wait` ms, and ends at once when its signal does. */
	const slow =
		(wait: number, answer: (url: string) => Response): typeof globalThis.fetch =>
		(input, init) =>
			new Promise((resolve, reject) => {
				const timer = setTimeout(() => resolve(answer(String(input))), wait);
				init?.signal?.addEventListener("abort", () => {
					clearTimeout(timer);
					reject(new DOMException("aborted", "AbortError"));
				});
			});

	it("OpenRouter's two requests share the ten seconds: six and six is too long", async () => {
		vi.useFakeTimers();
		const urls: string[] = [];
		const checking = checkKey(
			service("openrouter"),
			{ secret: KEY, baseUrl: null },
			slow(6000, (url) => {
				urls.push(url);
				return url.endsWith("/key") ? json({ data: { label: "key" } }) : json({ data: [] });
			}),
		);
		let checked: unknown = "still asking";
		void checking.then((result) => {
			checked = result;
		});
		await vi.advanceTimersByTimeAsync(CHECK_MS - 1);
		expect(checked).toBe("still asking");
		await vi.advanceTimersByTimeAsync(1);
		expect(checked).toEqual({ ok: false, reason: "unreachable" });
		// The second request was ended at the deadline and never answered.
		expect(urls).toEqual(["https://openrouter.ai/api/v1/key"]);
	});

	it("two requests that fit the ten seconds together are an answer", async () => {
		vi.useFakeTimers();
		const checking = checkKey(
			service("openrouter"),
			{ secret: KEY, baseUrl: null },
			slow(4000, (url) =>
				url.endsWith("/key")
					? json({ data: { label: "key" } })
					: json({ data: [{ id: "anthropic/claude-sonnet-5.5", supported_parameters: ["tools", "reasoning"] }] }),
			),
		);
		await vi.advanceTimersByTimeAsync(8000);
		expect(await checking).toEqual({
			ok: true,
			models: [{ id: "anthropic/claude-sonnet-5.5", thinking: true, images: false }],
		});
	});

	it("a plugin's check that never answers and ignores the signal is still ended at the deadline", async () => {
		vi.useFakeTimers();
		const stuck: KeyService = { id: "stuck", name: "Stuck", check: () => new Promise(() => {}) };
		const checking = checkKey(stuck, { secret: KEY, baseUrl: null }, globalThis.fetch);
		await vi.advanceTimersByTimeAsync(CHECK_MS);
		expect(await checking).toEqual({ ok: false, reason: "unreachable" });
	});
});

describe("what a check hands on", () => {
	it.each([
		["nothing", null],
		["undefined", undefined],
		["a word", "ok"],
		["a number", 5],
		["a list", []],
		["an object that says neither yes nor no", { ok: "yes", models: [] }],
		["a yes without its models", { ok: true }],
	])("a plugin's check that answers %s is no answer, not a crash (review I)", async (_what, answer) => {
		const odd: KeyService = { id: "odd", name: "Odd", check: (async () => answer) as never };
		expect(await checkKey(odd, { secret: KEY, baseUrl: null }, globalThis.fetch)).toEqual({
			ok: false,
			reason: "unreachable",
		});
	});

	it("a plugin's refusal is passed on as a refusal, and a reason it made up is no answer", async () => {
		const refuses: KeyService = { id: "r", name: "R", check: async () => ({ ok: false, reason: "refused" }) };
		expect(await checkKey(refuses, { secret: KEY, baseUrl: null }, globalThis.fetch)).toEqual({
			ok: false,
			reason: "refused",
		});
		const invents: KeyService = { id: "i", name: "I", check: (async () => ({ ok: false, reason: "busy" })) as never };
		expect(await checkKey(invents, { secret: KEY, baseUrl: null }, globalThis.fetch)).toEqual({
			ok: false,
			reason: "unreachable",
		});
	});

	it("a plugin's check that throws before it returns anything is no answer either", async () => {
		const thrower: KeyService = {
			id: "thrower",
			name: "Thrower",
			check: () => {
				throw new Error("boom, before any promise");
			},
		};
		expect(await checkKey(thrower, { secret: KEY, baseUrl: null }, globalThis.fetch)).toEqual({
			ok: false,
			reason: "unreachable",
		});
	});

	it("a plugin's check that throws is no answer, not a crash", async () => {
		const broken: KeyService = {
			id: "broken",
			name: "Broken",
			check: async () => {
				throw new Error("boom");
			},
		};
		expect(await checkKey(broken, { secret: KEY, baseUrl: null }, globalThis.fetch)).toEqual({
			ok: false,
			reason: "unreachable",
		});
	});

	it("14-4 a plugin's models are kept by their four known parts, and one that carries the key refuses the whole answer", async () => {
		const loose: KeyService = {
			id: "loose",
			name: "Loose",
			check: async ({ secret }) => ({
				ok: true,
				models: [
					{ id: "b-model", thinking: false, images: true, echoed: secret } as never,
					{ id: "a-model", thinking: true, images: false },
				],
			}),
		};
		expect(await checkKey(loose, { secret: KEY, baseUrl: null }, globalThis.fetch)).toEqual({
			ok: true,
			models: [
				{ id: "a-model", thinking: true, images: false },
				{ id: "b-model", thinking: false, images: true },
			],
		});
		const echo: KeyService = {
			id: "echo",
			name: "Echo",
			check: async ({ secret }) => ({
				ok: true,
				models: [{ id: "m", label: `for ${secret}`, thinking: false, images: false }],
			}),
		};
		expect(await checkKey(echo, { secret: KEY, baseUrl: null }, globalThis.fetch)).toEqual({
			ok: false,
			reason: "unreachable",
		});
		const shapeless: KeyService = {
			id: "shapeless",
			name: "Shapeless",
			check: async () => ({ ok: true, models: [{ id: 7 }] as never }),
		};
		expect(await checkKey(shapeless, { secret: KEY, baseUrl: null }, globalThis.fetch)).toEqual({
			ok: false,
			reason: "unreachable",
		});
	});
});

describe("OpenAI's models, told by their names (review 11)", () => {
	it("GPT from 5 on and the o families think; older GPT does not; what is not a chat model is not listed", async () => {
		const checked = await checkKey(service("openai"), { secret: KEY, baseUrl: null }, async () =>
			json({
				data: [
					{ id: "gpt-6-astra" },
					{ id: "gpt-6.1-sol" },
					{ id: "gpt-10" },
					{ id: "gpt-5.5" },
					{ id: "gpt-4.1" },
					{ id: "gpt-4o" },
					{ id: "o5-mini" },
					{ id: "text-embedding-3-large" },
					{ id: "gpt-image-2" },
				],
			}),
		);
		expect(checked.ok && Object.fromEntries(checked.models.map((model) => [model.id, model.thinking]))).toEqual({
			"gpt-10": true,
			"gpt-4.1": false,
			"gpt-4o": false,
			"gpt-5.5": true,
			"gpt-6-astra": true,
			"gpt-6.1-sol": true,
			"o5-mini": true,
		});
	});
});
