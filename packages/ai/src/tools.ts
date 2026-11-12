import {
	agentTools,
	type Capability,
	CheckError,
	ConflictError,
	callAgentTool,
	coreMessages,
	ForbiddenError,
	formatMessage,
	InputError,
	type Monti,
	type OperationKind,
	type Preview,
	UnknownOperationError,
} from "@monti-cms/core";
import type { ToolSpec } from "./provider";

/** The assistant's own operations: it does not run itself, read its own conversations or call the quick-task model as a tool. */
const OWN = /^(assistant|conversations)\./;

/** What a write tool takes besides its operation's input: the name of the kind of change, which the proposal groups by. */
export const GROUP = "_group";

/** The longest a tool's result is given to the model, as JSON text. */
export const MOST_RESULT = 24_000;

export type AssistantTool = ToolSpec & { operation: string; kind: OperationKind };

/** A name a model API takes for a tool: `entries.moveToFolder` as `entries_moveToFolder`. */
const toolName = (operation: string) => operation.replace(/\./g, "_").slice(0, 64);

/**
 * The tools of a site (docs 00 and 10): every operation the assistant may use, the plugins' included, made from the operation list and nothing
 * else. Adding an operation adds its tool; no code here names one. A write tool takes one more thing, `_group`: what the person will read as the
 * name of that kind of change.
 */
export function assistantTools(monti: Monti): AssistantTool[] {
	const tools = agentTools(monti)
		.filter((capability) => !OWN.test(capability.name))
		.map((capability) => ({
			operation: capability.name,
			kind: capability.kind,
			name: toolName(capability.name),
			description: describe(capability),
			inputSchema: capability.kind === "write" ? withGroup(capability.inputSchema) : capability.inputSchema,
		}));
	const names = new Set<string>();
	for (const tool of tools) {
		if (names.has(tool.name)) throw new Error(`Two operations make the tool name "${tool.name}".`);
		names.add(tool.name);
	}
	return tools;
}

function describe(capability: Capability): string {
	if (capability.kind === "write")
		return `${capability.description} This does not change anything: it adds the change to a proposal the person reviews and takes or leaves.`;
	if (capability.kind === "screen") return `${capability.description} It moves the person's screen; no data changes.`;
	return capability.description;
}

function withGroup(schema: unknown): unknown {
	const object = (schema ?? {}) as { properties?: Record<string, unknown>; required?: string[] };
	return {
		...object,
		type: "object",
		properties: {
			...(object.properties ?? {}),
			[GROUP]: {
				type: "string",
				description:
					'A short name for this kind of change, in the person\'s language, the same for every call that belongs together ("Fill in summaries", "Move to 2024"). The review groups changes by it.',
			},
		},
		required: [...(object.required ?? []), GROUP],
	};
}

export type ToolOutcome =
	| { kind: "read"; output: unknown; error: boolean; count?: number }
	| { kind: "write"; output: unknown; error: boolean; items: string[]; proposalId?: string }
	/** The browser runs it; the engine waits for what it answers. */
	| { kind: "screen"; name: string; input: unknown };

/** How a run proposes a write: as a new item of its proposal, or in the place of the one item it is about. Either way nothing is written. */
export type Propose = (
	operation: string,
	input: unknown,
	group: string,
) => Promise<{ itemIds: string[]; preview: Preview | null; proposalId: string }>;

/** How many things a read gave, when it is a list or carries one: the "148" of "read the list · 148 posts". */
function countOf(output: unknown): number | undefined {
	if (Array.isArray(output)) return output.length;
	if (typeof output !== "object" || output === null) return undefined;
	const record = output as Record<string, unknown>;
	if (typeof record.total === "number") return record.total;
	for (const key of ["rows", "items", "entries", "files", "keys"])
		if (Array.isArray(record[key])) return record[key].length;
	return undefined;
}

/** A result as the model gets it: whole when it is short, else its beginning with the advice to ask for less. */
export function shortened(output: unknown): unknown {
	const text = JSON.stringify(output ?? null);
	if (text.length <= MOST_RESULT) return output ?? null;
	return {
		cut: true,
		beginning: text.slice(0, MOST_RESULT),
		note: "The result was cut here. Ask for less: a filter, fewer fields, a smaller page.",
	};
}

/** An error as the model reads it: the operation's own reason, in words. A tool that fails does not stop the run; the model sees why. */
export function toolError(error: unknown): { error: string; [more: string]: unknown } {
	if (error instanceof CheckError || error instanceof ForbiddenError)
		return { error: formatMessage([coreMessages], "en", error.reason), reason: error.reason.key };
	if (error instanceof ConflictError)
		return {
			error: "The record changed since you read it. Read it again and use its version.",
			records: error.records.map((record) => ({ ...record.ref, expected: record.expected, actual: record.actual })),
		};
	if (error instanceof InputError) return { error: error.message };
	if (error instanceof UnknownOperationError) return { error: "There is no such tool." };
	return { error: error instanceof Error ? error.message : String(error) };
}

/**
 * Calls a tool for the assistant. A read runs through the core's way in for the assistant (`callAgentTool`); a screen tool is checked and handed
 * to the browser; a write is proposed and changes nothing. Whatever the model asks, the most it gets is a proposal (doc 10, principle 1).
 */
export async function callTool(
	monti: Monti,
	tool: AssistantTool | undefined,
	rawInput: unknown,
	propose: Propose,
): Promise<ToolOutcome> {
	if (!tool) return { kind: "read", output: toolError(new UnknownOperationError("")), error: true };
	try {
		if (tool.kind === "write") {
			const { [GROUP]: group, ...input } = (rawInput ?? {}) as Record<string, unknown>;
			if (typeof group !== "string" || group.trim() === "")
				return {
					kind: "write",
					output: { error: `Give ${GROUP}: a short name for this kind of change.` },
					error: true,
					items: [],
				};
			const proposed = await propose(tool.operation, input, group.trim().slice(0, 80));
			return {
				kind: "write",
				output: {
					proposed: true,
					items: proposed.itemIds,
					preview: proposed.preview,
					note: "Nothing has changed. The person reviews the proposal and takes or leaves each change.",
				},
				error: false,
				items: proposed.itemIds,
				proposalId: proposed.proposalId,
			};
		}
		const result = await callAgentTool(monti, tool.operation, rawInput ?? {}, { conversationId: "", proposalId: "" });
		if (result.kind === "screen") return { kind: "screen", name: tool.operation, input: result.input };
		if (result.kind !== "read") throw new Error(`${tool.operation} is no read.`);
		return { kind: "read", output: shortened(result.output), error: false, count: countOf(result.output) };
	} catch (error) {
		const output = toolError(error);
		return tool.kind === "write"
			? { kind: "write", output, error: true, items: [] }
			: { kind: "read", output, error: true };
	}
}
