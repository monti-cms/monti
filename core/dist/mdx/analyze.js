import { childRules } from "../blocks/derive.js";
import { createTranslator } from "../i18n/index.js";
import { estreeToJson, hasSpread, isCallExpression, isIdentifierExpression, isStaticEstree, programExpression, } from "./expressions.js";
import { parseYamlMapping, splitFrontmatter } from "./frontmatter.js";
import { positionOf } from "./jsx.js";
import { mdxMessages } from "./messages.js";
import { parseMdxAst } from "./parse.js";
import { EVENT_HANDLER_NAME, REGISTERED_JSX_NAMES, RETIRED_JSX_NAMES } from "./registry.js";
/** Child count rules for added blocks (e.g. 2 to 8 tabs). Renderer name → rule. */
const CHILD_RULES = new Map(childRules().map(({ block, childComponents }) => [
    block.component,
    { children: childComponents, min: block.children?.min ?? 0, max: block.children?.max ?? Number.POSITIVE_INFINITY },
]));
const namedJsxChildren = (node, names) => {
    const children = "children" in node && Array.isArray(node.children) ? node.children : [];
    const found = [];
    const walk = (nodes) => {
        for (const child of nodes) {
            const current = child;
            if ((current.type === "mdxJsxFlowElement" || current.type === "mdxJsxTextElement") &&
                names.includes(current.name ?? "")) {
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
const t = createTranslator(mdxMessages);
const pushError = (errors, code, node, params) => {
    errors.push({ code, ...(params ? { params } : {}), message: t(code, params), position: positionOf(node) });
};
const validateExpression = (errors, estree, node, source) => {
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
/** JSX name check. Unregistered names are rejected (prevents silent loss). */
const validateName = (errors, node) => {
    const name = "name" in node && typeof node.name === "string" ? node.name : "";
    // A fragment (`<>`) has no name, so it cannot be checked — attribute and expression checks still apply.
    if (!name)
        return;
    if (RETIRED_JSX_NAMES.has(name)) {
        pushError(errors, "retired_jsx_element", node, { name });
        return;
    }
    if (!REGISTERED_JSX_NAMES.has(name)) {
        pushError(errors, "disallowed_jsx_element", node, { name });
    }
};
const validateAttributes = (errors, node) => {
    const attributes = "attributes" in node && Array.isArray(node.attributes) ? node.attributes : [];
    for (const raw of attributes) {
        const attribute = raw;
        const target = attribute.position ? attribute : node;
        if (attribute.type === "mdxJsxExpressionAttribute") {
            pushError(errors, "spread_attribute", target);
            continue;
        }
        if (attribute.type !== "mdxJsxAttribute")
            continue;
        if (attribute.name && EVENT_HANDLER_NAME.test(attribute.name)) {
            pushError(errors, "event_handler_attribute", target, { name: attribute.name });
        }
        if (typeof attribute.value === "string" || attribute.value == null)
            continue;
        if (attribute.value.type !== "mdxJsxAttributeValueExpression")
            continue;
        validateExpression(errors, attribute.value.data?.estree, target, attribute.value.value ?? "");
    }
};
const validateNode = (errors, node) => {
    if (node.type === "mdxjsEsm") {
        pushError(errors, "esm_not_allowed", node);
    }
    if (node.type === "mdxFlowExpression" || node.type === "mdxTextExpression") {
        const value = typeof node.value === "string" ? node.value : "";
        validateExpression(errors, node.data?.estree, node, value);
    }
    if (node.type === "mdxJsxFlowElement" || node.type === "mdxJsxTextElement") {
        validateName(errors, node);
        validateAttributes(errors, node);
        const rule = typeof node.name === "string" ? CHILD_RULES.get(node.name) : undefined;
        if (rule) {
            const count = namedJsxChildren(node, rule.children).length;
            if (count < rule.min || count > rule.max) {
                const base = { name: node.name, min: rule.min, children: rule.children.join("·") };
                if (Number.isFinite(rule.max))
                    pushError(errors, "child_count_range", node, { ...base, max: rule.max });
                else
                    pushError(errors, "child_count_min", node, base);
            }
        }
    }
    const children = "children" in node && Array.isArray(node.children) ? node.children : [];
    for (const child of children) {
        validateNode(errors, child);
    }
};
export const analyze = (mdx, name) => {
    const { raw, body } = splitFrontmatter(mdx);
    const sourceLineOffset = raw === null ? 0 : mdx.slice(0, mdx.length - body.length).split(/\r?\n/).length - 1;
    const errors = [];
    let tree = null;
    let frontmatter = null;
    if (raw != null) {
        frontmatter = parseYamlMapping(raw);
    }
    try {
        tree = parseMdxAst(body);
        validateNode(errors, tree);
    }
    catch (error) {
        const position = { line: 1, column: 1 };
        if (error instanceof Error)
            errors.push({ code: "mdx_syntax", message: error.message, position });
        else
            errors.push({ code: "parse_failed", message: t("parse_failed"), position });
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
