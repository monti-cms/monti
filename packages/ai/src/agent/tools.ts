import { randomUUID } from "node:crypto";
import { type AdminRequest, type Cms, CmsError, pluginLog } from "@monti-cms/core/server";
import { jsonSchema, type Tool, tool } from "ai";
import { AI_PLUGIN_NAME } from "../name";
import { overlay } from "./overlay";
import { itemOf, type Proposal, type ProposalItem, type ProposalStore } from "./proposals";

const log = pluginLog(AI_PLUGIN_NAME);

/** A tool result larger than this many characters (as JSON) is cut. */
export const MAX_TOOL_RESULT_CHARS = 20_000;
/** The same tool with the same input this many times in a row is not run again. */
export const MAX_SAME_CALLS = 3;

export const REPEAT_MESSAGE =
	"You already called this with the same input; change the query or answer with what you have";

/** `entries.list` is called `entries_list` by the model: providers accept letters, digits, `_` and `-` in tool names. */
export const toolNameOf = (operation: string) => operation.replaceAll(".", "_");

/** What the model gets back for a call it can recover from: the code and message of the failure, never a failed run. */
export interface ToolError {
	error: { code: string; message: string };
}

/** The result as the model reads it: itself, or when its JSON is longer than {@link MAX_TOOL_RESULT_CHARS}, its start with a note to narrow the query. */
export function capResult(result: unknown): unknown {
	const text = JSON.stringify(result) ?? "null";
	if (text.length <= MAX_TOOL_RESULT_CHARS) return result;
	return {
		cut: true,
		note: `The result was longer than ${MAX_TOOL_RESULT_CHARS} characters and was cut. Narrow the query (a smaller page, a filter, a single id) to see the rest.`,
		partial: text.slice(0, MAX_TOOL_RESULT_CHARS),
	};
}

/** A failed operation as a tool result. An invalid input names the fields, so the model can fix the call. */
function failure(error: unknown): ToolError {
	if (error instanceof CmsError) {
		const issues = (error.issues ?? [])
			.slice(0, 5)
			.map((issue) => {
				const { path, message } = issue as { path?: unknown[]; message?: unknown };
				return `${(path ?? []).join(".") || "input"}: ${String(message)}`;
			})
			.join("; ");
		return { error: { code: error.code, message: issues ? `${error.message} (${issues})` : error.message } };
	}
	log.error("an operation failed in an agent run:", error);
	return { error: { code: "internal_error", message: "The operation failed." } };
}

/** The run the tools belong to, and where its proposal is kept. */
export interface AgentToolsRun {
	readonly adminId: string;
	readonly runId: string;
	/** What the admin asked in this request; a proposal quotes it. */
	readonly request: string;
	readonly proposals: ProposalStore;
	/** A proposal of this run was made or got items: the panel shows it as it is now. */
	readonly onProposal?: (proposal: Proposal) => void;
}

export interface AgentToolsParts {
	readonly cms: Cms;
	readonly auth: AdminRequest["auth"];
	readonly signal?: AbortSignal;
	/** The open entry, when the admin is in the editor: only then are the editor tools offered. */
	readonly entryId?: string;
	readonly run: AgentToolsRun;
}

/**
 * The tools of one agent request (docs/design/agent.md §3–4):
 * - every `read` operation runs as the signed-in admin, in parallel with the other reads of a turn, and sees the run's planned changes applied (overlay);
 * - every `write` operation only plans: its changes become items of this run's proposal, one write at a time, and nothing in the site changes;
 * - the editor tools have no `execute`: the browser answers them, and only when an entry is open.
 * A tool that fails answers with its error; the same call three times in a row is refused; a long result is cut.
 */
export async function createAgentTools(parts: AgentToolsParts): Promise<Record<string, Tool>> {
	const { cms, auth, signal, run } = parts;
	const tools: Record<string, Tool> = {};
	let last: { key: string; count: number } | undefined;
	const repeated = (name: string, input: unknown) => {
		const key = `${name}:${JSON.stringify(input)}`;
		last = last?.key === key ? { key, count: last.count + 1 } : { key, count: 1 };
		return last.count >= MAX_SAME_CALLS;
	};

	// The run's proposal is made on its first write; the planned items are what later reads see applied.
	let proposalId: string | undefined;
	let planned: ProposalItem[] = [];
	// Writes run one after the other: their order is the proposal's order.
	let writes: Promise<unknown> = Promise.resolve();

	const propose = async (operation: string, input: unknown) => {
		const plans = await cms.writes.plan(operation, input, { auth, ...(signal ? { signal } : {}) });
		if (plans.length === 0)
			return { proposed: 0, note: "Nothing would change: the values are already what you asked for." };
		if (!proposalId) {
			proposalId = randomUUID();
			await run.proposals.create(proposalId, { adminId: run.adminId, runId: run.runId, request: run.request });
		}
		const items = plans.map((plan) => itemOf(randomUUID(), operation, plan));
		const proposal = await run.proposals.addItems(run.adminId, proposalId, items);
		planned = [...planned, ...items];
		run.onProposal?.(proposal);
		return {
			proposed: items.length,
			proposalId,
			note: "Proposed, not applied: the admin reviews and applies it. Later reads in this run show it applied.",
			items: items.map(({ id, target, preview }) => ({ id, target, before: preview.before, after: preview.after })),
		};
	};

	for (const operation of await cms.operations()) {
		const name = toolNameOf(operation.name);
		const { $schema: _schema, ...schema } = operation.jsonSchema as Record<string, unknown>;
		const inputSchema = jsonSchema(schema as Parameters<typeof jsonSchema>[0]);
		if (operation.kind === "read") {
			tools[name] = tool({
				description: operation.describe,
				inputSchema,
				execute: async (input: unknown) => {
					if (repeated(name, input)) return REPEAT_MESSAGE;
					try {
						return capResult(overlay(await cms.runOperation(operation.name, input, { auth, signal }), planned));
					} catch (error) {
						if (signal?.aborted) throw error;
						return failure(error);
					}
				},
			});
			continue;
		}
		tools[name] = tool({
			description: operation.describe,
			inputSchema,
			execute: (input: unknown) => {
				const next = writes.then(async () => {
					if (repeated(name, input)) return REPEAT_MESSAGE;
					try {
						return await propose(operation.name, input);
					} catch (error) {
						if (signal?.aborted) throw error;
						return failure(error);
					}
				});
				writes = next.catch(() => undefined);
				return next;
			},
		});
	}

	if (parts.entryId) {
		const empty = jsonSchema<Record<string, never>>({ type: "object", properties: {}, additionalProperties: false });
		tools.editor_read = tool({
			description:
				"The entry the admin has open in the editor, as the form holds it right now: unsaved changes included, which entries.get does not show. Use it when the question is about what is on screen.",
			inputSchema: empty,
		});
		tools.editor_selection = tool({
			description:
				"What the admin has selected in the open entry (the selected text or block), or nothing if there is no selection. Use it when the admin says “this” or “the selected part”.",
			inputSchema: empty,
		});
	}
	return tools;
}
