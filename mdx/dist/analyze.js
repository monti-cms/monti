import { estreeToJson, hasSpread, isCallExpression, isIdentifierExpression, isStaticEstree, programExpression, } from "./expressions.js";
import { parseYamlMapping, splitFrontmatter } from "./frontmatter.js";
import { positionOf } from "./jsx.js";
import { mdxMessages } from "./messages.js";
import { parseMdxAst } from "./parse.js";
import { perSite } from "./per-site.js";
import { EVENT_HANDLER_NAME, jsxRegistryOf, RETIRED_JSX_NAMES } from "./registry.js";
const rulesOf = perSite((site) => ({
    childRules: new Map(site.childRules().map(({ block, childComponents }) => [
        block.component,
        {
            children: childComponents,
            min: block.children?.min ?? 0,
            max: block.children?.max ?? Number.POSITIVE_INFINITY,
        },
    ])),
    registry: jsxRegistryOf(site),
    t: site.createTranslator(mdxMessages),
}));
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
const pushError = ({ errors, rules }, code, node, params) => {
    errors.push({ code, ...(params ? { params } : {}), message: rules.t(code, params), position: positionOf(node) });
};
const validateExpression = (checking, estree, node, source) => {
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
const validateName = (checking, node) => {
    const name = "name" in node && typeof node.name === "string" ? node.name : "";
    // A fragment (`<>`) has no name, so it cannot be checked — attribute and expression checks still apply.
    if (!name)
        return;
    if (RETIRED_JSX_NAMES.has(name)) {
        pushError(checking, "retired_jsx_element", node, { name });
        return;
    }
    if (!checking.rules.registry.REGISTERED_JSX_NAMES.has(name)) {
        pushError(checking, "disallowed_jsx_element", node, { name });
    }
};
const validateAttributes = (checking, node) => {
    const attributes = "attributes" in node && Array.isArray(node.attributes) ? node.attributes : [];
    for (const raw of attributes) {
        const attribute = raw;
        const target = attribute.position ? attribute : node;
        if (attribute.type === "mdxJsxExpressionAttribute") {
            pushError(checking, "spread_attribute", target);
            continue;
        }
        if (attribute.type !== "mdxJsxAttribute")
            continue;
        if (attribute.name && EVENT_HANDLER_NAME.test(attribute.name)) {
            pushError(checking, "event_handler_attribute", target, { name: attribute.name });
        }
        if (typeof attribute.value === "string" || attribute.value == null)
            continue;
        if (attribute.value.type !== "mdxJsxAttributeValueExpression")
            continue;
        validateExpression(checking, attribute.value.data?.estree, target, attribute.value.value ?? "");
    }
};
const validateNode = (checking, node) => {
    if (node.type === "mdxjsEsm") {
        pushError(checking, "esm_not_allowed", node);
    }
    if (node.type === "mdxFlowExpression" || node.type === "mdxTextExpression") {
        const value = typeof node.value === "string" ? node.value : "";
        validateExpression(checking, node.data?.estree, node, value);
    }
    if (node.type === "mdxJsxFlowElement" || node.type === "mdxJsxTextElement") {
        validateName(checking, node);
        validateAttributes(checking, node);
        const rule = typeof node.name === "string" ? checking.rules.childRules.get(node.name) : undefined;
        if (rule) {
            const count = namedJsxChildren(node, rule.children).length;
            if (count < rule.min || count > rule.max) {
                const base = { name: node.name, min: rule.min, children: rule.children.join("·") };
                if (Number.isFinite(rule.max))
                    pushError(checking, "child_count_range", node, { ...base, max: rule.max });
                else
                    pushError(checking, "child_count_min", node, base);
            }
        }
    }
    const children = "children" in node && Array.isArray(node.children) ? node.children : [];
    for (const child of children) {
        validateNode(checking, child);
    }
};
/** `syntax` is the syntax extensions to read with (none: standard MDX). */
export const analyze = (site, mdx, name, syntax) => {
    const rules = rulesOf(site);
    const { raw, body } = splitFrontmatter(mdx);
    const sourceLineOffset = raw === null ? 0 : mdx.slice(0, mdx.length - body.length).split(/\r?\n/).length - 1;
    const errors = [];
    const checking = { errors, rules };
    let tree = null;
    let frontmatter = null;
    if (raw != null) {
        frontmatter = parseYamlMapping(raw);
    }
    try {
        tree = parseMdxAst(site, body, syntax);
        validateNode(checking, tree);
    }
    catch (error) {
        const position = { line: 1, column: 1 };
        if (error instanceof Error)
            errors.push({ code: "mdx_syntax", message: error.message, position });
        else
            errors.push({ code: "parse_failed", message: rules.t("parse_failed"), position });
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
