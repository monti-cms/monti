import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { signedInApi } from "../__test__/admin";
import { sql, testDatabase } from "../__test__/database";
import type { Database } from "../db/schema";
import { runCli } from "../entry/cli";
import { agentTools, callAgentTool } from "../entry/tools";
import { CheckError, ForbiddenError, UnknownOperationError } from "../errors";
import { createMonti, definePlugin, type MontiOptions } from "../monti";
import { type KeyList, MODELS_RETRY_MS, type ModelList } from "./operations";
import type { KeyService } from "./services";

const db = await testDatabase();

const SECRET = "keys-test-secret";
const ANTHROPIC = "sk-ant-api03-first-key-a1b2";
const ANTHROPIC_NEW = "sk-ant-api03-second-key-7c0e";
const OPENAI = "sk-proj-company-key-77de";

/** The services as the tests' network: which keys each takes, what it lists, and every request that reached it. */
function network() {
	const state = {
		taken: new Set([ANTHROPIC, ANTHROPIC_NEW, OPENAI]),
		down: false,
		requests: [] as { url: string; headers: Record<string, string>; redirect: RequestInit["redirect"] }[],
		/** A test's own answer for a request, tried first; `undefined` leaves the request to the services below. */
		answer: null as
			| ((url: string, headers: Record<string, string>) => Promise<Response | undefined> | Response | undefined)
			| null,
		anthropicModels: [
			{
				id: "claude-sonnet-5-5",
				display_name: "Claude Sonnet 5.5",
				capabilities: { thinking: { supported: true }, image_input: { supported: true } },
			},
			{
				id: "claude-haiku-5-5",
				display_name: "Claude Haiku 5.5",
				capabilities: { thinking: { supported: true }, image_input: { supported: true } },
			},
			{
				id: "claude-opus-5-5",
				display_name: "Claude Opus 5.5",
				capabilities: { thinking: { supported: true }, image_input: { supported: true } },
			},
		],
	};
	const json = (status: number, body: unknown) =>
		new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
	const fetch: typeof globalThis.fetch = async (input, init) => {
		const url = String(input);
		const headers = Object.fromEntries(new Headers(init?.headers).entries());
		state.requests.push({ url, headers, redirect: init?.redirect });
		if (state.down) throw new TypeError("fetch failed");
		const own = await state.answer?.(url, headers);
		if (own) return own;
		const bearer = headers.authorization?.replace(/^Bearer /, "") ?? "";
		if (url.startsWith("https://api.anthropic.com/v1/models"))
			return state.taken.has(headers["x-api-key"] ?? "")
				? json(200, { data: state.anthropicModels, has_more: false })
				: json(401, { type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } });
		if (url === "https://api.openai.com/v1/models")
			return state.taken.has(bearer)
				? json(200, {
						data: [
							{ id: "gpt-5.5" },
							{ id: "gpt-5.4-mini" },
							{ id: "text-embedding-3-large" },
							{ id: "gpt-image-2" },
							{ id: "whisper-1" },
						],
					})
				: json(401, { error: { message: "Incorrect API key provided" } });
		if (url === "http://localhost:11434/v1/models") return json(200, { data: [{ id: "llama4" }] });
		return json(404, {});
	};
	return { state, fetch, json };
}

let net = network();
let clock = new Date("2026-11-05T09:00:00Z");
const site = (options: Partial<MontiOptions> = {}) =>
	createMonti({ db, secret: SECRET, fetch: net.fetch, now: () => clock, ...options });

type Added = { output: { id: string; name: string; last4: string }; activityId: string };
const admin = { actor: "admin" } as const;
const add = (monti: ReturnType<typeof site>, input: Record<string, unknown>) =>
	monti.run("keys.add", input, admin) as Promise<Added>;
const list = (monti: ReturnType<typeof site>) => monti.run("keys.list", {}, admin) as Promise<KeyList>;
const models = (monti: ReturnType<typeof site>, input: Record<string, unknown> = {}) =>
	monti.run("models.list", input, admin) as Promise<ModelList>;
const reason = (error: unknown) => (error instanceof CheckError ? error.reason.key : error);
const refusedFor = (work: Promise<unknown>) => work.then(() => "taken", reason);

beforeEach(async () => {
	net = network();
	clock = new Date("2026-11-05T09:00:00Z");
	await sql`truncate api_keys, monti_activity, monti_proposal cascade`.execute(db);
});

describe("adding a key (flow 10, 01–06)", () => {
	it("14-1 a key its service takes becomes a row with its name and last four characters, and nothing used yet", async () => {
		const monti = site();
		const added = await add(monti, { service: "anthropic", name: "Anthropic 개인", secret: ANTHROPIC });
		expect(added.output).toMatchObject({ name: "Anthropic 개인", last4: "a1b2" });

		const listed = await list(monti);
		expect(listed.canStore).toBe(true);
		expect(listed.keys).toEqual([
			{
				id: added.output.id,
				service: "anthropic",
				serviceName: "Anthropic",
				name: "Anthropic 개인",
				last4: "a1b2",
				baseUrl: null,
				readable: true,
				hasKey: true,
				usage: { month: "2026-11", tokens: 0 },
				uses: [
					{ for: "assistant", model: "claude-sonnet-5-5" },
					{ for: "quick", model: "claude-haiku-5-5" },
				],
				version: 1,
			},
		]);
		// The service was asked once, with the key in the header its API reads it from.
		expect(net.state.requests).toHaveLength(1);
		expect(net.state.requests[0].headers["x-api-key"]).toBe(ANTHROPIC);
	});

	it("14-1 the services a key can be added for come with what the key window needs to ask", async () => {
		const { services } = await list(site());
		expect(services.map((service) => service.id)).toEqual([
			"anthropic",
			"openai",
			"openrouter",
			"gemini",
			"openai-compatible",
		]);
		expect(services.find((service) => service.id === "anthropic")).toEqual({
			id: "anthropic",
			name: "Anthropic",
			address: false,
			keyOptional: false,
			placeholder: "sk-ant-…",
		});
		expect(services.find((service) => service.id === "openai-compatible")).toMatchObject({
			address: true,
			keyOptional: true,
		});
	});

	it("14-1 a key the service refuses is not stored, and the refusal says which it was", async () => {
		const monti = site();
		expect(
			await refusedFor(add(monti, { service: "anthropic", name: "Anthropic", secret: "sk-ant-wrong-key-0000" })),
		).toBe("keys.refused");
		net.state.down = true;
		expect(await refusedFor(add(monti, { service: "anthropic", name: "Anthropic", secret: ANTHROPIC }))).toBe(
			"keys.unreachable",
		);
		expect((await list(monti)).keys).toEqual([]);
	});

	it("14-1 a name another key has is refused before the service is asked", async () => {
		const monti = site();
		await add(monti, { service: "anthropic", name: "Anthropic", secret: ANTHROPIC });
		net.state.requests.length = 0;
		const error = await add(monti, { service: "openai", name: "Anthropic", secret: OPENAI }).catch((thrown) => thrown);
		expect(error).toBeInstanceOf(CheckError);
		expect((error as CheckError).reason).toEqual({ key: "keys.nameTaken", values: { name: "Anthropic" } });
		expect(net.state.requests).toEqual([]);
	});

	it("14-1 a key needs a service the site has, a name and the key itself", async () => {
		const monti = site();
		expect(await refusedFor(add(monti, { service: "nowhere", name: "X", secret: "k" }))).toBe("keys.unknownService");
		expect(await refusedFor(add(monti, { service: "anthropic", name: "Anthropic", secret: "  " }))).toBe(
			"keys.needsKey",
		);
		await expect(add(monti, { service: "anthropic", name: "  ", secret: ANTHROPIC })).rejects.toThrow(/Invalid input/);
	});

	it("14-1 an OpenAI-compatible server is added by its address, with or without a key (02b)", async () => {
		const monti = site();
		expect(await refusedFor(add(monti, { service: "openai-compatible", name: "local", secret: "" }))).toBe(
			"keys.badAddress",
		);
		expect(
			await refusedFor(add(monti, { service: "openai-compatible", name: "local", secret: "", baseUrl: "ftp://x" })),
		).toBe("keys.badAddress");
		const added = await add(monti, {
			service: "openai-compatible",
			name: "localhost:11434",
			secret: "",
			baseUrl: "http://localhost:11434/v1/",
		});
		expect(added.output.last4).toBe("");
		const [row] = (await list(monti)).keys;
		expect(row).toMatchObject({
			name: "localhost:11434",
			baseUrl: "http://localhost:11434/v1",
			last4: "",
			readable: true,
			// No key is stored at all: the key window says "none", not a key too short to show.
			hasKey: false,
		});
		// No key, so no authorization header went out.
		expect(net.state.requests.at(-1)).toMatchObject({ url: "http://localhost:11434/v1/models", headers: {} });
		expect((await models(monti)).keys[0].models).toEqual([{ id: "llama4", thinking: false, images: false }]);
	});

	it("14-1 a short key shows no ending: four characters would be most of it", async () => {
		const monti = site();
		net.state.taken.add("short-key");
		const added = await add(monti, { service: "anthropic", name: "Short", secret: "short-key" });
		expect(added.output.last4).toBe("");
		// It is a key all the same, as the key window must know: no ending, but not "no key".
		expect((await list(monti)).keys[0]).toMatchObject({ last4: "", hasKey: true });
	});

	it("a plugin's service is one more service a key can be added for, and two services cannot share an id", async () => {
		const spell: KeyService = {
			id: "bareun",
			name: "바른 맞춤법",
			check: async ({ secret }) =>
				secret === "bareun-key-0000-4410" ? { ok: true, models: [] } : { ok: false, reason: "refused" },
		};
		const monti = site({ plugins: [definePlugin({ name: "bareun", keyServices: [spell] })] });
		expect((await list(monti)).services.map((service) => service.id)).toContain("bareun");
		const added = await add(monti, { service: "bareun", name: "바른 맞춤법", secret: "bareun-key-0000-4410" });
		expect(added.output.last4).toBe("4410");
		// It lists no models, so no model comes from it.
		expect((await list(monti)).keys[0].uses).toEqual([]);
		expect(() =>
			site({ plugins: [definePlugin({ name: "twice", keyServices: [{ ...spell, id: "anthropic" }] })] }),
		).toThrow(/defined twice/);
	});
});

describe("changing and removing a key (flow 10, 07–11)", () => {
	it("14-1 a new name is saved without asking the service again", async () => {
		const monti = site();
		const { output } = await add(monti, { service: "anthropic", name: "Anthropic", secret: ANTHROPIC });
		net.state.requests.length = 0;
		const changed = (await monti.run("keys.update", { id: output.id, name: "Anthropic 개인" }, admin)) as Added;
		expect(changed.output).toEqual({ id: output.id, name: "Anthropic 개인", last4: "a1b2" });
		expect(net.state.requests).toEqual([]);
		expect((await list(monti)).keys[0]).toMatchObject({ name: "Anthropic 개인", last4: "a1b2" });
	});

	it("14-1 a new key is checked with the service again; a refused one leaves the old key in place", async () => {
		const monti = site();
		const { output } = await add(monti, { service: "anthropic", name: "Anthropic", secret: ANTHROPIC });
		expect(await refusedFor(monti.run("keys.update", { id: output.id, secret: "sk-ant-wrong-key-0000" }, admin))).toBe(
			"keys.refused",
		);
		expect((await list(monti)).keys[0].last4).toBe("a1b2");
		expect((await monti.keys.open(output.id))?.secret).toBe(ANTHROPIC);

		const changed = (await monti.run("keys.update", { id: output.id, secret: ANTHROPIC_NEW }, admin)) as Added;
		expect(changed.output.last4).toBe("7c0e");
		expect((await list(monti)).keys[0].last4).toBe("7c0e");
		expect((await monti.keys.open(output.id))?.secret).toBe(ANTHROPIC_NEW);
	});

	it("14-1 a key cannot take another key's name, and its own name is no clash", async () => {
		const monti = site();
		const first = await add(monti, { service: "anthropic", name: "Anthropic", secret: ANTHROPIC });
		await add(monti, { service: "openai", name: "OpenAI", secret: OPENAI });
		expect(await refusedFor(monti.run("keys.update", { id: first.output.id, name: "OpenAI" }, admin))).toBe(
			"keys.nameTaken",
		);
		await monti.run("keys.update", { id: first.output.id, name: "Anthropic" }, admin);
		expect(await refusedFor(monti.run("keys.update", { id: "none", name: "X" }, admin))).toBe("keys.unknown");
	});

	it("14-1 a key says where it is used, and removing it stops those uses: the next key's models take over", async () => {
		const monti = site();
		const first = await add(monti, { service: "anthropic", name: "Anthropic", secret: ANTHROPIC });
		clock = new Date(clock.getTime() + 1000);
		const second = await add(monti, { service: "openai", name: "OpenAI", secret: OPENAI });
		await monti.run("models.setQuick", { keyId: first.output.id, model: "claude-opus-5-5" }, admin);
		const before = await list(monti);
		expect(before.keys.map((key) => key.uses)).toEqual([
			[
				{ for: "assistant", model: "claude-sonnet-5-5" },
				{ for: "quick", model: "claude-opus-5-5" },
			],
			[],
		]);

		const removed = (await monti.run("keys.remove", { id: first.output.id }, admin)) as { output: { name: string } };
		expect(removed.output.name).toBe("Anthropic");
		const after = await list(monti);
		expect(after.keys).toHaveLength(1);
		expect(after.keys[0].uses).toEqual([
			{ for: "assistant", model: "gpt-5.5" },
			{ for: "quick", model: "gpt-5.4-mini" },
		]);
		// The picked quick model went with its key.
		expect(await db.selectFrom("model_choices").selectAll().execute()).toEqual([]);
		expect(await monti.keys.open(first.output.id)).toBeNull();
		expect(await refusedFor(monti.run("keys.remove", { id: first.output.id }, admin))).toBe("keys.unknown");
		expect(second.output.id).toBe(after.keys[0].id);
	});

	it("14-1 removing a key cannot be undone: its activity row offers no undo", async () => {
		const monti = site();
		const { output } = await add(monti, { service: "anthropic", name: "Anthropic", secret: ANTHROPIC });
		const removed = (await monti.run("keys.remove", { id: output.id }, admin)) as { activityId: string };
		const row = await db
			.selectFrom("monti_activity")
			.select(["operation", "undo_until", "summary"])
			.where("id", "=", removed.activityId)
			.executeTakeFirstOrThrow();
		expect(row).toEqual({
			operation: "keys.remove",
			undo_until: null,
			summary: { key: "keys.remove", values: { name: "Anthropic" } },
		});
	});
});

describe("models (flow 10, 13; flow 2, 23)", () => {
	it("14-1 each readable key lists its models; only ones a conversation can be held with", async () => {
		const monti = site();
		await add(monti, { service: "anthropic", name: "Anthropic", secret: ANTHROPIC });
		clock = new Date(clock.getTime() + 1000);
		await add(monti, { service: "openai", name: "OpenAI", secret: OPENAI });
		const listed = await models(monti);
		expect(listed.keys.map((key) => [key.name, key.models.map((model) => model.id)])).toEqual([
			["Anthropic", ["claude-haiku-5-5", "claude-opus-5-5", "claude-sonnet-5-5"]],
			["OpenAI", ["gpt-5.4-mini", "gpt-5.5"]],
		]);
		expect(listed.keys[0].models[0]).toEqual({
			id: "claude-haiku-5-5",
			label: "Claude Haiku 5.5",
			thinking: true,
			images: true,
		});
		expect(listed.keys[1].models[1]).toEqual({ id: "gpt-5.5", thinking: true, images: true });
	});

	it("14-1 before anyone picks, the first key's service's own models are at work; a pick replaces the quick one only", async () => {
		const monti = site();
		expect(await models(monti)).toEqual({ keys: [], assistant: null, quick: null });
		const first = await add(monti, { service: "anthropic", name: "Anthropic", secret: ANTHROPIC });
		clock = new Date(clock.getTime() + 1000);
		const second = await add(monti, { service: "openai", name: "OpenAI", secret: OPENAI });
		expect(await models(monti)).toMatchObject({
			assistant: { keyId: first.output.id, model: "claude-sonnet-5-5" },
			quick: { keyId: first.output.id, model: "claude-haiku-5-5", chosen: false },
		});

		await monti.run("models.setQuick", { keyId: second.output.id, model: "gpt-5.4-mini" }, admin);
		expect(await models(monti)).toMatchObject({
			assistant: { keyId: first.output.id, model: "claude-sonnet-5-5" },
			quick: { keyId: second.output.id, model: "gpt-5.4-mini", chosen: true },
		});
		expect((await list(monti)).keys.map((key) => key.uses)).toEqual([
			[{ for: "assistant", model: "claude-sonnet-5-5" }],
			[{ for: "quick", model: "gpt-5.4-mini" }],
		]);
	});

	it("14-1 the quick model is one of a key's models, nothing else", async () => {
		const monti = site();
		const { output } = await add(monti, { service: "anthropic", name: "Anthropic", secret: ANTHROPIC });
		expect(await refusedFor(monti.run("models.setQuick", { keyId: output.id, model: "gpt-5.5" }, admin))).toBe(
			"models.unknown",
		);
		expect(await refusedFor(monti.run("models.setQuick", { keyId: "none", model: "claude-haiku-5-5" }, admin))).toBe(
			"models.unknown",
		);
	});

	it("when the service no longer lists a preferred model, the key's first model stands in", async () => {
		const monti = site();
		net.state.anthropicModels = [{ id: "claude-next-1", display_name: "Claude Next", capabilities: {} as never }];
		const { output } = await add(monti, { service: "anthropic", name: "Anthropic", secret: ANTHROPIC });
		expect(await models(monti)).toMatchObject({
			assistant: { keyId: output.id, model: "claude-next-1" },
			quick: { keyId: output.id, model: "claude-next-1", chosen: false },
		});
		expect((await models(monti)).keys[0].models).toEqual([
			{ id: "claude-next-1", label: "Claude Next", thinking: false, images: false },
		]);
	});

	it("a key's list is asked of its service again after a day, or at once on refresh; a service that is down keeps its last list", async () => {
		const monti = site();
		await add(monti, { service: "anthropic", name: "Anthropic", secret: ANTHROPIC });
		net.state.requests.length = 0;
		await models(monti);
		expect(net.state.requests).toHaveLength(0);

		net.state.anthropicModels = [...net.state.anthropicModels, { ...net.state.anthropicModels[0], id: "claude-new-6" }];
		await models(monti, { refresh: true });
		expect(net.state.requests).toHaveLength(1);
		expect((await models(monti)).keys[0].models.map((model) => model.id)).toContain("claude-new-6");

		clock = new Date(clock.getTime() + 25 * 3_600_000);
		net.state.down = true;
		const kept = await models(monti);
		expect(net.state.requests).toHaveLength(2);
		expect(kept.keys[0].models.map((model) => model.id)).toContain("claude-new-6");
	});

	it("a picked quick model its key no longer lists gives way to the built-in one until it is back", async () => {
		const monti = site();
		const { output } = await add(monti, { service: "anthropic", name: "Anthropic", secret: ANTHROPIC });
		await monti.run("models.setQuick", { keyId: output.id, model: "claude-opus-5-5" }, admin);
		const all = net.state.anthropicModels;
		net.state.anthropicModels = all.filter((model) => model.id !== "claude-opus-5-5");
		expect((await models(monti, { refresh: true })).quick).toEqual({
			keyId: output.id,
			model: "claude-haiku-5-5",
			chosen: false,
		});
		net.state.anthropicModels = all;
		expect((await models(monti, { refresh: true })).quick).toEqual({
			keyId: output.id,
			model: "claude-opus-5-5",
			chosen: true,
		});
	});
});

describe("usage", () => {
	it("tokens are counted per key per month, and a new month starts from nothing", async () => {
		const monti = site();
		const { output } = await add(monti, { service: "anthropic", name: "Anthropic", secret: ANTHROPIC });
		await monti.keys.addUsage(output.id, 1_200_000);
		await monti.keys.addUsage(output.id, 40_000);
		expect((await list(monti)).keys[0].usage).toEqual({ month: "2026-11", tokens: 1_240_000 });

		clock = new Date("2026-12-01T00:00:01Z");
		expect((await list(monti)).keys[0].usage).toEqual({ month: "2026-12", tokens: 0 });
		await monti.keys.addUsage(output.id, 500);
		expect((await list(monti)).keys[0].usage).toEqual({ month: "2026-12", tokens: 500 });
	});

	it("a count that arrives late for last month goes to last month: this month's stays", async () => {
		const monti = site();
		const { output } = await add(monti, { service: "anthropic", name: "Anthropic", secret: ANTHROPIC });
		clock = new Date("2026-12-03T10:00:00Z");
		await monti.keys.addUsage(output.id, 500);
		// A run that began on the last evening of November reports only now.
		await monti.keys.addUsage(output.id, 100, new Date("2026-11-30T23:59:00Z"));
		expect((await list(monti)).keys[0].usage).toEqual({ month: "2026-12", tokens: 500 });
		await monti.keys.addUsage(output.id, 20);
		expect((await list(monti)).keys[0].usage).toEqual({ month: "2026-12", tokens: 520 });
		expect(await db.selectFrom("api_key_usage").select(["month", "tokens"]).orderBy("month").execute()).toMatchObject([
			{ month: "2026-11" },
			{ month: "2026-12" },
		]);
	});

	it("a call that ends after its key was removed counts nothing and fails nothing", async () => {
		const monti = site();
		const { output } = await add(monti, { service: "anthropic", name: "Anthropic", secret: ANTHROPIC });
		await monti.run("keys.remove", { id: output.id }, admin);
		await monti.keys.addUsage(output.id, 500);
		expect(await db.selectFrom("api_key_usage").selectAll().execute()).toEqual([]);
	});

	it("a month's count can pass what a 32-bit number holds", async () => {
		const monti = site();
		const { output } = await add(monti, { service: "anthropic", name: "Anthropic", secret: ANTHROPIC });
		await monti.keys.addUsage(output.id, 2_000_000_000);
		await monti.keys.addUsage(output.id, 2_000_000_000);
		expect((await list(monti)).keys[0].usage.tokens).toBe(4_000_000_000);
	});
});

describe("the server's secret (flow 10, 14–15)", () => {
	it("14-1 after the secret changes, keys are listed as unreadable, give no models, and are entered again to work", async () => {
		const { output } = await add(site(), { service: "anthropic", name: "Anthropic", secret: ANTHROPIC });
		const moved = site({ secret: "another-secret" });
		const listed = await list(moved);
		expect(listed.keys[0]).toMatchObject({ name: "Anthropic", last4: "a1b2", readable: false, uses: [] });
		expect(await models(moved)).toEqual({ keys: [], assistant: null, quick: null });
		expect(await moved.keys.open(output.id)).toBeNull();

		// A new name alone does not make it readable: the key itself is needed.
		expect(await refusedFor(moved.run("keys.update", { id: output.id, name: "Anthropic 2" }, admin))).toBe(
			"keys.needsKey",
		);
		await moved.run("keys.update", { id: output.id, secret: ANTHROPIC }, admin);
		expect((await list(moved)).keys[0]).toMatchObject({ readable: true, last4: "a1b2" });
		expect((await moved.keys.open(output.id))?.secret).toBe(ANTHROPIC);
	});

	it("14-1 without MONTI_SECRET no key is stored: the list says so, and adding and changing are refused", async () => {
		const { output } = await add(site(), { service: "anthropic", name: "Anthropic", secret: ANTHROPIC });
		const bare = site({ secret: null });
		const listed = await list(bare);
		expect(listed.canStore).toBe(false);
		expect(listed.keys[0].readable).toBe(false);
		expect(await refusedFor(add(bare, { service: "openai", name: "OpenAI", secret: OPENAI }))).toBe("keys.noSecret");
		expect(await refusedFor(bare.run("keys.update", { id: output.id, name: "X" }, admin))).toBe("keys.noSecret");
		expect(net.state.requests).toHaveLength(1);
	});
});

describe("an empty secret is no secret (review 1)", () => {
	it.each(["", "   "])("14-4 with MONTI_SECRET=%j nothing is stored, opened or shown as readable", async (empty) => {
		const { output } = await add(site(), { service: "anthropic", name: "Anthropic", secret: ANTHROPIC });
		const bare = site({ secret: empty });
		expect(bare.site.secret).toBeNull();
		const listed = await list(bare);
		expect(listed.canStore).toBe(false);
		expect(listed.keys[0].readable).toBe(false);
		expect(await refusedFor(add(bare, { service: "openai", name: "OpenAI", secret: OPENAI }))).toBe("keys.noSecret");
		expect(await refusedFor(bare.run("keys.update", { id: output.id, secret: ANTHROPIC_NEW }, admin))).toBe(
			"keys.noSecret",
		);
		expect(await bare.keys.open(output.id)).toBeNull();
		expect(await db.selectFrom("api_keys").select("name").execute()).toEqual([{ name: "Anthropic" }]);
	});
});

describe("two changes of one key (review 2)", () => {
	const A = "compatible-key-aaaa-1111";
	const B = "compatible-key-bbbb-2222";

	/** Two compatible servers that take any key; `hold` keeps server Y from answering until it is let go. */
	function twoServers() {
		const checked: string[] = [];
		let letGo = () => {};
		const held = new Promise<void>((resolve) => {
			letGo = resolve;
		});
		let reachedY = () => {};
		const atY = new Promise<void>((resolve) => {
			reachedY = resolve;
		});
		net.state.answer = async (url, headers) => {
			const host = /^http:\/\/(x|y)\.test\/v1\/models$/.exec(url)?.[1];
			if (!host) return undefined;
			const key = headers.authorization?.replace(/^Bearer /, "") ?? "";
			if (host === "y" && key === A) {
				reachedY();
				await held;
			}
			checked.push(`${key}@${host}`);
			return net.json(200, { data: [{ id: `${host}-model` }] });
		};
		return { checked, letGo, atY };
	}

	const settled = (work: Promise<unknown>) =>
		work.then(
			() => "done",
			(error: unknown) => (error as { code?: string }).code ?? String(error),
		);

	it("14-4 a new address and a new key sent at once: one wins, the other is a conflict, and the key stays with an address it was checked with", async () => {
		const monti = site();
		const servers = twoServers();
		const { output } = await add(monti, {
			service: "openai-compatible",
			name: "x.test",
			secret: A,
			baseUrl: "http://x.test/v1",
		});
		// One change moves the key to server Y and waits for Y's answer; meanwhile another replaces the key itself and is done first.
		const move = settled(monti.run("keys.update", { id: output.id, baseUrl: "http://y.test/v1" }, admin));
		await servers.atY;
		await monti.run("keys.update", { id: output.id, secret: B }, admin);
		servers.letGo();

		// The move read the key before it was replaced: it does not put the old key back, and does not carry the new one to Y.
		expect(await move).toBe("conflict");
		expect(await monti.keys.open(output.id)).toMatchObject({ secret: B, baseUrl: "http://x.test/v1" });
		expect(servers.checked).toEqual([`${A}@x`, `${B}@x`, `${A}@y`]);
		expect((await list(monti)).keys[0]).toMatchObject({ version: 2, last4: "2222" });
	});

	it("14-4 two changes sent with the version the screen read: the later one is a conflict whichever way it was held up", async () => {
		const monti = site();
		twoServers().letGo();
		const { output } = await add(monti, {
			service: "openai-compatible",
			name: "x.test",
			secret: A,
			baseUrl: "http://x.test/v1",
		});
		const read = { actor: "admin", versions: { [`key:${output.id}`]: 1 } } as const;
		await monti.run("keys.update", { id: output.id, name: "renamed" }, read);
		expect(await settled(monti.run("keys.update", { id: output.id, secret: B }, read))).toBe("conflict");
		expect(await monti.keys.open(output.id)).toMatchObject({ secret: A, name: "renamed" });
	});

	it("14-4 a change sent with an old version is a conflict before anything is asked: the key that took its place goes nowhere", async () => {
		const monti = site();
		const servers = twoServers();
		servers.letGo();
		const { output } = await add(monti, {
			service: "openai-compatible",
			name: "x.test",
			secret: A,
			baseUrl: "http://x.test/v1",
		});
		// Another tab replaced the key and moved it to Y.
		await monti.run("keys.update", { id: output.id, secret: B, baseUrl: "http://y.test/v1" }, admin);
		net.state.requests.length = 0;
		// The tab that still shows the old key at X saves its address field, with the version it read.
		const stale = { actor: "admin", versions: { [`key:${output.id}`]: 1 } } as const;
		expect(await settled(monti.run("keys.update", { id: output.id, baseUrl: "http://x.test/v1" }, stale))).toBe(
			"conflict",
		);
		// Nothing was asked of any service: B never left for X.
		expect(net.state.requests).toEqual([]);
		expect(await monti.keys.open(output.id)).toMatchObject({ secret: B, baseUrl: "http://y.test/v1" });
	});

	it("14-4 ten changes of one key at once: each either lands on the version it read or is a conflict, never both lost and counted", async () => {
		const monti = site();
		twoServers().letGo();
		const { output } = await add(monti, {
			service: "openai-compatible",
			name: "x.test",
			secret: A,
			baseUrl: "http://x.test/v1",
		});
		const results = await Promise.all(
			Array.from({ length: 10 }, (_unused, index) =>
				settled(monti.run("keys.update", { id: output.id, name: `name-${index}` }, admin)),
			),
		);
		const landed = results.filter((result) => result === "done").length;
		expect(results.filter((result) => result !== "done" && result !== "conflict")).toEqual([]);
		// The version counts exactly the changes that landed.
		expect((await list(monti)).keys[0].version).toBe(1 + landed);
		expect(landed).toBeGreaterThan(0);
	});

	it("14-1 two keys added at once under one name: one is refused by name, and no error escapes", async () => {
		const monti = site();
		const results = await Promise.all([
			refusedFor(add(monti, { service: "anthropic", name: "Same", secret: ANTHROPIC })),
			refusedFor(add(monti, { service: "anthropic", name: "Same", secret: ANTHROPIC_NEW })),
		]);
		expect(results.sort()).toEqual(["keys.nameTaken", "taken"]);
		expect((await list(monti)).keys).toHaveLength(1);
	});
});

describe("what a service answers is not trusted (reviews 5, 6, 7)", () => {
	const KEY = "compatible-secret-key-0f0f";

	it("14-4 a server that names a model after the key it was sent is refused: the key is in no list, answer or log", async () => {
		const monti = site();
		net.state.answer = (url, headers) =>
			url === "http://echo.test/v1/models"
				? net.json(200, { data: [{ id: headers.authorization?.replace(/^Bearer /, "") }, { id: "plain-model" }] })
				: undefined;
		expect(
			await refusedFor(
				add(monti, { service: "openai-compatible", name: "echo", secret: KEY, baseUrl: "http://echo.test/v1" }),
			),
		).toBe("keys.unreachable");
		expect((await list(monti)).keys).toEqual([]);

		// The same server turning to it later: a key already stored keeps the list it had.
		net.state.answer = (url) =>
			url === "http://echo.test/v1/models" ? net.json(200, { data: [{ id: "plain-model" }] }) : undefined;
		const { output } = await add(monti, {
			service: "openai-compatible",
			name: "echo",
			secret: KEY,
			baseUrl: "http://echo.test/v1",
		});
		net.state.answer = (url) =>
			url === "http://echo.test/v1/models" ? net.json(200, { data: [{ id: `model-${KEY}-x` }] }) : undefined;
		const listed = await models(monti, { refresh: true });
		expect(listed.keys[0].models).toEqual([{ id: "plain-model", thinking: false, images: false }]);
		expect(await refusedFor(monti.run("models.setQuick", { keyId: output.id, model: `model-${KEY}-x` }, admin))).toBe(
			"models.unknown",
		);
		expect(JSON.stringify([listed, await everythingStored()])).not.toContain(KEY);
	});

	it("14-4 a service's own name for a model is refused the same way when it carries the key", async () => {
		const monti = site();
		net.state.anthropicModels = [
			{ id: "claude-sonnet-5-5", display_name: `Sonnet (${ANTHROPIC})`, capabilities: {} as never },
		];
		expect(await refusedFor(add(monti, { service: "anthropic", name: "Anthropic", secret: ANTHROPIC }))).toBe(
			"keys.unreachable",
		);
	});

	it("a list asked with the old key does not replace the list of the key that took its place", async () => {
		const monti = site();
		const { output } = await add(monti, { service: "anthropic", name: "Anthropic", secret: ANTHROPIC });
		let letGo = () => {};
		const held = new Promise<void>((resolve) => {
			letGo = resolve;
		});
		let reached = () => {};
		const asked = new Promise<void>((resolve) => {
			reached = resolve;
		});
		const only = (id: string) => ({
			data: [
				{ id, display_name: id, capabilities: { thinking: { supported: true }, image_input: { supported: true } } },
			],
		});
		// The refresh with the old key hangs at the service; the new key's check answers at once with its own list.
		net.state.answer = async (url, headers) => {
			if (!url.startsWith("https://api.anthropic.com/")) return undefined;
			if (headers["x-api-key"] === ANTHROPIC_NEW) return net.json(200, only("new-keys-model"));
			reached();
			await held;
			return net.json(200, only("old-keys-model"));
		};
		const refresh = models(monti, { refresh: true });
		await asked;
		clock = new Date(clock.getTime() + 60_000);
		await monti.run("keys.update", { id: output.id, secret: ANTHROPIC_NEW }, admin);
		const changedAt = clock;
		clock = new Date(clock.getTime() + 60_000);
		letGo();

		// Even the call that asked with the old key lists what is stored now.
		expect((await refresh).keys[0].models.map((model) => model.id)).toEqual(["new-keys-model"]);
		const row = await db.selectFrom("api_keys").select(["models", "models_at"]).executeTakeFirstOrThrow();
		expect(row.models.map((model) => model.id)).toEqual(["new-keys-model"]);
		expect(row.models_at).toEqual(changedAt);
	});

	it.each([
		["a page of HTML", () => new Response("<html><body>Sign in</body></html>", { status: 200 })],
		["text that is not JSON", () => new Response('{"data": [', { status: 200 })],
		["an object without the list", () => new Response(JSON.stringify({ garbage: true }), { status: 200 })],
		["a list that is not one", () => new Response(JSON.stringify({ data: "claude" }), { status: 200 })],
		["rows that are not models", () => new Response(JSON.stringify({ data: [1, 2, 3] }), { status: 200 })],
		["a row without an id", () => new Response(JSON.stringify({ data: [{ display_name: "?" }] }), { status: 200 })],
		["no body at all", () => new Response(null, { status: 200 })],
	])("14-1 a 200 that is %s adds no key and keeps a stored key's models and starting models", async (_what, body) => {
		const monti = site();
		const { output } = await add(monti, { service: "anthropic", name: "Anthropic", secret: ANTHROPIC });
		const before = await models(monti);
		net.state.answer = (url) => (url.startsWith("https://api.anthropic.com/") ? body() : undefined);

		expect(await refusedFor(add(monti, { service: "anthropic", name: "Second", secret: ANTHROPIC_NEW }))).toBe(
			"keys.unreachable",
		);
		clock = new Date(clock.getTime() + 25 * 3_600_000);
		const after = await models(monti, { refresh: true });
		expect(after).toEqual(before);
		expect(after.assistant).toEqual({ keyId: output.id, model: "claude-sonnet-5-5" });
		expect(after.keys[0].models).toHaveLength(3);
	});

	it("a service that truly lists nothing is taken at its word: the key is added with no models", async () => {
		const monti = site();
		net.state.answer = (url) => (url === "http://empty.test/v1/models" ? net.json(200, { data: [] }) : undefined);
		await add(monti, { service: "openai-compatible", name: "empty", secret: "", baseUrl: "http://empty.test/v1" });
		expect((await models(monti)).keys[0].models).toEqual([]);
	});
});

describe("a key on the command line (review K)", () => {
	const io = (typed?: string) => {
		const lines: string[] = [];
		return {
			lines,
			io: {
				out: (line: string) => lines.push(line),
				err: (line: string) => lines.push(line),
				...(typed === undefined ? {} : { secret: async () => typed }),
			},
		};
	};

	it("14-4 a key given as an argument is refused before anything runs: the shell would keep it", async () => {
		const monti = site();
		for (const args of [
			["keys.add", "--service", "anthropic", "--name", "Anthropic", "--secret", ANTHROPIC],
			["keys.add", "--service", "anthropic", "--name", "Anthropic", `--secret=${ANTHROPIC}`],
			["keys.add", "--input", JSON.stringify({ service: "anthropic", name: "Anthropic", secret: ANTHROPIC })],
		]) {
			const { lines, io: terminal } = io(ANTHROPIC_NEW);
			expect(await runCli(monti, args, terminal)).toBe(1);
			expect(lines.join("\n")).toContain("write --secret - and give it on standard input");
			expect(lines.join("\n")).not.toContain(ANTHROPIC);
		}
		expect(net.state.requests).toEqual([]);
		expect((await list(monti)).keys).toEqual([]);
	});

	it("14-1 with `--secret -` the key is read from standard input, for a new key and for a changed one", async () => {
		const monti = site();
		const adding = io(ANTHROPIC);
		expect(
			await runCli(monti, ["keys.add", "--service", "anthropic", "--name", "Anthropic", "--secret", "-"], adding.io),
		).toBe(0);
		const { id } = (JSON.parse(adding.lines.join("")) as Added).output;
		expect((await monti.keys.open(id))?.secret).toBe(ANTHROPIC);

		const changing = io(ANTHROPIC_NEW);
		expect(await runCli(monti, ["keys.update", "--id", id, "--secret", "-"], changing.io)).toBe(0);
		expect((await monti.keys.open(id))?.secret).toBe(ANTHROPIC_NEW);
		// A change that names no key asks for none.
		const renaming = io();
		expect(await runCli(monti, ["keys.update", "--id", id, "--name", "Renamed"], renaming.io)).toBe(0);
		expect([...adding.lines, ...changing.lines, ...renaming.lines].join("\n")).not.toMatch(/sk-ant/);
	});

	it("14-4 where nothing can read standard input, `--secret -` is refused rather than stored as a dash", async () => {
		const monti = site();
		const { lines, io: terminal } = io();
		expect(
			await runCli(monti, ["keys.add", "--service", "anthropic", "--name", "Anthropic", "--secret", "-"], terminal),
		).toBe(1);
		expect(lines.join("\n")).toContain("standard input");
		expect(net.state.requests).toEqual([]);
	});
});

describe("a row changed behind the server's back (review A)", () => {
	const KEY = "compatible-secret-key-3c3c";
	const addCompatible = (monti: ReturnType<typeof site>, name = "x.test") => {
		net.state.answer = (url) =>
			/^http:\/\/(x|evil)\.test\/v1\/models$/.test(url) ? net.json(200, { data: [{ id: "a-model" }] }) : undefined;
		return add(monti, { service: "openai-compatible", name, secret: KEY, baseUrl: "http://x.test/v1" });
	};
	const sentToEvil = () => net.state.requests.filter((request) => request.url.includes("evil.test"));

	it("14-4 an address rewritten in the database opens no key: the server sends it nowhere", async () => {
		const monti = site();
		const { output } = await addCompatible(monti);
		await db.updateTable("api_keys").set({ base_url: "http://evil.test/v1", models_at: null }).execute();

		const listed = await models(monti, { refresh: true });
		expect(listed.keys).toEqual([]);
		expect(sentToEvil()).toEqual([]);
		expect((await list(monti)).keys[0]).toMatchObject({ readable: false, baseUrl: "http://evil.test/v1" });
		expect(await monti.keys.open(output.id)).toBeNull();
		// The person who has the key enters it again, and it is checked with the address the row now shows.
		await monti.run("keys.update", { id: output.id, secret: KEY, baseUrl: "http://x.test/v1" }, admin);
		expect(await monti.keys.open(output.id)).toMatchObject({ secret: KEY, baseUrl: "http://x.test/v1" });
	});

	it("14-4 a service rewritten in the database opens no key either", async () => {
		const monti = site();
		const { output } = await add(monti, { service: "anthropic", name: "Anthropic", secret: ANTHROPIC });
		await db
			.updateTable("api_keys")
			.set({ service: "openai-compatible", base_url: "http://evil.test/v1", models_at: null })
			.execute();
		net.state.requests.length = 0;
		await models(monti, { refresh: true });
		expect(net.state.requests).toEqual([]);
		expect(await monti.keys.open(output.id)).toBeNull();
	});

	it("14-4 a sealed key copied into another row does not open there", async () => {
		const monti = site();
		const first = await addCompatible(monti, "x.test");
		clock = new Date(clock.getTime() + 1000);
		const second = await add(monti, { service: "anthropic", name: "Anthropic", secret: ANTHROPIC });
		const { secret } = await db
			.selectFrom("api_keys")
			.select("secret")
			.where("id", "=", second.output.id)
			.executeTakeFirstOrThrow();
		await db.updateTable("api_keys").set({ secret }).where("id", "=", first.output.id).execute();
		expect(await monti.keys.open(first.output.id)).toBeNull();
		expect((await monti.keys.open(second.output.id))?.secret).toBe(ANTHROPIC);
	});

	it("14-1 an address changed by its owner keeps the key: it is sealed again for the new address", async () => {
		const monti = site();
		const { output } = await addCompatible(monti);
		net.state.answer = (url) =>
			url === "http://y.test/v1/models" ? net.json(200, { data: [{ id: "y-model" }] }) : undefined;
		await monti.run("keys.update", { id: output.id, baseUrl: "http://y.test/v1" }, admin);
		expect(await monti.keys.open(output.id)).toMatchObject({ secret: KEY, baseUrl: "http://y.test/v1" });
		expect(net.state.requests.at(-1)?.headers.authorization).toBe(`Bearer ${KEY}`);
	});
});

describe("a service that is slow or down (review B)", () => {
	const sleep = (ms: number) => new Promise((resume) => setTimeout(resume, ms));
	const anthropicRequests = () => net.state.requests.filter((request) => request.url.includes("anthropic.com")).length;

	it("14-1 a service that fails is left alone for a quarter of an hour: the model menu does not wait for it every time", async () => {
		const monti = site();
		await add(monti, { service: "anthropic", name: "Anthropic", secret: ANTHROPIC });
		clock = new Date(clock.getTime() + 25 * 3_600_000);
		// Down the slow way: it takes its time, then fails.
		net.state.answer = async (url) => {
			if (!url.includes("anthropic.com")) return undefined;
			await sleep(300);
			throw new TypeError("fetch failed");
		};
		const before = anthropicRequests();
		const first = await models(monti);
		expect(anthropicRequests()).toBe(before + 1);
		expect(first.keys[0].models).toHaveLength(3);

		clock = new Date(clock.getTime() + 60_000);
		const started = Date.now();
		const second = await models(monti);
		expect(anthropicRequests()).toBe(before + 1);
		expect(Date.now() - started).toBeLessThan(250);
		expect(second).toEqual(first);

		// After the wait it is asked again; and once it answers, the list is fresh and the failure forgotten.
		clock = new Date(clock.getTime() + MODELS_RETRY_MS);
		await models(monti);
		expect(anthropicRequests()).toBe(before + 2);
		net.state.answer = null;
		clock = new Date(clock.getTime() + MODELS_RETRY_MS + 1000);
		await models(monti);
		expect(anthropicRequests()).toBe(before + 3);
		await models(monti);
		expect(anthropicRequests()).toBe(before + 3);
		expect(await db.selectFrom("api_keys").select("models_failed_at").execute()).toEqual([{ models_failed_at: null }]);
	});

	it("14-1 asking now (`refresh`) asks even a service that just failed", async () => {
		const monti = site();
		await add(monti, { service: "anthropic", name: "Anthropic", secret: ANTHROPIC });
		clock = new Date(clock.getTime() + 25 * 3_600_000);
		net.state.down = true;
		await models(monti);
		const before = anthropicRequests();
		await models(monti, { refresh: true });
		expect(anthropicRequests()).toBe(before + 1);
	});

	it("14-1 a call that arrives while a refresh is being written joins it, and does not ask the service again", async () => {
		const monti = site();
		await add(monti, { service: "anthropic", name: "Anthropic", secret: ANTHROPIC });
		clock = new Date(clock.getTime() + 25 * 3_600_000);
		const before = anthropicRequests();
		// The key's row is held, so the refresh's write waits after the service has answered.
		let release = () => {};
		const released = new Promise<void>((resolve) => {
			release = resolve;
		});
		let held = () => {};
		const holding = new Promise<void>((resolve) => {
			held = resolve;
		});
		const holder = db.transaction().execute(async (trx) => {
			await trx.selectFrom("api_keys").select("id").forUpdate().execute();
			held();
			await released;
		});
		await holding;

		const first = models(monti);
		let second = first;
		let whileWaiting = -1;
		try {
			while (anthropicRequests() === before) await sleep(10);
			await sleep(150);
			second = models(monti);
			await sleep(300);
			whileWaiting = anthropicRequests();
		} finally {
			// Whatever was found, the row is let go: the next test needs the table.
			release();
			await Promise.all([first, second, holder]);
		}
		expect(whileWaiting).toBe(before + 1);
		expect(anthropicRequests()).toBe(before + 1);
		expect(await first).toEqual(await second);
	});

	it("14-1 calls that want the same stale list at the same moment share one check", async () => {
		const monti = site();
		await add(monti, { service: "anthropic", name: "Anthropic", secret: ANTHROPIC });
		clock = new Date(clock.getTime() + 25 * 3_600_000);
		net.state.answer = async (url) => {
			if (url.includes("anthropic.com")) await sleep(200);
			return undefined;
		};
		const before = anthropicRequests();
		const [one, two, three] = await Promise.all([models(monti), models(monti), models(monti, { refresh: true })]);
		expect(anthropicRequests()).toBe(before + 1);
		expect(one).toEqual(two);
		expect(two).toEqual(three);
	});
});

describe("the database is not held while a service is asked (review E)", () => {
	/** A site whose pool has one connection, as a serverless deploy gives each instance. */
	async function singleConnection() {
		const { rows } = await sql<{ schema: string }>`select current_schema() as schema`.execute(db);
		const pool = new Pool({
			connectionString: process.env.CMS_TEST_DATABASE_URL,
			options: `-c search_path=${rows[0].schema}`,
			max: 1,
		});
		const single = new Kysely<Database>({ dialect: new PostgresDialect({ pool }) });
		pools.push(single);
		return site({ db: single });
	}
	const pools: Kysely<Database>[] = [];
	afterAll(async () => {
		for (const pool of pools) await pool.destroy();
	});

	/** Holds Anthropic's answer until let go, and tells when the question has arrived. */
	function hold() {
		let letGo = () => {};
		const held = new Promise<void>((resolve) => {
			letGo = resolve;
		});
		let arrived = () => {};
		const asked = new Promise<void>((resolve) => {
			arrived = resolve;
		});
		net.state.answer = async (url) => {
			if (!url.includes("anthropic.com")) return undefined;
			arrived();
			await held;
			return undefined;
		};
		return { letGo, asked };
	}
	const within = <Value>(work: Promise<Value>, ms: number) =>
		Promise.race([work, new Promise<"waited">((resolve) => setTimeout(() => resolve("waited"), ms))]);

	it("14-1 while a key to add waits for its service, the site's one connection still answers", async () => {
		const monti = await singleConnection();
		const service = hold();
		const adding = add(monti, { service: "anthropic", name: "Anthropic", secret: ANTHROPIC });
		await service.asked;
		const listed = await within(list(monti), 2000);
		expect(listed).not.toBe("waited");
		expect((listed as KeyList).keys).toEqual([]);
		service.letGo();
		expect((await adding).output.last4).toBe("a1b2");
	});

	it("14-1 the same while a changed key waits for its service", async () => {
		const monti = await singleConnection();
		const { output } = await add(monti, { service: "anthropic", name: "Anthropic", secret: ANTHROPIC });
		const service = hold();
		const changing = monti.run("keys.update", { id: output.id, secret: ANTHROPIC_NEW }, admin);
		await service.asked;
		const listed = await within(list(monti), 2000);
		expect(listed).not.toBe("waited");
		expect((listed as KeyList).keys[0].last4).toBe("a1b2");
		service.letGo();
		await changing;
		expect((await list(monti)).keys[0].last4).toBe("7c0e");
	});

	it("14-1 a name taken while the service was asked is still refused when the key goes in", async () => {
		const monti = site();
		const service = hold();
		const slow = refusedFor(add(monti, { service: "anthropic", name: "Same", secret: ANTHROPIC }));
		await service.asked;
		// Another key takes the name meanwhile, through a service that answers at once.
		await add(monti, { service: "openai", name: "Same", secret: OPENAI });
		service.letGo();
		expect(await slow).toBe("keys.nameTaken");
		expect((await list(monti)).keys.map((key) => key.service)).toEqual(["openai"]);
	});
});

describe("small things a key can be (reviews F, G, H, J)", () => {
	it.each([
		"x",
		"ollama",
		"none",
	])("14-1 a placeholder key (%j) in front of a server whose models carry that word is taken", async (placeholder) => {
		const monti = site();
		net.state.answer = (url) =>
			url === "http://proxy.test/v1/models"
				? net.json(200, { data: [{ id: "ollama/llama3" }, { id: "none-such/x-large" }] })
				: undefined;
		await add(monti, {
			service: "openai-compatible",
			name: "proxy",
			secret: placeholder,
			baseUrl: "http://proxy.test/v1",
		});
		expect((await models(monti)).keys[0].models.map((model) => model.id)).toEqual([
			"none-such/x-large",
			"ollama/llama3",
		]);
		expect((await list(monti)).keys[0].last4).toBe("");
	});

	it("14-1 a key whose service left with its plugin gives no model: the next key's models are at work", async () => {
		const house: KeyService = {
			id: "house",
			name: "House",
			defaults: { assistant: ["house-large"], quick: ["house-small"] },
			check: async () => ({
				ok: true,
				models: [
					{ id: "house-large", thinking: true, images: true },
					{ id: "house-small", thinking: false, images: false },
				],
			}),
		};
		const withPlugin = site({ plugins: [definePlugin({ name: "house", keyServices: [house] })] });
		const first = await add(withPlugin, { service: "house", name: "House", secret: "house-key-0000-9d9d" });
		clock = new Date(clock.getTime() + 1000);
		const second = await add(withPlugin, { service: "anthropic", name: "Anthropic", secret: ANTHROPIC });
		await withPlugin.run("models.setQuick", { keyId: first.output.id, model: "house-small" }, admin);
		expect(await models(withPlugin)).toMatchObject({
			assistant: { keyId: first.output.id, model: "house-large" },
			quick: { keyId: first.output.id, model: "house-small", chosen: true },
		});

		// The plugin is taken out of the site's config.
		const without = site();
		const listed = await models(without);
		expect(listed.keys.map((key) => key.name)).toEqual(["Anthropic"]);
		expect(listed).toMatchObject({
			assistant: { keyId: second.output.id, model: "claude-sonnet-5-5" },
			quick: { keyId: second.output.id, model: "claude-haiku-5-5", chosen: false },
		});
		const rows = (await list(without)).keys;
		expect(rows[0]).toMatchObject({ name: "House", serviceName: "house", readable: true, uses: [] });
		expect(
			await refusedFor(without.run("models.setQuick", { keyId: first.output.id, model: "house-large" }, admin)),
		).toBe("models.unknown");
	});

	it.each([
		"http://10.0.0.5:8080/admin#",
		"http://server.test/v1#models",
		"http://server.test/v1?key=1",
		"http://server.test/v1?",
		"http://user:password@server.test/v1",
		"http://user@server.test/v1",
		"server.test/v1",
		"file:///etc/passwd",
	])("14-1 the address %j is refused as no address, and nothing is asked of it", async (baseUrl) => {
		const monti = site();
		expect(await refusedFor(add(monti, { service: "openai-compatible", name: "server", secret: "", baseUrl }))).toBe(
			"keys.badAddress",
		);
		expect(net.state.requests).toEqual([]);
	});

	it("14-1 an address is stored as its origin and path: the check adds /models to exactly that", async () => {
		const monti = site();
		net.state.answer = (url) =>
			url === "http://server.test:8080/api/v1/models" ? net.json(200, { data: [{ id: "m" }] }) : undefined;
		await add(monti, {
			service: "openai-compatible",
			name: "server",
			secret: "",
			baseUrl: "  http://Server.test:8080/api/v1//  ",
		});
		expect((await list(monti)).keys[0].baseUrl).toBe("http://server.test:8080/api/v1");
		expect(net.state.requests.at(-1)?.url).toBe("http://server.test:8080/api/v1/models");
	});

	it("a count that is no number counts nothing and fails nothing", async () => {
		const monti = site();
		const { output } = await add(monti, { service: "anthropic", name: "Anthropic", secret: ANTHROPIC });
		for (const tokens of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -5, 0])
			await monti.keys.addUsage(output.id, tokens);
		expect(await db.selectFrom("api_key_usage").selectAll().execute()).toEqual([]);
		await monti.keys.addUsage(output.id, 10.4);
		await monti.keys.addUsage(output.id, Number.MAX_VALUE);
		expect((await list(monti)).keys[0].usage.tokens).toBe(10 + Number.MAX_SAFE_INTEGER);
	});
});

/** Every row of every table of the test's database, as text: what a copy of the database would hold. */
async function everythingStored(): Promise<string> {
	const { rows } = await sql<{ name: string }>`
		select table_name as name from information_schema.tables where table_schema = current_schema()
	`.execute(db);
	const tables: Record<string, unknown[]> = {};
	for (const { name } of rows) tables[name] = (await sql`select * from ${sql.table(name)}`.execute(db)).rows;
	return JSON.stringify(tables);
}

describe("the key itself goes nowhere", () => {
	it("14-4 the database holds the key sealed, and no operation's answer, activity row or error carries it", async () => {
		const monti = site();
		const api = signedInApi(monti);
		const seen: string[] = [];
		const call = async (name: string, input: unknown) => {
			const response = await api(
				new Request(`https://site.test/admin/api/operations/${name}`, {
					method: "POST",
					body: JSON.stringify({ input }),
				}),
			);
			const body = await response.text();
			seen.push(body);
			return { status: response.status, body: JSON.parse(body) };
		};

		const added = await call("keys.add", { service: "anthropic", name: "Anthropic", secret: ANTHROPIC });
		expect(added.status).toBe(200);
		const id = added.body.output.id as string;
		// Every way an answer about the key comes back: a refusal, a clash, a bad input, the lists, the change, the removal.
		expect(
			(await call("keys.add", { service: "anthropic", name: "Other", secret: "sk-ant-refused-key-9999" })).status,
		).toBe(422);
		expect((await call("keys.add", { service: "openai", name: "Anthropic", secret: OPENAI })).status).toBe(422);
		expect((await call("keys.add", { service: "openai", secret: OPENAI })).status).toBe(400);
		await call("keys.list", {});
		await call("models.list", { refresh: true });
		await call("meta.capabilities", {});
		await call("keys.update", { id, secret: ANTHROPIC_NEW });
		await call("keys.update", { id, secret: "sk-ant-refused-key-9999" });

		const out: string[] = [];
		expect(
			await runCli(monti, ["keys.add", "--service", "openai", "--name", "OpenAI", "--secret", "-"], {
				out: (line) => out.push(line),
				err: (line) => out.push(line),
				secret: async () => OPENAI,
			}),
		).toBe(0);
		expect(await runCli(monti, ["keys.list"], { out: (line) => out.push(line), err: (line) => out.push(line) })).toBe(
			0,
		);
		expect(
			await runCli(monti, ["keys.add", "--service", "openai", "--name", "Refused", "--secret", "-"], {
				out: (line) => out.push(line),
				err: (line) => out.push(line),
				secret: async () => "sk-refused-key-8888",
			}),
		).toBe(1);

		// While the keys are in: every table, the sealed keys' own included.
		const stored = await everythingStored();
		expect(stored).toContain("7c0e");
		await call("keys.remove", { id });
		// And again after one is removed: what a removal writes (its activity row) is read too.
		const afterRemoval = await everythingStored();
		expect(afterRemoval).toContain("keys.remove");
		const everything = [...seen, ...out, stored, afterRemoval].join("\n");
		for (const key of [ANTHROPIC, ANTHROPIC_NEW, OPENAI, "sk-ant-refused-key-9999", "sk-refused-key-8888"])
			expect(everything).not.toContain(key);
		// What does go out is the ending, and it was looked for in the same text.
		expect(everything).toContain("a1b2");
		expect(everything).toContain("7c0e");
	});

	it("14-4 the assistant reads the list without the keys, and has no tool that takes, changes or removes one", async () => {
		const monti = site();
		const { output } = await add(monti, { service: "anthropic", name: "Anthropic", secret: ANTHROPIC });
		const tools = agentTools(monti).map((tool) => tool.name);
		expect(tools).toEqual(expect.arrayContaining(["keys.list", "models.list", "models.setQuick"]));
		for (const name of ["keys.add", "keys.update", "keys.remove"]) {
			expect(tools).not.toContain(name);
			await expect(
				callAgentTool(
					monti,
					name,
					{ id: output.id, service: "anthropic", name: "X", secret: "k" },
					{
						conversationId: "c1",
						proposalId: "p1",
					},
				),
			).rejects.toBeInstanceOf(UnknownOperationError);
			await expect(monti.run(name, { id: output.id }, { actor: "assistant" })).rejects.toBeInstanceOf(ForbiddenError);
		}
		const session = { conversationId: "c1", proposalId: await monti.proposals.create("c1", "어떤 모델을 쓸 수 있어?") };
		const read = [
			await callAgentTool(monti, "keys.list", {}, session),
			await callAgentTool(monti, "models.list", {}, session),
		];
		expect(JSON.stringify(read)).not.toContain(ANTHROPIC);
		expect(JSON.stringify(read)).toContain("a1b2");
		// The key is still there after everything the assistant tried.
		expect((await monti.keys.open(output.id))?.secret).toBe(ANTHROPIC);
	});

	it("14-4 what only a person may run is never kept as a proposal: its input is refused before it is read or stored", async () => {
		const monti = site();
		const { output } = await add(monti, { service: "anthropic", name: "Anthropic", secret: ANTHROPIC });
		const proposal = await monti.proposals.create("c1", "키를 하나 더 넣어 줘");
		const humanOnly = [...monti.operations.values()].filter((operation) => operation.humanOnly);
		expect(humanOnly.map((operation) => operation.name)).toEqual(
			expect.arrayContaining([
				"keys.add",
				"keys.update",
				"keys.remove",
				"auth.signIn",
				"trash.purge",
				"proposals.discard",
			]),
		);
		const PLAIN = "sk-ant-proposed-key-5e5e";
		for (const operation of humanOnly)
			await expect(
				monti.proposals.add(proposal, operation.name, {
					id: output.id,
					service: "anthropic",
					name: "Proposed",
					secret: PLAIN,
					password: PLAIN,
					confirm: PLAIN,
					email: "someone@site.test",
					ids: [output.id],
				}),
			).rejects.toBeInstanceOf(ForbiddenError);
		expect(await db.selectFrom("monti_proposal_item").selectAll().execute()).toEqual([]);
		expect(await everythingStored()).not.toContain(PLAIN);
		// A write the assistant may propose still becomes an item.
		await monti.proposals.add(proposal, "models.setQuick", { keyId: output.id, model: "claude-opus-5-5" });
		expect(await db.selectFrom("monti_proposal_item").select("operation").execute()).toEqual([
			{ operation: "models.setQuick" },
		]);
	});

	it("14-1 keys stand in the order they were added, also when the clock has not moved between two of them or stands behind", async () => {
		const monti = site();
		const names = ["one", "two", "three", "four", "five", "six"];
		// The same instant for the first four (a clock that does not tick), then a server whose clock is a minute behind.
		for (const name of names.slice(0, 4)) await add(monti, { service: "anthropic", name, secret: ANTHROPIC });
		clock = new Date(clock.getTime() - 60_000);
		for (const name of names.slice(4)) await add(monti, { service: "anthropic", name, secret: ANTHROPIC });
		expect((await list(monti)).keys.map((key) => key.name)).toEqual(names);
		// The first model comes from the first key.
		expect((await models(monti)).keys.map((key) => key.name)).toEqual(names);
	});

	it("14-4 a key is sent to its own service only", async () => {
		const monti = site();
		await add(monti, { service: "anthropic", name: "Anthropic", secret: ANTHROPIC });
		clock = new Date(clock.getTime() + 1000);
		await add(monti, { service: "openai", name: "OpenAI", secret: OPENAI });
		await models(monti, { refresh: true });
		for (const request of net.state.requests) {
			const sent = JSON.stringify(request);
			if (!request.url.startsWith("https://api.anthropic.com/")) expect(sent).not.toContain(ANTHROPIC);
			if (!request.url.startsWith("https://api.openai.com/")) expect(sent).not.toContain(OPENAI);
			// Never in the address, where a server's log would keep it.
			expect(request.url).not.toContain(ANTHROPIC);
			expect(request.url).not.toContain(OPENAI);
			// And never along a redirect to wherever the service points.
			expect(request.redirect).toBe("error");
		}
	});
});
