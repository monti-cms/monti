import { IDENTIFIER, type Schema } from "./define";

const key = (name: string) => (IDENTIFIER.test(name) ? name : JSON.stringify(name));

function literal(value: unknown, indent: string): string {
	if (Array.isArray(value)) return `[${value.map((element) => literal(element, indent)).join(", ")}]`;
	if (typeof value === "object" && value !== null) {
		const entries = Object.entries(value).filter(([, element]) => element !== undefined);
		if (entries.length === 0) return "{}";
		const inner = `${indent}\t`;
		const flat = `{ ${entries.map(([name, element]) => `${key(name)}: ${literal(element, inner)}`).join(", ")} }`;
		// A field fits on one line; a collection or the list of fields does not.
		if (
			flat.length <= 100 &&
			!entries.some(([, element]) => typeof element === "object" && element !== null && !Array.isArray(element))
		)
			return flat;
		return `{\n${entries.map(([name, element]) => `${inner}${key(name)}: ${literal(element, inner)},`).join("\n")}\n${indent}}`;
	}
	return JSON.stringify(value);
}

/** `monti.schema.ts` as the admin writes it: one plain value, so a person and the admin can both edit it. */
export function schemaSource(schema: Schema): string {
	return `import { defineSchema } from "@monti-cms/core";\n\nexport default defineSchema(${literal(schema, "")});\n`;
}
