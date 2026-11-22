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

/** 모든 블록이 가질 수 있는 예약 속성. 블록 정의와 상관없이 검사한다. */
const RESERVED_ATTRS: Record<string, z.ZodTypeAny> = { mediaId: z.uuid(), mediaIds: z.array(z.uuid()) };

/** 블록이 각 키를 가지려면 필요한 `holds`. */
const HELD_BY: Record<"content" | "children", BlockHolds> = { content: "text", children: "blocks" };

type Value = Record<string, unknown>;

interface Check {
	blocks: Map<string, BlockDefinition>;
	marks: Map<string, MarkDefinition>;
	ids: Set<string>;
	issues: DocIssue[];
}

/** 본문을 내장 블록·마크 정의와 넘겨받은 정의로 검사한다. 찾은 문제를 모두 돌려주고 예외는 던지지 않는다. */
export function validateDoc(doc: unknown, options: ValidateDocOptions = {}): DocIssue[] {
	const check: Check = {
		blocks: blockDefinitions(options),
		marks: byType(BUILT_IN_MARKS, options.marks),
		ids: new Set(),
		issues: [],
	};
	if (isRecord(doc)) checkBlockList(check, doc.blocks, "blocks");
	else report(check, "", "문서는 객체여야 합니다.");
	return check.issues;
}

/** 내장 블록 정의에 넘겨받은 정의를 `type`별로 더한다. 같은 `type`이면 넘겨받은 정의가 내장 정의를 대신한다. */
export function blockDefinitions(options: ValidateDocOptions): Map<string, BlockDefinition> {
	return byType(BUILT_IN_BLOCKS, options.blocks);
}

function byType<T extends { type: string }>(builtIn: readonly T[], added: readonly T[] = []): Map<string, T> {
	return new Map([...builtIn, ...added].map((definition) => [definition.type, definition]));
}

function checkBlockList(check: Check, value: unknown, path: string, allowed?: readonly string[]): void {
	if (!Array.isArray(value)) {
		report(check, path, "블록 배열이어야 합니다.");
		return;
	}
	value.forEach((block, index) => {
		checkBlock(check, block, `${path}[${index}]`, allowed);
	});
}

function checkBlock(check: Check, block: unknown, path: string, allowed?: readonly string[]): void {
	if (!isRecord(block)) {
		report(check, path, "블록은 객체여야 합니다.");
		return;
	}
	checkId(check, block.id, `${path}.id`);
	const definition = blockDefinition(check, block.type, `${path}.type`);
	if (!definition) return;
	if (allowed && !allowed.includes(definition.type)) {
		report(check, path, `"${definition.type}" 블록은 여기에 둘 수 없습니다.`);
	}
	checkAttrs(check, block.attrs, definition.attrs, `${path}.attrs`);
	checkHeld(check, block, definition, path);
}

function checkId(check: Check, id: unknown, path: string): void {
	if (typeof id !== "string" || id === "") report(check, path, "블록에는 문자열 id가 있어야 합니다.");
	else if (check.ids.has(id)) report(check, path, `id "${id}"는 앞선 블록이 이미 쓰고 있습니다.`);
	else check.ids.add(id);
}

function blockDefinition(check: Check, type: unknown, path: string): BlockDefinition | undefined {
	if (typeof type !== "string") {
		report(check, path, "블록에는 문자열 type이 있어야 합니다.");
		return undefined;
	}
	const definition = check.blocks.get(type);
	if (!definition) report(check, path, `알 수 없는 블록 type "${type}"입니다.`);
	return definition;
}

function checkAttrs(check: Check, attrs: unknown, schema: z.ZodTypeAny | undefined, path: string): void {
	if (attrs !== undefined && !isRecord(attrs)) {
		report(check, path, "attrs는 객체여야 합니다.");
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
		if (definition.holds !== HELD_BY[key]) report(check, at, `"${definition.type}" 블록은 ${key}를 담지 않습니다.`);
		else if (key === "content") checkInlines(check, value, at);
		else checkBlockList(check, value, at, definition.children);
	}
}

function checkInlines(check: Check, value: unknown, path: string): void {
	if (!Array.isArray(value)) {
		report(check, path, "인라인 노드 배열이어야 합니다.");
		return;
	}
	value.forEach((node, index) => {
		checkInline(check, node, `${path}[${index}]`);
	});
}

function checkInline(check: Check, node: unknown, path: string): void {
	if (!isRecord(node)) report(check, path, "인라인 노드는 객체여야 합니다.");
	else if (node.type === "text") checkText(check, node, path);
	else if (node.type === "footnoteRef") checkFootnoteRef(check, node, path);
	else if (node.type !== "hardBreak")
		report(
			check,
			`${path}.type`,
			typeof node.type === "string"
				? `알 수 없는 인라인 type "${node.type}"입니다.`
				: "인라인 노드에는 문자열 type이 있어야 합니다.",
		);
}

function checkFootnoteRef(check: Check, node: Value, path: string): void {
	if (typeof node.id !== "string") report(check, `${path}.id`, "각주 참조에는 문자열 id가 있어야 합니다.");
}

function checkText(check: Check, node: Value, path: string): void {
	if (typeof node.text !== "string") report(check, `${path}.text`, "text는 문자열이어야 합니다.");
	if (node.marks === undefined) return;
	if (!Array.isArray(node.marks)) {
		report(check, `${path}.marks`, "마크 배열이어야 합니다.");
		return;
	}
	node.marks.forEach((mark, index) => {
		checkMark(check, mark, `${path}.marks[${index}]`);
	});
}

function checkMark(check: Check, mark: unknown, path: string): void {
	if (!isRecord(mark)) {
		report(check, path, "마크는 객체여야 합니다.");
		return;
	}
	const { type, ...attrs } = mark;
	const definition = typeof type === "string" ? check.marks.get(type) : undefined;
	if (!definition)
		report(
			check,
			`${path}.type`,
			typeof type === "string" ? `알 수 없는 마크 type "${type}"입니다.` : "마크에는 문자열 type이 있어야 합니다.",
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
