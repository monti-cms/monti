import type { CmsJsonValue } from "./types";

type EstreeNode = {
	type: string;
	value?: unknown;
	raw?: string;
	operator?: string;
	argument?: EstreeNode;
	elements?: Array<EstreeNode | null>;
	properties?: EstreeNode[];
	key?: EstreeNode;
	valueNode?: EstreeNode;
	name?: string;
	method?: boolean;
	computed?: boolean;
	kind?: string;
	shorthand?: boolean;
	expressions?: EstreeNode[];
	quasis?: Array<{ value?: { cooked?: string } }>;
	body?: EstreeNode[] | EstreeNode;
	expression?: EstreeNode | boolean;
};

const asNode = (value: unknown): EstreeNode | null => {
	if (!value || typeof value !== "object" || !("type" in value)) return null;
	return value as EstreeNode;
};

export const isStaticEstree = (node: unknown): boolean => {
	const current = asNode(node);
	if (!current) return false;

	switch (current.type) {
		case "Literal":
			return current.value === null || ["string", "number", "boolean"].includes(typeof current.value);
		case "UnaryExpression":
			return (current.operator === "+" || current.operator === "-") && isStaticEstree(current.argument);
		case "ArrayExpression":
			return (current.elements ?? []).every((element) => element != null && isStaticEstree(element));
		case "ObjectExpression":
			return (current.properties ?? []).every((property) => {
				if (property.type !== "Property") return false;
				if (property.method || property.computed || property.kind !== "init") return false;
				const key = property.key;
				if (!key) return false;
				const keyOk = key.type === "Identifier" || (key.type === "Literal" && typeof key.value === "string");
				return keyOk && isStaticEstree((property as EstreeNode & { value?: EstreeNode }).value);
			});
		case "TemplateLiteral":
			return (current.expressions ?? []).length === 0;
		default:
			return false;
	}
};

export const estreeToJson = (node: unknown): CmsJsonValue => {
	const current = asNode(node);
	if (!current) return null;

	switch (current.type) {
		case "Literal":
			if (current.value === null || ["string", "number", "boolean"].includes(typeof current.value)) {
				return current.value as CmsJsonValue;
			}
			return null;
		case "UnaryExpression": {
			const argument = estreeToJson(current.argument);
			if (typeof argument !== "number") return null;
			return current.operator === "-" ? -argument : argument;
		}
		case "ArrayExpression":
			return (current.elements ?? []).map((element) => estreeToJson(element));
		case "ObjectExpression": {
			const record: Record<string, CmsJsonValue> = {};
			for (const property of current.properties ?? []) {
				const keyNode = property.key;
				const valueNode = (property as EstreeNode & { value?: EstreeNode }).value;
				if (!keyNode) continue;
				const key =
					keyNode.type === "Identifier" ? (keyNode.name ?? "") : typeof keyNode.value === "string" ? keyNode.value : "";
				if (!key) continue;
				record[key] = estreeToJson(valueNode);
			}
			return record;
		}
		case "TemplateLiteral":
			return current.quasis?.map((part) => part.value?.cooked ?? "").join("") ?? "";
		default:
			return null;
	}
};

export const programExpression = (estree: unknown): unknown => {
	const program = asNode(estree);
	if (!program || program.type !== "Program") return estree;
	const body = Array.isArray(program.body) ? program.body[0] : null;
	const statement = asNode(body);
	if (statement?.type === "ExpressionStatement") return statement.expression;
	return estree;
};

export const isCallExpression = (node: unknown): boolean => {
	const current = asNode(node);
	if (!current) return false;
	if (current.type === "CallExpression" || current.type === "NewExpression") return true;
	if (current.type === "Program") return isCallExpression(programExpression(current));
	if (current.type === "ExpressionStatement") return isCallExpression(current.expression);
	return false;
};

export const isIdentifierExpression = (node: unknown): boolean => {
	const current = asNode(node);
	if (!current) return false;
	if (current.type === "Identifier") return true;
	if (current.type === "MemberExpression") return true;
	if (current.type === "Program") return isIdentifierExpression(programExpression(current));
	if (current.type === "ExpressionStatement") return isIdentifierExpression(current.expression);
	return false;
};

export const hasSpread = (node: unknown): boolean => {
	const current = asNode(node);
	if (!current) return false;
	if (current.type === "SpreadElement") return true;
	if (current.type === "ObjectExpression") {
		return (current.properties ?? []).some((property) => property.type === "SpreadElement" || hasSpread(property));
	}
	if (current.type === "ArrayExpression") {
		return (current.elements ?? []).some((element) => hasSpread(element));
	}
	if (current.type === "Program") return hasSpread(programExpression(current));
	if (current.type === "ExpressionStatement") return hasSpread(current.expression);
	return false;
};
