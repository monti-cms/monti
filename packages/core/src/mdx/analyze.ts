import type { Root, RootContent } from "mdast";
import { childRules } from "../blocks/derive";
import { createTranslator } from "../i18n";
import {
	estreeToJson,
	hasSpread,
	isCallExpression,
	isIdentifierExpression,
	isStaticEstree,
	programExpression,
} from "./expressions";
import { parseYamlMapping, splitFrontmatter } from "./frontmatter";
import { positionOf } from "./jsx";
import { mdxMessages } from "./messages";
import { parseMdxAst } from "./parse";
import { EVENT_HANDLER_NAME, REGISTERED_JSX_NAMES, RETIRED_JSX_NAMES } from "./registry";
import type { CmsMdxAnalysis, CmsMdxError, CmsMdxErrorCode } from "./types";

type VisitNode =
	| Root
	| RootContent
	| { type: string; position?: { start?: { line?: number; column?: number } }; [key: string]: unknown };

/** 더한 블록의 자식 개수 규칙(예: 탭 2~8개). 렌더러 이름 → 규칙. */
const CHILD_RULES = new Map(
	childRules().map(({ block, childComponents }) => [
		block.component,
		{ children: childComponents, min: block.children?.min ?? 0, max: block.children?.max ?? Number.POSITIVE_INFINITY },
	]),
);

const namedJsxChildren = (node: VisitNode, names: readonly string[]) => {
	const children = "children" in node && Array.isArray(node.children) ? node.children : [];
	const found: unknown[] = [];
	const walk = (nodes: unknown[]) => {
		for (const child of nodes) {
			const current = child as { type?: string; name?: string; children?: unknown[] };
			if (
				(current.type === "mdxJsxFlowElement" || current.type === "mdxJsxTextElement") &&
				names.includes(current.name ?? "")
			) {
				found.push(child);
				continue;
			}
			if (current.type === "paragraph" && Array.isArray(current.children)) {
				walk(current.children);
			}
		}
	};
	walk(children);
	return found;
};

type ErrorTarget = VisitNode | { position?: { start?: { line?: number; column?: number } } };

const t = createTranslator(mdxMessages);

/** 문구가 있는 오류 코드(`mdx_syntax`는 파서가 준 말을 그대로 쓴다). */
type MessageCode = Exclude<CmsMdxErrorCode, "mdx_syntax">;

const pushError = (
	errors: CmsMdxError[],
	code: MessageCode,
	node: ErrorTarget,
	params?: Record<string, string | number>,
) => {
	errors.push({ code, ...(params ? { params } : {}), message: t(code, params), position: positionOf(node) });
};

const validateExpression = (errors: CmsMdxError[], estree: unknown, node: ErrorTarget, source: string) => {
	const expression = programExpression(estree);
	if (hasSpread(expression)) {
		pushError(errors, "spread_attribute", node);
		return;
	}
	if (isCallExpression(expression)) {
		pushError(errors, "call_expression", node);
		return;
	}
	if (isIdentifierExpression(expression)) {
		pushError(errors, "identifier_reference", node);
		return;
	}
	if (!isStaticEstree(expression)) {
		pushError(errors, "unsupported_expression", node, { source });
		return;
	}
	estreeToJson(expression);
};

/** JSX 이름 대조. 등록되지 않은 이름은 거부한다(무음 손실 방지, M8-TW-1). */
const validateName = (errors: CmsMdxError[], node: VisitNode) => {
	const name = "name" in node && typeof node.name === "string" ? node.name : "";
	// fragment(`<>`)는 이름이 없어 대조할 수 없다 — 속성·표현식 검사는 그대로 적용한다.
	if (!name) return;
	if (RETIRED_JSX_NAMES.has(name)) {
		pushError(errors, "retired_jsx_element", node, { name });
		return;
	}
	if (!REGISTERED_JSX_NAMES.has(name)) {
		pushError(errors, "disallowed_jsx_element", node, { name });
	}
};

const validateAttributes = (errors: CmsMdxError[], node: VisitNode) => {
	const attributes = "attributes" in node && Array.isArray(node.attributes) ? node.attributes : [];
	for (const raw of attributes) {
		const attribute = raw as {
			type?: string;
			name?: string;
			value?: { type?: string; value?: string; data?: { estree?: unknown } } | string;
			position?: { start?: { line?: number; column?: number } };
		};
		const target = attribute.position ? attribute : node;

		if (attribute.type === "mdxJsxExpressionAttribute") {
			pushError(errors, "spread_attribute", target);
			continue;
		}

		if (attribute.type !== "mdxJsxAttribute") continue;

		if (attribute.name && EVENT_HANDLER_NAME.test(attribute.name)) {
			pushError(errors, "event_handler_attribute", target, { name: attribute.name });
		}

		if (typeof attribute.value === "string" || attribute.value == null) continue;
		if (attribute.value.type !== "mdxJsxAttributeValueExpression") continue;

		validateExpression(errors, attribute.value.data?.estree, target, attribute.value.value ?? "");
	}
};

const validateNode = (errors: CmsMdxError[], node: VisitNode) => {
	if (node.type === "mdxjsEsm") {
		pushError(errors, "esm_not_allowed", node);
	}

	if (node.type === "mdxFlowExpression" || node.type === "mdxTextExpression") {
		const value = typeof node.value === "string" ? node.value : "";
		validateExpression(errors, (node.data as { estree?: unknown } | undefined)?.estree, node, value);
	}

	if (node.type === "mdxJsxFlowElement" || node.type === "mdxJsxTextElement") {
		validateName(errors, node);
		validateAttributes(errors, node);
		const rule = typeof node.name === "string" ? CHILD_RULES.get(node.name) : undefined;
		if (rule) {
			const count = namedJsxChildren(node, rule.children).length;
			if (count < rule.min || count > rule.max) {
				const base = { name: node.name as string, min: rule.min, children: rule.children.join("·") };
				if (Number.isFinite(rule.max)) pushError(errors, "child_count_range", node, { ...base, max: rule.max });
				else pushError(errors, "child_count_min", node, base);
			}
		}
	}

	const children = "children" in node && Array.isArray(node.children) ? node.children : [];
	for (const child of children) {
		validateNode(errors, child as VisitNode);
	}
};

export const analyze = (mdx: string, name?: string): CmsMdxAnalysis => {
	const { raw, body } = splitFrontmatter(mdx);
	const sourceLineOffset = raw === null ? 0 : mdx.slice(0, mdx.length - body.length).split(/\r?\n/).length - 1;
	const errors: CmsMdxError[] = [];
	let tree: Root | null = null;
	let frontmatter: CmsMdxAnalysis["frontmatter"] = null;

	if (raw != null) {
		frontmatter = parseYamlMapping(raw);
	}

	try {
		tree = parseMdxAst(body);
		validateNode(errors, tree);
	} catch (error) {
		const position = { line: 1, column: 1 };
		if (error instanceof Error) errors.push({ code: "mdx_syntax", message: error.message, position });
		else errors.push({ code: "parse_failed", message: t("parse_failed"), position });
	}

	return {
		source: mdx,
		errors: errors.map((error) => ({
			...error,
			position: { ...error.position, line: error.position.line + sourceLineOffset },
		})),
		name,
		frontmatter,
		sourceLineOffset,
		tree,
	};
};
