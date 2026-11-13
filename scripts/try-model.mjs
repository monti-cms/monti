#!/usr/bin/env node
/**
 * Tries the assistant against a real model service: what the tests can only try on a scripted one (doc 10, T161).
 *
 *   MODEL_SERVICE=anthropic MODEL_ID=claude-haiku-5-5 MODEL_KEY="$(cat …)" TRY_MODEL_DATABASE_URL=postgres://localhost/monti_test \
 *     node scripts/try-model.mjs
 *
 * A site with the assistant plugin is stood up in a schema of its own in `TRY_MODEL_DATABASE_URL`, dropped when the trial ends (the key is
 * stored there sealed, and goes with it). `MODEL_SERVICE` is a service the keys screen knows (`anthropic` for now: the items read Anthropic's
 * stream for what it spent), `MODEL_ID` the model to run on; left out, the models the key lists are printed and nothing is spent. Nothing
 * secret is printed: not the key, not a request's headers (only the version header's value).
 *
 * Every call to the model is metered from the usage the service reports in its stream, at `MODEL_PRICES` (US$ per million tokens: input,
 * cache write, cache read, output; Claude Haiku 5.5's are built in), and the running total is printed after each. At `TRY_MODEL_BUDGET`
 * (US$, default 4) no further call is made, and what was not tried is said. Each call's output is capped (`max_tokens`), the cap per item; an
 * answer the trial cuts off itself is counted at its cap, since the service does not say what it wrote.
 *
 * Each line says what was tried, what the service and the run did, and whether that is what Monti counts on. It ends with 1 when something
 * is not. `TRY_MODEL_ONLY=4,6` runs only those items. The items (T161):
 *   ④ an OpenAI-compatible address with nothing listening ends the run as failed (unreachable); needs no key
 *   ⑤ models.list gives the model's input limit
 *   ⑥ the model id, each thinking level (off, low, medium, high) and the version header are accepted
 *   ⑦ the cache marks (system prompt, last tool, the whole request) are sent and taken; from the second turn some input is read from the cache
 *   ③ a run whose request goes away mid-answer ends interrupted, and going on with it (resume, "continue" on the panel) works; whether the cut answer's usage came
 *   ② an answer cut for length, and one cut inside a tool call: the run ends, and the next request in the conversation is not refused
 *   ① a long think (high) on a hard prompt: when the service thinks over 2 minutes without a word, the turn is not cut
 *   ⑧ (a 429 limit) is not provoked here.
 */
import { randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const requireIn = (pkg) => createRequire(path.join(root, "packages", pkg, "package.json"));
// The packages are TypeScript in the repo: loaded as the `monti` command loads them.
const { createJiti } = await import(pathToFileURL(requireIn("core").resolve("jiti")).href);
const jiti = createJiti(import.meta.url);
const core = await jiti.import(path.join(root, "packages", "core", "src", "index.ts"));
const { assistant } = await jiti.import(path.join(root, "packages", "ai", "src", "index.ts"));
const { Kysely, PostgresDialect } = await import(pathToFileURL(requireIn("core").resolve("kysely")).href);
const { default: pg } = await import(pathToFileURL(requireIn("core").resolve("pg")).href);

const SERVICE = process.env.MODEL_SERVICE ?? "anthropic";
const MODEL = process.env.MODEL_ID;
const KEY = process.env.MODEL_KEY ?? "";
const DATABASE = process.env.TRY_MODEL_DATABASE_URL;
const BUDGET = Number(process.env.TRY_MODEL_BUDGET ?? 4);
const ONLY = process.env.TRY_MODEL_ONLY?.split(",").map((item) => item.trim());

/** What must never be printed, wherever it turns up (a service's error may quote what it was sent). */
const clean = (text) =>
	(KEY ? String(text).split(KEY).join("***") : String(text)).replace(/sk-[A-Za-z0-9_-]{8,}/g, "sk-***");
let failed = 0;
function say(what, did, expected) {
	if (!expected) failed += 1;
	console.log(clean(`${expected ? "ok  " : "FAIL"}  ${what}: ${did}`));
}
const note = (text) => console.log(clean(`note  ${text}`));
const firstLine = (error) => `${error?.name ?? "Error"}: ${String(error?.message ?? error).split("\n")[0]}`;

if (!DATABASE) {
	console.error(
		"Set TRY_MODEL_DATABASE_URL (a Postgres database; the trial makes a schema of its own there and drops it).",
	);
	process.exit(1);
}
if (SERVICE !== "anthropic") {
	// The meter reads Anthropic's stream; another service's stream needs its own reading before its money can be counted.
	console.error(`The trial meters only Anthropic's stream so far; "${SERVICE}" is not tried.`);
	process.exit(1);
}

// --- The meter -----------------------------------------------------------------------------------------------------------------------

/** US$ per million tokens: input, cache write (5 minutes), cache read, output; and the same over 100,000 tokens of prompt. */
const PRICES = {
	// https://platform.claude.com/docs/en/about-claude/pricing, read 2026-11-13.
	"claude-haiku-5-5": { short: [0.1, 0.125, 0.01, 0.5], long: [0.5, 0.625, 0.05, 2.5], over: 100_000 },
};
const given = process.env.MODEL_PRICES?.split(",").map(Number);
const prices = given?.length === 4 ? { short: given, long: given, over: Infinity } : PRICES[MODEL];
let spent = 0;
let cap = 1024;
/** Each call to the model, in order: what was sent and what the stream said. */
const calls = [];
const money = (value) => `US$${value.toFixed(4)}`;

function cost(usage) {
	const prompt = usage.input + usage.write + usage.read;
	const [input, write, read, output] = prompt > prices.over ? prices.long : prices.short;
	return (usage.input * input + usage.write * write + usage.read * read + usage.output * output) / 1_000_000;
}

/** Reads a copy of Anthropic's stream: the usage, how it stopped, and when its thinking and its first words came. */
async function meter(stream, call) {
	const decoder = new TextDecoder();
	let buffer = "";
	const usage = { input: 0, write: 0, read: 0, output: 0 };
	const take = (from) => {
		if (!from) return;
		if (typeof from.input_tokens === "number") usage.input = from.input_tokens;
		if (typeof from.cache_creation_input_tokens === "number") usage.write = from.cache_creation_input_tokens;
		if (typeof from.cache_read_input_tokens === "number") usage.read = from.cache_read_input_tokens;
		if (typeof from.output_tokens === "number") usage.output = from.output_tokens;
	};
	let whole = false;
	try {
		for await (const chunk of stream) {
			buffer += decoder.decode(chunk, { stream: true });
			const lines = buffer.split("\n");
			buffer = lines.pop() ?? "";
			for (const line of lines) {
				if (!line.startsWith("data:")) continue;
				let event;
				try {
					event = JSON.parse(line.slice(5));
				} catch {
					continue;
				}
				const at = Date.now() - call.started;
				if (event.type === "message_start") take(event.message?.usage);
				else if (event.type === "content_block_start") {
					const kind = event.content_block?.type;
					call.blocks.push(kind);
					if (kind === "thinking" && call.thinkingFrom === undefined) call.thinkingFrom = at;
					if (kind === "text" && call.textAt === undefined) call.textAt = at;
				} else if (event.type === "content_block_stop" && call.blocks.at(-1) === "thinking") call.thinkingTo = at;
				else if (event.type === "message_delta") {
					take(event.usage);
					call.stop = event.delta?.stop_reason ?? call.stop;
				} else if (event.type === "message_stop") whole = true;
			}
		}
	} catch {
		// The trial's own stop, or the connection: what came is what is known.
	}
	// An answer the trial cut off is counted at its cap: the service does not say what it wrote before the cut.
	if (!whole) usage.output = Math.max(usage.output, call.cap);
	call.usage = usage;
	call.cost = cost(usage);
	spent += call.cost;
	console.log(
		`      call ${calls.indexOf(call) + 1}: in ${usage.input}, cache write ${usage.write}, cache read ${usage.read}, out ${usage.output}` +
			`${whole ? "" : " (cut off: counted at its cap)"}, ${money(call.cost)}; ${money(spent)} so far`,
	);
}

const realFetch = globalThis.fetch;
const MESSAGES = "https://api.anthropic.com/v1/messages";
globalThis.fetch = async (input, init) => {
	const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
	if (!url.startsWith(MESSAGES)) return realFetch(input, init);
	if (spent >= BUDGET) throw new Error(`The trial's budget (${money(BUDGET)}) is spent: no further call is made.`);
	const sent = JSON.parse(init.body);
	const call = {
		started: Date.now(),
		cap,
		blocks: [],
		version: new Headers(init.headers).get("anthropic-version"),
		marks: {
			request: sent.cache_control?.type === "ephemeral",
			system: Array.isArray(sent.system) && sent.system.some((block) => block.cache_control?.type === "ephemeral"),
			lastTool: sent.tools?.at(-1)?.cache_control?.type === "ephemeral",
		},
		thinking: sent.thinking ?? null,
		effort: sent.output_config?.effort ?? null,
		tools: sent.tools?.length ?? 0,
	};
	calls.push(call);
	// The output is capped for the trial's money: the only change made to what Monti sends.
	sent.max_tokens = Math.min(sent.max_tokens ?? cap, cap);
	const answer = await realFetch(input, { ...init, body: JSON.stringify(sent) });
	call.status = answer.status;
	if (!answer.ok || !answer.body) {
		call.usage = { input: 0, write: 0, read: 0, output: 0 };
		call.cost = 0;
		console.log(`      call ${calls.length}: HTTP ${answer.status}, nothing billed; ${money(spent)} so far`);
		return answer;
	}
	const [mine, theirs] = answer.body.tee();
	call.metered = meter(theirs, call);
	return new Response(mine, { status: answer.status, statusText: answer.statusText, headers: answer.headers });
};
/** Waits for the calls' streams to be read to their end, so the total is whole. */
const settled = () => Promise.all(calls.map((call) => call.metered));

// --- The site ------------------------------------------------------------------------------------------------------------------------

const schemaName = `try_model_${randomBytes(6).toString("hex")}`;
const admin = new pg.Pool({ connectionString: DATABASE, max: 1 });
await admin.query(`create schema ${schemaName}`);
const db = new Kysely({
	dialect: new PostgresDialect({
		pool: new pg.Pool({ connectionString: DATABASE, options: `-c search_path=${schemaName}` }),
	}),
});
const schema = core.defineSchema({
	locales: { source: "ko", list: [{ code: "ko", name: "한국어" }], prefix: "never" },
	collections: {
		post: {
			kind: "document",
			path: "/posts/:slug",
			fields: {
				title: { kind: "text", required: true },
				slug: { kind: "slug", required: true },
				summary: { kind: "text", max: 120 },
				body: { kind: "text" },
			},
		},
	},
});

const skipped = [];
let monti;
try {
	await core.migrateToLatest(db);
	await core.migrateContent(db, schema, []);
	monti = core.createMonti({ db, schema, secret: randomBytes(24).toString("hex"), plugins: [assistant()] });
	await main();
} catch (error) {
	say("the trial", `it threw (${firstLine(error)})`, false);
} finally {
	await settled();
	await db.destroy();
	await admin.query(`drop schema ${schemaName} cascade`);
	await admin.end();
}
console.log(`\nSpent: ${money(spent)} over ${calls.length} calls to the model.`);
if (skipped.length > 0) console.log(`Not tried: ${skipped.join("; ")}`);
console.log(failed === 0 ? "Everything Monti counts on held." : `${failed} not as Monti counts on.`);
process.exit(failed === 0 ? 0 : 1);

// --- The items -----------------------------------------------------------------------------------------------------------------------

/** One run of the assistant, to its end: its events, its end, how long it took, and the model calls it made. */
async function run(input, { abortAfterText = false } = {}) {
	const control = new AbortController();
	const events = [];
	const from = calls.length;
	const started = Date.now();
	for await (const event of monti.stream("assistant.run", input, {
		actor: "admin",
		session: null,
		signal: control.signal,
	})) {
		events.push(event);
		if (abortAfterText && event.type === "text" && !control.signal.aborted) control.abort();
	}
	await settled();
	const end = events.findLast((event) => event.type === "end");
	return {
		events,
		end,
		runId: events.find((event) => event.type === "run")?.runId,
		conversationId: events.find((event) => event.type === "run")?.conversationId,
		text: events.flatMap((event) => (event.type === "text" ? [event.delta] : [])).join(""),
		usage: events.findLast((event) => event.type === "usage"),
		seconds: (Date.now() - started) / 1000,
		calls: calls.slice(from),
	};
}
function ended(result) {
	return `${result.end?.status}${result.end?.reason ? ` (${result.end.reason})` : ""}${result.end?.error ? ` (${result.end.error.kind}: ${result.end.error.detail})` : ""}`;
}

function wanted(id) {
	return !ONLY || ONLY.includes(id);
}
/** An item, unless the budget is spent: then it is said not to be tried. A throw is a failure that is said, and the rest goes on. */
async function item(id, what, outputCap, body) {
	if (!wanted(id)) return;
	if (id !== "4" && spent >= BUDGET) {
		skipped.push(`${id} ${what} (the budget is spent)`);
		return;
	}
	console.log(`\n${id}  ${what}`);
	cap = outputCap;
	try {
		await body();
	} catch (error) {
		say(what, `it threw (${firstLine(error)})`, false);
	}
}

async function main() {
	await item("4", "an OpenAI-compatible address with nothing listening", 0, async () => {
		// A server that answers the key's check, then is turned off: the run finds nothing at the address.
		const server = createServer((_request, response) => {
			response.setHeader("content-type", "application/json");
			response.end(JSON.stringify({ data: [{ id: "off-model" }] }));
		});
		await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
		const address = `http://127.0.0.1:${server.address().port}/v1`;
		const added = await monti.run(
			"keys.add",
			{ service: "openai-compatible", name: "Off", baseUrl: address, secret: "" },
			{ actor: "admin" },
		);
		await new Promise((resolve) => server.close(resolve));
		const keyId = added.output?.id ?? added.id;
		const result = await run({ request: "Say ok.", model: { keyId, model: "off-model" } });
		say("a run on it", ended(result), result.end?.status === "failed" && result.end?.error?.kind === "unreachable");
		await monti.run("keys.remove", { id: keyId }, { actor: "admin" }).catch(() => {});
	});

	if (!KEY) {
		console.log("\nskip  the rest needs MODEL_KEY");
		return;
	}
	const added = await monti.run("keys.add", { service: SERVICE, name: "Trial", secret: KEY }, { actor: "admin" });
	const keyId = added.output?.id ?? added.id;
	const listed = await monti.run("models.list", {}, { actor: "admin" });
	const models = listed.keys.find((key) => key.id === keyId)?.models ?? [];
	if (!MODEL) {
		console.log("\nThe key's models (set MODEL_ID to one of them to try it):");
		for (const model of models)
			console.log(
				`  ${model.id}${model.context ? `, input limit ${model.context}` : ""}${model.thinking ? ", thinks" : ""}`,
			);
		return;
	}
	if (!prices) {
		console.error(
			`No prices for ${MODEL}: set MODEL_PRICES (US$ per million tokens: input,cache write,cache read,output).`,
		);
		failed += 1;
		return;
	}
	const model = { keyId, model: MODEL };

	await item("5", "the model list gives the input limit", 0, async () => {
		const found = models.find((each) => each.id === MODEL);
		say(
			"the key's check and the model list (its version header accepted)",
			`${models.length} models`,
			models.length > 0,
		);
		say(`${MODEL} is listed`, JSON.stringify(found ?? null), found !== undefined);
		say("its input limit", `${found?.context ?? "none"} tokens`, (found?.context ?? 0) > 0);
	});

	let medium;
	await item("6", "the model id, each thinking level and the version header", 256, async () => {
		for (const thinking of ["off", "low", "medium", "high"]) {
			const result = await run({ request: "Reply with the single word: ok", model, thinking });
			const sent = result.calls[0];
			say(
				`thinking ${thinking}`,
				`${ended(result)}, "${result.text.trim().slice(0, 40)}", sent thinking ${JSON.stringify(sent?.thinking)}, effort ${sent?.effort}, HTTP ${sent?.status}`,
				result.end?.status === "done" && sent?.status === 200,
			);
			if (thinking === "medium") medium = result;
		}
		const versions = [...new Set(calls.map((call) => call.version))];
		note(`the messages requests carried anthropic-version ${versions.join(", ")} (the AI SDK's own)`);
	});

	await item("7", "the cache marks, and the cache read from the second turn", 256, async () => {
		const first = medium ?? (await run({ request: "Reply with the single word: ok", model, thinking: "medium" }));
		const marks = first.calls[0]?.marks;
		say("the marks sent", JSON.stringify(marks), marks?.request && marks?.system && marks?.lastTool);
		say("the first turn's request was taken", `HTTP ${first.calls[0]?.status}`, first.calls[0]?.status === 200);
		const second = await run({
			conversation: first.conversationId,
			request: "And once more: reply with the single word: ok",
			model,
			thinking: "medium",
		});
		const call = second.calls[0];
		say(
			"the second turn, as the service counted it",
			`input ${call?.usage?.input}, cache write ${call?.usage?.write}, cache read ${call?.usage?.read}`,
			(call?.usage?.read ?? 0) > 0,
		);
		say(
			"the second turn, as the run tells it (`cached`)",
			JSON.stringify(second.usage),
			(second.usage?.cached ?? 0) > 0 && second.usage.cached === call?.usage?.read,
		);
	});

	await item("3", "the request goes away mid-answer, then it is gone on with", 600, async () => {
		const cut = await run(
			{ request: "Write a short story of about 250 words about a lighthouse keeper.", model, thinking: "off" },
			{ abortAfterText: true },
		);
		say("the run whose request went away", ended(cut), cut.end?.status === "interrupted");
		const stored = await db
			.selectFrom("runs")
			.select(["status", "ended", "usage"])
			.where("id", "=", cut.runId)
			.executeTakeFirst();
		note(
			`the cut answer's usage: the stream gave input ${cut.calls[0]?.usage?.input} at its start and no output count; the run stored ${JSON.stringify(stored?.usage)}`,
		);
		const resumed = await run({ resume: cut.runId });
		say(
			"going on with it (resume)",
			`${ended(resumed)}, ${resumed.text.length} characters`,
			resumed.end?.status === "done" && resumed.text.length > 0,
		);
	});

	await item("2", "an answer cut for length, then the next request", 120, async () => {
		const long = await run({
			request: "Write an essay of at least 1,500 words on the history of printing. Begin at once, with no preface.",
			model,
			thinking: "off",
		});
		say(
			"an answer cut by the output limit",
			`${ended(long)}, stop ${long.calls.at(-1)?.stop}, ${long.text.length} characters kept`,
			long.end?.status === "done" && long.calls.at(-1)?.stop === "max_tokens",
		);
		const after = await run({
			conversation: long.conversationId,
			request: "Reply with the single word: ok",
			model,
			thinking: "off",
		});
		say(
			"the next request in that conversation",
			`${ended(after)}, HTTP ${after.calls[0]?.status}`,
			after.end?.status === "done",
		);

		cap = 600;
		const made = await monti.run(
			"entries.create",
			{ collection: "post", locale: "ko", title: "글" },
			{ actor: "admin" },
		);
		const id = made.output?.id;
		const inCall = await run({
			request: `Propose a body for the post ${id}: a text of at least 800 words on lighthouses, put straight into the body field with one tool call. Do not read anything first and write nothing before the call.`,
			model,
			thinking: "off",
		});
		const last = inCall.calls.at(-1);
		say(
			"an answer cut inside a tool call",
			`${ended(inCall)}, stop ${last?.stop}, blocks ${last?.blocks.join(" ")}`,
			inCall.end?.status === "done" && last?.stop === "max_tokens",
		);
		if (last?.blocks.at(-1) !== "tool_use") note("the cut did not fall inside a tool call this time");
		const next = await run({
			conversation: inCall.conversationId,
			request: "Reply with the single word: ok",
			model,
			thinking: "off",
		});
		say(
			"the next request in that conversation",
			`${ended(next)}, HTTP ${next.calls[0]?.status}`,
			next.end?.status === "done",
		);
	});

	await item("1", "a long think on a hard prompt (high)", 64_000, async () => {
		const result = await run({
			request:
				"Without using any tool, multiply exactly: 738294017365820194736501928374650192837465019283 × 918273645501928374655019283746501928374655012345. Do it digit by digit, check it a second way, then give only the product.",
			model,
			thinking: "high",
		});
		const call = result.calls[0];
		const thought =
			call?.thinkingTo !== undefined && call?.thinkingFrom !== undefined
				? (call.thinkingTo - call.thinkingFrom) / 1000
				: 0;
		const silent = (call?.textAt ?? call?.thinkingTo ?? 0) / 1000;
		say(
			"the turn",
			`${ended(result)}, thought ${thought.toFixed(1)} s, first words after ${silent.toFixed(1)} s, ${result.seconds.toFixed(1)} s in all`,
			result.end?.status === "done",
		);
		if (silent <= 120) note("it did not go 2 minutes without a word: a turn kept through a long think stays untried");
	});
	skipped.push("8 a 429 limit (not provoked)");
}
