import { beforeEach, describe, expect, it } from "vitest";
import { signedInApi } from "../__test__/admin";
import { sql, testDatabase } from "../__test__/database";
import { runCli } from "../entry/cli";
import { agentTools, callAgentTool } from "../entry/tools";
import { CheckError, ForbiddenError, UnknownOperationError } from "../errors";
import { createMonti, definePlugin, type MontiOptions } from "../monti";
import type { KeyList, ModelList } from "./operations";
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
		requests: [] as { url: string; headers: Record<string, string> }[],
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
		state.requests.push({ url, headers });
		if (state.down) throw new TypeError("fetch failed");
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
	return { state, fetch };
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
	await sql`truncate api_keys, monti_activity cascade`.execute(db);
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
				usage: { month: "2026-11", tokens: 0 },
				uses: [
					{ for: "assistant", model: "claude-sonnet-5-5" },
					{ for: "quick", model: "claude-haiku-5-5" },
				],
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
		});
		// No key, so no authorization header went out.
		expect(net.state.requests.at(-1)).toEqual({ url: "http://localhost:11434/v1/models", headers: {} });
		expect((await models(monti)).keys[0].models).toEqual([{ id: "llama4", thinking: false, images: false }]);
	});

	it("14-1 a short key shows no ending: four characters would be most of it", async () => {
		const monti = site();
		net.state.taken.add("short-key");
		const added = await add(monti, { service: "anthropic", name: "Short", secret: "short-key" });
		expect(added.output.last4).toBe("");
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
			await runCli(monti, ["keys.add", "--service", "openai", "--name", "OpenAI", "--secret", OPENAI], {
				out: (line) => out.push(line),
				err: (line) => out.push(line),
			}),
		).toBe(0);
		expect(await runCli(monti, ["keys.list"], { out: (line) => out.push(line), err: (line) => out.push(line) })).toBe(
			0,
		);
		expect(
			await runCli(monti, ["keys.add", "--service", "openai", "--name", "Refused", "--secret", "sk-refused-key-8888"], {
				out: (line) => out.push(line),
				err: (line) => out.push(line),
			}),
		).toBe(1);

		const stored = JSON.stringify({
			keys: await db.selectFrom("api_keys").selectAll().execute(),
			activity: await db.selectFrom("monti_activity").selectAll().execute(),
			snapshots: await db.selectFrom("monti_activity_snapshot").selectAll().execute(),
			deliveries: await db.selectFrom("monti_delivery").selectAll().execute(),
		});
		await call("keys.remove", { id });
		const everything = [...seen, ...out, stored].join("\n");
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
		}
	});
});
