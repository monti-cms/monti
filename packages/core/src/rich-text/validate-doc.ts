import { z } from "zod";
import type { BlockDefinition, BlockHolds, DocIssue, MarkDefinition, ValidateDocOptions } from "./types";

const LIST = ["listItem"];

const BUILT_IN_BLOCKS: readonly BlockDefinition[] = [
	{ type: "paragraph", holds: "text" },
	{ type: "heading", holds: "text" },
	{ type: "codeBlock", holds: "text" },
	{ type: "footnote", holds: "text" },
	{ type: "bulletList", holds: "blocks", children: LIST },
	{ type: "orderedList", holds: "blocks", children: LIST },
	{ type: "checklist", holds: "blocks", children: LIST },
	{ type: "listItem", holds: "blocks" },
	{ type: "quote", holds: "blocks" },
	{ type: "divider", holds: "nothing" },
	{ type: "image", holds: "nothing" },
	{ type: "file", holds: "nothing" },
	{ type: "table", holds: "nothing" },
];

const BUILT_IN_MARKS: readonly MarkDefinition[] = [
	"bold",
	"italic",
	"underline",
	"strike",
	"code",
	"link",
	"sup",
	"sub",
].map((type) => ({ type }));

/** Attributes every block may carry, checked whatever its definition says. */
const RESERVED_ATTRS: Record<string, z.ZodTypeAny> = { mediaId: z.uuid(), mediaIds: z.array(z.uuid()) };

/** The `holds` a block needs for each key it may carry. */
const HELD_BY: Record<"content" | "children", BlockHolds> = { content: "text", children: "blocks" };

type Value = Record<string, unknown>;

interface Check {
	blocks: Map<string, BlockDefinition>;
	marks: Map<string, MarkDefinition>;
	ids: Set<string>;
	issues: DocIssue[];
}

/** Checks a rich-text body against the built-in and the given block and mark definitions; returns every problem found and never throws. */
export function validateDoc(doc: unknown, options: ValidateDocOptions = {}): DocIssue[] {
	const check: Check = {
		blocks: byType(BUILT_IN_BLOCKS, options.blocks),
		marks: byType(BUILT_IN_MARKS, options.marks),
		ids: new Set(),
		issues: [],
	};
	if (isRecord(doc)) checkBlockList(check, doc.blocks, "blocks");
	else report(check, "", "The document must be an object.");
	return check.issues;
}

function byType<T extends { type: string }>(builtIn: readonly T[], added: readonly T[] = []): Map<string, T> {
	return new Map([...builtIn, ...added].map((definition) => [definition.type, definition]));
}

function checkBlockList(check: Check, value: unknown, path: string, allowed?: readonly string[]): void {
	if (!Array.isArray(value)) {
		report(check, path, "Must be an array of blocks.");
		return;
	}
	value.forEach((block, index) => {
		checkBlock(check, block, `${path}[${index}]`, allowed);
	});
}

function checkBlock(check: Check, block: unknown, path: string, allowed?: readonly string[]): void {
	if (!isRecord(block)) {
		report(check, path, "A block must be an object.");
		return;
	}
	checkId(check, block.id, `${path}.id`);
	const definition = blockDefinition(check, block.type, `${path}.type`);
	if (!definition) return;
	if (allowed && !allowed.includes(definition.type)) {
		report(check, path, `A "${definition.type}" block is not allowed here.`);
	}
	checkAttrs(check, block.attrs, definition.attrs, `${path}.attrs`);
	checkHeld(check, block, definition, path);
}

function checkId(check: Check, id: unknown, path: string): void {
	if (typeof id !== "string" || id === "") report(check, path, "A block needs a string id.");
	else if (check.ids.has(id)) report(check, path, `The id "${id}" is already used by an earlier block.`);
	else check.ids.add(id);
}

function blockDefinition(check: Check, type: unknown, path: string): BlockDefinition | undefined {
	if (typeof type !== "string") {
		report(check, path, "A block needs a string type.");
		return undefined;
	}
	const definition = check.blocks.get(type);
	if (!definition) report(check, path, `Unknown block type "${type}".`);
	return definition;
}

function checkAttrs(check: Check, attrs: unknown, schema: z.ZodTypeAny | undefined, path: string): void {
	if (attrs !== undefined && !isRecord(attrs)) {
		report(check, path, "attrs must be an object.");
		return;
	}
	if (schema) checkSchema(check, schema, attrs ?? {}, path);
	for (const [key, reserved] of Object.entries(RESERVED_ATTRS)) {
		if (attrs?.[key] !== undefined) checkSchema(check, reserved, attrs[key], `${path}.${key}`);
	}
}

function checkHeld(check: Check, block: Value, definition: BlockDefinition, path: string): void {
	for (const key of ["content", "children"] as const) {
		const value = block[key];
		const at = `${path}.${key}`;
		if (value === undefined) continue;
		if (definition.holds !== HELD_BY[key]) report(check, at, `A "${definition.type}" block holds no ${key}.`);
		else if (key === "content") checkInlines(check, value, at);
		else checkBlockList(check, value, at, definition.children);
	}
}

function checkInlines(check: Check, value: unknown, path: string): void {
	if (!Array.isArray(value)) {
		report(check, path, "Must be an array of inline nodes.");
		return;
	}
	value.forEach((node, index) => {
		checkInline(check, node, `${path}[${index}]`);
	});
}

function checkInline(check: Check, node: unknown, path: string): void {
	if (!isRecord(node)) report(check, path, "An inline node must be an object.");
	else if (node.type === "text") checkText(check, node, path);
	else if (node.type === "footnoteRef") checkFootnoteRef(check, node, path);
	else if (node.type !== "hardBreak")
		report(
			check,
			`${path}.type`,
			typeof node.type === "string" ? `Unknown inline type "${node.type}".` : "An inline node needs a string type.",
		);
}

function checkFootnoteRef(check: Check, node: Value, path: string): void {
	if (typeof node.id !== "string") report(check, `${path}.id`, "A footnote reference needs a string id.");
}

function checkText(check: Check, node: Value, path: string): void {
	if (typeof node.text !== "string") report(check, `${path}.text`, "text must be a string.");
	if (node.marks === undefined) return;
	if (!Array.isArray(node.marks)) {
		report(check, `${path}.marks`, "Must be an array of marks.");
		return;
	}
	node.marks.forEach((mark, index) => {
		checkMark(check, mark, `${path}.marks[${index}]`);
	});
}

function checkMark(check: Check, mark: unknown, path: string): void {
	if (!isRecord(mark)) {
		report(check, path, "A mark must be an object.");
		return;
	}
	const { type, ...attrs } = mark;
	const definition = typeof type === "string" ? check.marks.get(type) : undefined;
	if (!definition)
		report(
			check,
			`${path}.type`,
			typeof type === "string" ? `Unknown mark type "${type}".` : "A mark needs a string type.",
		);
	else if (definition.attrs) checkSchema(check, definition.attrs, attrs, path);
}

function checkSchema(check: Check, schema: z.ZodTypeAny, value: unknown, path: string): void {
	const result = schema.safeParse(value);
	if (!result.success) report(check, path, result.error.issues.map((issue) => issue.message).join("; "));
}

function report(check: Check, path: string, message: string): void {
	check.issues.push({ path, message });
}

function isRecord(value: unknown): value is Value {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
