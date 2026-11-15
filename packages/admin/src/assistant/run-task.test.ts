import { describe, expect, it } from "vitest";
import type { StreamTransport, Transport } from "../operations/transport";
import { nextOf, startTask } from "./run-task";

/** The admin's words, as the keys and their values: what a line would say. */
const t = (key: string, values?: Record<string, string | number>) =>
	values ? `${key}(${Object.values(values).join(",")})` : key;

/** A stream of these events, one request after another; a request with no events left is refused with no answer. */
/** How each run stands on the server (`assistant.runState`), by its id. */
type States = Record<string, { status: string; end: unknown; answer?: string; proposed?: boolean }>;

function server(requests: unknown[][], states: States = {}) {
	const asked: unknown[] = [];
	const stopped: unknown[] = [];
	const streams: StreamTransport = async (_name, input) => {
		asked.push(input);
		const events = requests.shift();
		if (!events) return { status: 0, body: null };
		return {
			status: 200,
			events: (async function* () {
				for (const event of events) {
					if (event === "cut") throw new Error("The connection went.");
					yield event;
				}
			})(),
		};
	};
	const transport: Transport = async (name, input) => {
		if (name === "assistant.stop") stopped.push(input);
		if (name === "assistant.runState") {
			const state = states[(input as { run: string }).run];
			return state
				? { status: 200, body: { id: "r1", conversationId: "c1", answer: "", proposed: false, ...state } }
				: { status: 404, body: { reason: { key: "assistant.noRun" } } };
		}
		return { status: 200, body: {} };
	};
	return { deps: { streams, transport, t, language: "ko" }, asked, stopped };
}

const opened = { type: "run", runId: "r1", conversationId: "c1" };
const end = (status: string, more: Record<string, unknown> = {}) => ({ type: "end", untaken: [], status, ...more });

describe("the runner every small AI task shares (doc 10)", () => {
	it("10 a request whose time is up goes on by itself from where it was, and says the admin's language only when it is asked", async () => {
		const { deps, asked } = server([
			[opened, { type: "text", delta: "반쯤 " }, { type: "proposal" }, end("interrupted", { reason: "time" })],
			[opened, { type: "text", delta: "끝." }, end("done")],
		]);
		const answer = await startTask(deps, { request: "번역" }).ended;
		expect(asked).toEqual([{ request: "번역", language: "ko" }, { resume: "r1" }]);
		expect(answer).toMatchObject({ status: "done", proposed: true, why: null, answer: "반쯤 끝.", run: "r1" });
	});

	it("10 a failed run says why in the admin's one line, and a missing key cannot be tried again", async () => {
		const failed = (reason: string) => server([[opened, end("failed", { error: { reason, keyName: "개인" } })]]).deps;
		expect(await startTask(failed("unreachable"), { request: "줄여 줘" }).ended).toMatchObject({
			status: "failed",
			why: "failure.unreachable(개인)",
			retry: true,
		});
		expect(await startTask(failed("noKey"), { request: "줄여 줘" }).ended).toMatchObject({ retry: false });
	});

	it("10 reaching the turns or tokens is a place to go on from, not a failure", async () => {
		const { deps } = server([[opened, end("interrupted", { reason: "turns" })]]);
		const ended = await startTask(deps, { request: "번역" }).ended;
		expect(ended).toMatchObject({ status: "interrupted", why: "panel.limit" });
		expect(ended && nextOf(ended)).toBe("goOn");
	});

	it("10 a request the host cut is read where it stands and goes on once; cut again at the same place, it stops and leaves it to the person", async () => {
		const stillThere = { r1: { status: "interrupted", end: { status: "interrupted", reason: "connection" } } };
		const once = server(
			[
				[opened, { type: "text", delta: "끊긴 말" }, "cut"],
				[opened, end("done")],
			],
			stillThere,
		);
		expect(await startTask(once.deps, { request: "번역" }).ended).toMatchObject({ status: "done", answer: "" });
		expect(once.asked.at(-1)).toEqual({ resume: "r1" });
		const twice = server(
			[
				[opened, "cut"],
				[opened, "cut"],
				[opened, end("done")],
			],
			stillThere,
		);
		const ended = await startTask(twice.deps, { request: "번역" }).ended;
		expect(ended).toMatchObject({ status: "interrupted", why: "panel.dropped" });
		expect(twice.asked).toHaveLength(2);
		expect(ended && nextOf(ended)).toBe("goOn");
	});

	it("10 a run that ended while its request was cut is read as it ended, and nothing more is asked", async () => {
		const ended = { r1: { status: "done", end: { status: "done" } } };
		const { deps, asked } = server([[opened, { type: "proposal" }, "cut"]], ended);
		expect(await startTask(deps, { request: "번역" }).ended).toMatchObject({ status: "done", proposed: true });
		expect(asked).toHaveLength(1);
	});

	it("10 a run that answered and ended just before its request was cut keeps the answer it stored", async () => {
		const answered = { r1: { status: "done", end: { status: "done" }, answer: "그대로 두는 게 낫겠습니다." } };
		const { deps } = server([[opened, { type: "text", delta: "그대로 두는" }, "cut"]], answered);
		expect(await startTask(deps, { request: "줄여 줘" }).ended).toMatchObject({
			status: "done",
			answer: "그대로 두는 게 낫겠습니다.",
		});
	});

	it("10 'go on' for a run another page has taken up already reads that run: it does not fail or start anew", async () => {
		const done = { r1: { status: "done", end: { status: "done" }, answer: "다 했습니다.", proposed: true } };
		const { deps, asked } = server([], done);
		const busy: StreamTransport = async (_name, input) => {
			asked.push(input);
			return { status: 409, body: { reason: { key: "assistant.busy" } } };
		};
		expect(await startTask({ ...deps, streams: busy }, { resume: "r1", more: true }).ended).toMatchObject({
			status: "done",
			run: "r1",
			answer: "다 했습니다.",
			proposed: true,
		});
		expect(asked).toEqual([{ resume: "r1", more: true }]);
	});

	it("10 going on refused because the server is ahead (another page has the run) reads the run and does not go on from here", async () => {
		const elsewhere = { r1: { status: "interrupted", end: { status: "interrupted", reason: "time" } } };
		const { deps, asked } = server([[opened, end("interrupted", { reason: "time" })]], elsewhere);
		const busy: StreamTransport = async (name, input, options) => {
			if (asked.length === 0) return deps.streams(name, input, options);
			asked.push(input);
			return { status: 409, body: { reason: { key: "assistant.busy" } } };
		};
		expect(await startTask({ ...deps, streams: busy }, { request: "번역" }).ended).toMatchObject({
			status: "interrupted",
		});
		expect(asked).toEqual([{ request: "번역", language: "ko" }, { resume: "r1" }]);
	});

	it("10 a request refused before any run began says the server's reason; no answer at all is a lost connection", async () => {
		const refusing: StreamTransport = async () => ({
			status: 409,
			body: { reason: { key: "assistant.failed", values: { reason: "noKey", keyName: null } } },
		});
		const { deps } = server([]);
		expect(await startTask({ ...deps, streams: refusing }, { request: "번역" }).ended).toMatchObject({
			status: "failed",
			why: "failure.noKey(AI)",
			retry: false,
		});
		expect(await startTask(deps, { request: "번역" }).ended).toMatchObject({ status: "failed", why: "panel.dropped" });
	});

	it("10 stop tells the run to stop as soon as it says which run it is, and a stopped run does not go on by itself", async () => {
		let open = () => {};
		const gate = new Promise<void>((resolve) => {
			open = resolve;
		});
		const { deps, asked, stopped } = server([]);
		const streams: StreamTransport = async (_name, input) => {
			asked.push(input);
			return {
				status: 200,
				events: (async function* () {
					await gate;
					yield opened;
					yield end("interrupted", { reason: "time" });
				})(),
			};
		};
		const task = startTask({ ...deps, streams }, { request: "번역" });
		task.stop();
		open();
		expect(await task.ended).toMatchObject({ status: "stopped" });
		expect(stopped).toEqual([{ run: "r1" }]);
		expect(asked).toHaveLength(1);
	});
});
