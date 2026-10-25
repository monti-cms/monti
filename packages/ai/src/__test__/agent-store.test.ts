import { createMemoryPluginStorage } from "@monti-cms/core/testing";
import { describe, expect, it } from "vitest";
import {
	type AgentRunValue,
	createAgentRunStore,
	createToolSupportStore,
	fitsRun,
	MAX_RUN_CHARS,
	MAX_RUNS_PER_ADMIN,
	NO_USAGE,
	titleOf,
} from "../agent-store";
import { AI_COLLECTIONS } from "../collections";

const storage = () => createMemoryPluginStorage().storage("ai");

const value = (adminId: string, patch: Partial<AgentRunValue> = {}): AgentRunValue => ({
	adminId,
	title: "t",
	status: "done",
	messages: [],
	usage: NO_USAGE,
	...patch,
});

describe("stored agent runs", () => {
	it("returns a run only to the admin who started it, even when ids share a prefix", async () => {
		const runs = createAgentRunStore(storage().collection(AI_COLLECTIONS.agentRuns));
		await runs.create("r1", value("a"));
		await runs.create("r2", value("a/b"));
		expect((await runs.get("a", "r1"))?.id).toBe("r1");
		expect(await runs.get("b", "r1")).toBeNull();
		expect(await runs.get("a", "r2")).toBeNull();
		expect((await runs.list("a", { page: 1, pageSize: 10 })).items.map((run) => run.id)).toEqual(["r1"]);
		expect((await runs.list("a/b", { page: 1, pageSize: 10 })).items.map((run) => run.id)).toEqual(["r2"]);
	});

	it("saves over a run and keeps its start time", async () => {
		const runs = createAgentRunStore(storage().collection(AI_COLLECTIONS.agentRuns));
		const created = await runs.create("r1", value("a", { status: "running" }));
		const saved = await runs.save("r1", value("a", { status: "done", messages: [{ id: "m" }] }));
		expect(saved).toMatchObject({ status: "done", messages: [{ id: "m" }] });
		expect(saved.createdAt).toEqual(created.createdAt);
	});

	it("keeps a limited number of runs per admin, dropping the oldest", async () => {
		const runs = createAgentRunStore(storage().collection(AI_COLLECTIONS.agentRuns));
		await runs.create("other", value("b"));
		for (let i = 0; i < MAX_RUNS_PER_ADMIN + 3; i++) await runs.create(`r${i}`, value("a"));
		const list = await runs.list("a", { page: 1, pageSize: 50 });
		expect(list.total).toBe(MAX_RUNS_PER_ADMIN);
		expect(await runs.get("a", "r0")).toBeNull();
		expect(await runs.get("a", `r${MAX_RUNS_PER_ADMIN + 2}`)).not.toBeNull();
		expect(await runs.get("b", "other")).not.toBeNull();
	});

	it("takes the line of the list from the first message of the admin, and measures what a run may store", () => {
		const user = (text: string) => ({ role: "user", parts: [{ type: "text", text }] });
		expect(titleOf([{ role: "assistant", parts: [] }, user("  Which   posts\nare drafts? ")])).toBe(
			"Which posts are drafts?",
		);
		expect(titleOf([user("x".repeat(500))])).toHaveLength(80);
		expect(fitsRun([user("short")])).toBe(true);
		expect(fitsRun([user("x".repeat(MAX_RUN_CHARS))])).toBe(false);
	});
});

describe("stored tool support", () => {
	it("keeps what was found per connection and model, and forgets a connection", async () => {
		const support = createToolSupportStore(storage().collection(AI_COLLECTIONS.agentTools));
		expect(await support.getToolSupport()).toEqual({});
		await support.saveToolSupport({ providerId: "p1", model: "a", supported: true });
		await support.saveToolSupport({ providerId: "p1", model: "b", supported: false });
		await support.saveToolSupport({ providerId: "p2", model: "a", supported: false });
		await support.saveToolSupport({ providerId: "p1", model: "a", supported: false });
		expect(await support.getToolSupport()).toEqual({ p1: { a: false, b: false }, p2: { a: false } });
		await support.clearToolSupport("p1");
		await support.clearToolSupport("never-there");
		expect(await support.getToolSupport()).toEqual({ p2: { a: false } });
	});
});
