import { CmsError, defineOperation } from "@monti-cms/core/server";
import { fakeCms } from "@monti-cms/core/testing";
import type { Tool } from "ai";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { testConfig } from "../../test/site";
import {
	capResult,
	createAgentTools,
	MAX_SAME_CALLS,
	MAX_TOOL_RESULT_CHARS,
	REPEAT_MESSAGE,
	toolNameOf,
} from "../agent-tools";

const admin = { userId: "u1", accountId: "a1", isAdmin: true as const };

const calls: unknown[] = [];

const probe = [
	defineOperation({
		name: "probe.echo",
		kind: "read",
		describe: "Echoes its input and who ran it.",
		input: () => z.object({ text: z.string() }),
		run: ({ text }, { auth }) => {
			calls.push(text);
			return { text, by: auth.userId };
		},
	}),
	defineOperation({
		name: "probe.fail",
		kind: "read",
		describe: "Always fails with a not found.",
		input: () => z.object({}),
		run: () => {
			throw new CmsError("There is nothing here", "not_found");
		},
	}),
	defineOperation({
		name: "probe.bug",
		kind: "read",
		describe: "Fails with something that is not a CmsError.",
		input: () => z.object({}),
		run: () => {
			throw new Error("secret internals");
		},
	}),
	defineOperation({
		name: "probe.big",
		kind: "read",
		describe: "Returns far too much.",
		input: () => z.object({}),
		run: () => ({ rows: Array.from({ length: 5_000 }, (_, i) => `row number ${i}`) }),
	}),
];

const cms = fakeCms({ config: testConfig, plugins: [{ name: "probe", operations: probe }] });

const run = (tool: Tool | undefined, input: unknown = {}) =>
	(tool?.execute as (input: unknown, options: object) => Promise<unknown>)(input, { toolCallId: "c", messages: [] });

describe("the tools of the agent", () => {
	it("has one tool for every read operation, named with `_`, described and shaped by the operation", async () => {
		const tools = await createAgentTools({ cms, auth: admin });
		const reads = (await cms.operations()).filter((operation) => operation.kind === "read");
		expect(reads.length).toBeGreaterThan(1);
		expect(Object.keys(tools).sort()).toEqual(reads.map((operation) => toolNameOf(operation.name)).sort());
		for (const operation of reads) {
			const tool = tools[toolNameOf(operation.name)];
			expect(tool?.description).toBe(operation.describe);
			const { $schema: _schema, ...schema } = operation.jsonSchema as Record<string, unknown>;
			expect((tool?.inputSchema as { jsonSchema: unknown }).jsonSchema).toEqual(schema);
		}
		expect(toolNameOf("entries.checkPublish")).toBe("entries_checkPublish");
	});

	it("runs the operation as the signed-in admin", async () => {
		const tools = await createAgentTools({ cms, auth: admin });
		expect(await run(tools.probe_echo, { text: "hi" })).toEqual({ text: "hi", by: "u1" });
	});

	it("answers a failed operation with its code and message so the model can recover, and hides a bug's details", async () => {
		const tools = await createAgentTools({ cms, auth: admin });
		expect(await run(tools.probe_fail)).toEqual({ error: { code: "not_found", message: "There is nothing here" } });
		expect(await run(tools.probe_bug)).toEqual({ error: { code: "internal_error", message: "The operation failed." } });
		// An input that does not fit names the field.
		const invalid = (await run(tools.probe_echo, { text: 5 })) as { error: { code: string; message: string } };
		expect(invalid.error.code).toBe("invalid_input");
		expect(invalid.error.message).toContain("text");
	});

	it("cuts a result over the limit and tells the model to narrow the query", async () => {
		const tools = await createAgentTools({ cms, auth: admin });
		const result = (await run(tools.probe_big)) as { cut: true; note: string; partial: string };
		expect(result.cut).toBe(true);
		expect(result.partial).toHaveLength(MAX_TOOL_RESULT_CHARS);
		expect(result.note).toMatch(/narrow/i);
		const small = { rows: ["a"] };
		expect(capResult(small)).toBe(small);
	});

	it("does not run the same tool with the same input a third time in a row", async () => {
		const tools = await createAgentTools({ cms, auth: admin });
		calls.length = 0;
		const answers = [];
		for (let i = 0; i < MAX_SAME_CALLS + 1; i++) answers.push(await run(tools.probe_echo, { text: "same" }));
		expect(calls).toHaveLength(MAX_SAME_CALLS - 1);
		expect(answers.slice(MAX_SAME_CALLS - 1)).toEqual([REPEAT_MESSAGE, REPEAT_MESSAGE]);
		// A different input, or another call in between, starts the count again.
		expect(await run(tools.probe_echo, { text: "other" })).toMatchObject({ text: "other" });
		expect(await run(tools.probe_echo, { text: "same" })).toMatchObject({ text: "same" });
	});

	it("counts repeats per request: a new request starts with a clean count", async () => {
		calls.length = 0;
		for (let request = 0; request < 2; request++) {
			const tools = await createAgentTools({ cms, auth: admin });
			await run(tools.probe_echo, { text: "again" });
			await run(tools.probe_echo, { text: "again" });
		}
		expect(calls).toHaveLength(4);
	});

	it("offers the editor tools, which the browser answers, only when an entry is open", async () => {
		const closed = await createAgentTools({ cms, auth: admin });
		expect(closed.editor_read).toBeUndefined();
		expect(closed.editor_selection).toBeUndefined();
		const open = await createAgentTools({ cms, auth: admin, entryId: "e1" });
		for (const name of ["editor_read", "editor_selection"]) {
			expect(open[name]?.description).toBeTruthy();
			expect(open[name]?.execute).toBeUndefined();
		}
		expect(open.editor_read?.description).toMatch(/unsaved/i);
	});
});
