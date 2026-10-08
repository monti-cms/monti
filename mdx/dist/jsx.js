import { estreeToJson, isStaticEstree, programExpression } from "./expressions.js";
export const positionOf = (node) => {
    const start = node?.position?.start;
    return {
        line: start?.line && start.line > 0 ? start.line : 1,
        column: start?.column && start.column > 0 ? start.column : 1,
    };
};
export const readJsxAttributes = (attributes) => {
    const result = [];
    for (const raw of attributes ?? []) {
        const attribute = raw;
        if (attribute.type === "mdxJsxExpressionAttribute") {
            result.push({
                spread: true,
                expression: typeof attribute.value === "string" ? attribute.value : "",
            });
            continue;
        }
        if (attribute.type !== "mdxJsxAttribute" || !attribute.name)
            continue;
        if (attribute.value == null) {
            result.push({ name: attribute.name, value: true });
            continue;
        }
        if (typeof attribute.value === "string") {
            result.push({ name: attribute.name, value: attribute.value });
            continue;
        }
        const expression = attribute.value;
        if (expression?.type === "mdxJsxAttributeValueExpression") {
            const estree = programExpression(expression.data?.estree);
            if (isStaticEstree(estree)) {
                result.push({ name: attribute.name, value: estreeToJson(estree) });
            }
            else {
                result.push({
                    name: attribute.name,
                    expression: typeof expression.value === "string" ? expression.value : "",
                });
            }
        }
    }
    return result;
};
export const attributeRecord = (attributes) => {
    const record = {};
    for (const attribute of attributes) {
        if (attribute.spread) {
            record.spread = attribute.expression ?? true;
            continue;
        }
        if (!attribute.name)
            continue;
        if (attribute.value !== undefined) {
            record[attribute.name] = attribute.value;
            continue;
        }
        if (attribute.expression !== undefined) {
            record[attribute.name] = attribute.expression;
        }
    }
    return record;
};
