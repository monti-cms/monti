import type { Site } from "@monti-cms/core/client";
import type { Root, RootContent } from "mdast";
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
import { perSite } from "./per-site";
import { EVENT_HANDLER_NAME, type JsxRegistry, jsxRegistryOf, RETIRED_JSX_NAMES } from "./registry";
import type { SyntaxExtension } from "./syntax/types";
import type { CmsMdxAnalysis, CmsMdxError, CmsMdxErrorCode } from "./types";

type VisitNode =
	| Root
	| RootContent
	| { type: string; position?: { start?: { line?: number; column?: number } }; [key: string]: unknown };

type ChildRule = { children: string[]; min: number; max: number };

/** What the checks of one site read: the child count rules of its added blocks, the JSX names it allows and its message translator. */
type Rules = {
	/** Child count rules for added blocks (e.g. 2 to 8 tabs). Renderer name → rule. */
	childRules: ReadonlyMap<string, ChildRule>;
	registry: JsxRegistry;
	t: (code: MessageCode, params?: Record<string, string | number>) => string;
};

const rulesOf = perSite(
	(site: Site): Rules => ({
		childRules: new Map(
			site.childRules().map(({ block, childComponents }) => [
				block.component,
				{
					children: childComponents,
					min: block.children?.min ?? 0,
					max: block.children?.max ?? Number.POSITIVE_INFINITY,
				},
			]),
		),
		registry: jsxRegistryOf(site),
		t: site.createTranslator(mdxMessages),
	}),
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

/** The findings of one check, and the rules of the site it runs for. */
type Checking = { errors: CmsMdxError[]; rules: Rules };

type ErrorTarget = VisitNode | { position?: { start?: { line?: number; column?: number } } };

/** Error codes that have a message (`mdx_syntax` uses the message from the parser as is). */
type MessageCode = Exclude<CmsMdxErrorCode, "mdx_syntax">;

const pushError = (
	{ errors, rules }: Checking,
	code: MessageCode,
	node: ErrorTarget,
	params?: Record<string, string | number>,
) => {
	errors.push({ code, ...(params ? { params } : {}), message: rules.t(code, params), position: positionOf(node) });
};

const validateExpression = (checking: Checking, estree: unknown, node: ErrorTarget, source: string) => {
	const expression = programExpression(estree);
	if (hasSpread(expression)) {
		pushError(checking, "spread_attribute", node);
		return;
	}
	if (isCallExpression(expression)) {
		pushError(checking, "call_expression", node);
		return;
	}
	if (isIdentifierExpression(expression)) {
		pushError(checking, "identifier_reference", node);
		return;
	}
	if (!isStaticEstree(expression)) {
		pushError(checking, "unsupported_expression", node, { source });
		return;
	}
	estreeToJson(expression);
};

/** JSX name check. Unregistered names are rejected (prevents silent loss). */
const validateName = (checking: Checking, node: VisitNode) => {
	const name = "name" in node && typeof node.name === "string" ? node.name : "";
	// A fragment (`<>`) has no name, so it cannot be checked — attribute and expression checks still apply.
	if (!name) return;
	if (RETIRED_JSX_NAMES.has(name)) {
		pushError(checking, "retired_jsx_element", node, { name });
		return;
	}
	if (!checking.rules.registry.REGISTERED_JSX_NAMES.has(name)) {
		pushError(checking, "disallowed_jsx_element", node, { name });
	}
};

const validateAttributes = (checking: Checking, node: VisitNode) => {
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
			pushError(checking, "spread_attribute", target);
			continue;
		}

		if (attribute.type !== "mdxJsxAttribute") continue;

		if (attribute.name && EVENT_HANDLER_NAME.test(attribute.name)) {
			pushError(checking, "event_handler_attribute", target, { name: attribute.name });
		}

		if (typeof attribute.value === "string" || attribute.value == null) continue;
		if (attribute.value.type !== "mdxJsxAttributeValueExpression") continue;

		validateExpression(checking, attribute.value.data?.estree, target, attribute.value.value ?? "");
	}
};

const validateNode = (checking: Checking, node: VisitNode) => {
	if (node.type === "mdxjsEsm") {
		pushError(checking, "esm_not_allowed", node);
	}

	if (node.type === "mdxFlowExpression" || node.type === "mdxTextExpression") {
		const value = typeof node.value === "string" ? node.value : "";
		validateExpression(checking, (node.data as { estree?: unknown } | undefined)?.estree, node, value);
	}

	if (node.type === "mdxJsxFlowElement" || node.type === "mdxJsxTextElement") {
		validateName(checking, node);
		validateAttributes(checking, node);
		const rule = typeof node.name === "string" ? checking.rules.childRules.get(node.name) : undefined;
		if (rule) {
			const count = namedJsxChildren(node, rule.children).length;
			if (count < rule.min || count > rule.max) {
				const base = { name: node.name as string, min: rule.min, children: rule.children.join("·") };
				if (Number.isFinite(rule.max)) pushError(checking, "child_count_range", node, { ...base, max: rule.max });
				else pushError(checking, "child_count_min", node, base);
			}
		}
	}

	const children = "children" in node && Array.isArray(node.children) ? node.children : [];
	for (const child of children) {
		validateNode(checking, child as VisitNode);
	}
};

/** `syntax` is the syntax extensions to read with (none: standard MDX). */
export const analyze = (
	site: Site,
	mdx: string,
	name?: string,
	syntax?: readonly SyntaxExtension[],
): CmsMdxAnalysis => {
	const rules = rulesOf(site);
	const { raw, body } = splitFrontmatter(mdx);
	const sourceLineOffset = raw === null ? 0 : mdx.slice(0, mdx.length - body.length).split(/\r?\n/).length - 1;
	const errors: CmsMdxError[] = [];
	const checking: Checking = { errors, rules };
	let tree: Root | null = null;
	let frontmatter: CmsMdxAnalysis["frontmatter"] = null;

	if (raw != null) {
		frontmatter = parseYamlMapping(raw);
	}

	try {
		tree = parseMdxAst(site, body, syntax);
		validateNode(checking, tree);
	} catch (error) {
		const position = { line: 1, column: 1 };
		if (error instanceof Error) errors.push({ code: "mdx_syntax", message: error.message, position });
		else errors.push({ code: "parse_failed", message: rules.t("parse_failed"), position });
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
