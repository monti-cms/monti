import { type AdminRequest, type Cms, CmsError, pluginLog } from "@monti-cms/core/server";
import { jsonSchema, type Tool, tool } from "ai";
import { AI_PLUGIN_NAME } from "./name";

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

/** A result over the limit, cut: the start of it as text, and what to do about it. */
export interface CutResult {
	cut: true;
	note: string;
	partial: string;
}

/** The result as the model reads it: itself, or when its JSON is longer than {@link MAX_TOOL_RESULT_CHARS}, its start with a note to narrow the query. */
export function capResult(result: unknown): unknown {
	const text = JSON.stringify(result) ?? "null";
	if (text.length <= MAX_TOOL_RESULT_CHARS) return result;
	return {
		cut: true,
		note: `The result was longer than ${MAX_TOOL_RESULT_CHARS} characters and was cut. Narrow the query (a smaller page, a filter, a single id) to see the rest.`,
		partial: text.slice(0, MAX_TOOL_RESULT_CHARS),
	} satisfies CutResult;
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

export interface AgentToolsParts {
	readonly cms: Cms;
	readonly auth: AdminRequest["auth"];
	readonly signal?: AbortSignal;
	/** The open entry, when the admin is in the editor: only then are the editor tools offered. */
	readonly entryId?: string;
}

/**
 * The tools of one agent request. Every `read` operation of the site becomes a tool (the name with `.` as `_`, `describe` as its description, its JSON Schema as
 * the input), and runs as the signed-in admin. The editor tools have no `execute`: the browser answers them, and only when an entry is open.
 */
export async function createAgentTools(parts: AgentToolsParts): Promise<Record<string, Tool>> {
	const { cms, auth, signal } = parts;
	const tools: Record<string, Tool> = {};
	// The last call and how many times in a row it was made. Tools that run side by side are counted in the order they start.
	let last: { key: string; count: number } | undefined;

	for (const operation of (await cms.operations()).filter((candidate) => candidate.kind === "read")) {
		const name = toolNameOf(operation.name);
		const { $schema: _schema, ...schema } = operation.jsonSchema as Record<string, unknown>;
		tools[name] = tool({
			description: operation.describe,
			inputSchema: jsonSchema(schema as Parameters<typeof jsonSchema>[0]),
			execute: async (input: unknown) => {
				const key = `${name}:${JSON.stringify(input)}`;
				last = last?.key === key ? { key, count: last.count + 1 } : { key, count: 1 };
				if (last.count >= MAX_SAME_CALLS) return REPEAT_MESSAGE;
				try {
					return capResult(await cms.runOperation(operation.name, input, { auth, signal }));
				} catch (error) {
					if (signal?.aborted) throw error;
					return failure(error);
				}
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
