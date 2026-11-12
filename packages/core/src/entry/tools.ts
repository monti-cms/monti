import { parseInput } from "../engine/execute";
import { UnknownOperationError } from "../errors";
import { available, type Capability, describe, type Monti } from "../monti";
import type { Preview } from "../operation";

/** The operations the assistant gets as tools: every one but those only a person may run, and on the live site those that change structure. */
export function agentTools(monti: Monti): Capability[] {
	const open = monti.site.files !== null;
	return [...monti.operations.values()].filter((operation) => available(operation, "assistant", open)).map(describe);
}

export type ToolSession = {
	conversationId: string;
	proposalId: string;
	/** The name the assistant gave this kind of change ("요약 채우기"): the group its items show under. */
	group?: string;
};

export type ToolResult =
	| { kind: "read"; output: unknown }
	| { kind: "proposed"; itemId: string; itemIds: string[]; preview: Preview | null }
	| { kind: "screen"; name: string; input: unknown };

/**
 * Calls a tool for the assistant. A read runs at once; a write becomes an item of the conversation's proposal and changes nothing; a screen operation
 * goes back to the browser to run.
 */
export async function callAgentTool(
	monti: Monti,
	name: string,
	input: unknown,
	session: ToolSession,
): Promise<ToolResult> {
	const operation = monti.operations.get(name);
	if (!operation || !available(operation, "assistant", monti.site.files !== null))
		throw new UnknownOperationError(name);
	if (operation.kind === "read")
		return {
			kind: "read",
			output: await monti.run(name, input, { actor: "assistant", conversationId: session.conversationId }),
		};
	if (operation.kind === "screen") return { kind: "screen", name, input: parseInput(operation, input) };
	return { kind: "proposed", ...(await monti.proposals.add(session.proposalId, name, input, session.group)) };
}
