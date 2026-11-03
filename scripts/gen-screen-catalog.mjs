// Generates the screen spec's catalog from the real prop types of the parts it can name (`packages/ui/src/spec/parts.tsx`). Run from the repo root:
// `pnpm gen:screen-catalog`. `pnpm gen:screen-catalog --check` (CI) writes nothing and fails when the catalog differs from what the script would write.
//
// Writes `packages/ui/src/spec/screen-catalog.generated.json`: for each entry its kind (`part` or `layout`), the props a spec may set with each prop's
// kind and values, the named places (`slots`: its `ReactNode` props), its events and whether it takes children. Only the props `CATALOG` gives a kind are
// in (default deny), and each kind is checked against the prop's real type: a layout size on a part, or a variant whose type is not a list of choices,
// stops the build.
//
// TypeScript 7 has no compiler API in JavaScript yet, so this reads the types with TypeScript 5 (`typescript-api` in packages/ui).
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const UI = path.join(ROOT, "packages/ui");
const PARTS = path.join(UI, "src/spec/parts.tsx");
const OUT = path.join(UI, "src/spec/screen-catalog.generated.json");
const ts = createRequire(path.join(UI, "package.json"))("typescript-api");

const program = ts.createProgram([PARTS], {
	jsx: ts.JsxEmit.ReactJSX,
	strict: true,
	module: ts.ModuleKind.ESNext,
	moduleResolution: ts.ModuleResolutionKind.Bundler,
	target: ts.ScriptTarget.ES2022,
	skipLibCheck: true,
});
const checker = program.getTypeChecker();
const source = program.getSourceFile(PARTS);

/** The initializer of an exported `const` of parts.tsx. */
function constant(name) {
	for (const statement of source.statements) {
		if (!ts.isVariableStatement(statement)) continue;
		for (const declaration of statement.declarationList.declarations) {
			if (declaration.name.getText() === name) return declaration;
		}
	}
	throw new Error(`parts.tsx has no \`${name}\``);
}

/** A literal in parts.tsx (`{ kind: "part", props: { variant: "variant" } }`) as a plain value. */
function literal(node) {
	if (ts.isStringLiteral(node)) return node.text;
	if (ts.isObjectLiteralExpression(node)) {
		return Object.fromEntries(node.properties.map((property) => [property.name.text, literal(property.initializer)]));
	}
	throw new Error(`parts.tsx: \`CATALOG\` holds only strings and objects, not "${node.getText()}"`);
}

const declared = literal(constant("CATALOG").initializer);
const partsDeclaration = constant("parts");
const isFunction = (type) =>
	(type.isUnion() ? type.types : [type]).some((member) => member.getCallSignatures().length > 0);
const isReactNode = (type) => /\bReact(Node|Element|Portal)\b/.test(checker.typeToString(type));

/** The values a prop's type takes: a list of literals, or `boolean`, `string`, `number`; undefined for anything else. */
function valuesOf(type) {
	const types = (type.isUnion() ? type.types : [type]).filter(
		(member) => !(member.flags & (ts.TypeFlags.Undefined | ts.TypeFlags.Null)),
	);
	if (types.length === 0) return undefined;
	if (types.every((member) => member.flags & ts.TypeFlags.BooleanLiteral)) return { type: "boolean" };
	if (types.every((member) => member.isStringLiteral() || member.isNumberLiteral())) {
		return { enum: types.map((member) => member.value).sort((a, b) => String(a).localeCompare(String(b))) };
	}
	// A union of literals with `string & {}` (`HTMLInputTypeAttribute`, `autoComplete`) takes any string.
	const stringLike = (member) =>
		member.flags & (ts.TypeFlags.String | ts.TypeFlags.StringLiteral | ts.TypeFlags.TemplateLiteral) ||
		(member.isIntersection() && member.types.some((part) => part.flags & ts.TypeFlags.String));
	if (types.every(stringLike)) return { type: "string" };
	if (types.every((member) => member.flags & (ts.TypeFlags.Number | ts.TypeFlags.NumberLiteral)))
		return { type: "number" };
	return undefined;
}

const problems = [];
/** The rule of one declared prop, checked against its type: a kind its type cannot be is a mistake in `CATALOG`, and the catalog does not build. */
function ruleOf(partName, entryKind, name, kind, type) {
	const where = `${partName}.${name} (${kind})`;
	const values = valuesOf(type);
	const wrong = (what) => {
		problems.push(`${where}: ${what}`);
		return undefined;
	};
	if (kind.startsWith("data:")) return { kind: "data", fields: kind.slice(5).split(",") };
	switch (kind) {
		case "variant":
			return values?.enum ? { kind, enum: values.enum } : wrong("a variant is a list of choices, and its type is not");
		case "flag":
			return values?.type === "boolean" ? { kind, type: "boolean" } : wrong("a flag is a boolean, and its type is not");
		case "layout":
			if (entryKind !== "layout") return wrong("layout is only for layout entries");
			return values?.enum || values?.type === "boolean"
				? { kind, ...values }
				: wrong("layout is a list of choices or a boolean");
		case "layout-number":
			if (entryKind !== "layout") return wrong("a size in px is only for layout entries, never on a part");
			return values?.type === "number" ? { kind, type: "number" } : wrong("a layout number is a number");
		case "text":
			return values?.type === "string" ? { kind, type: "string" } : wrong("a text is a string");
		case "ref":
			return values?.type === "string" ? { kind, type: "string" } : wrong("a reference is the name of an element");
		case "state":
			return values ? { kind } : wrong("a value from the state is a plain value");
		case "action":
			return values?.type === "string"
				? { kind, type: "string" }
				: wrong("an action is an address the page gives by name");
		default:
			return wrong(`"${kind}" is not a kind`);
	}
}

const catalog = {};
for (const part of checker.getTypeAtLocation(partsDeclaration.name).getProperties()) {
	const declaration = declared[part.name];
	if (!declaration) {
		problems.push(`${part.name}: in \`parts\` but not in \`CATALOG\`; decide its kind and its props' kinds`);
		continue;
	}
	const component = checker.getTypeOfSymbolAtLocation(part, partsDeclaration);
	const [parameter] = component.getCallSignatures()[0]?.getParameters() ?? [];
	const propsType = parameter ? checker.getTypeOfSymbolAtLocation(parameter, partsDeclaration) : undefined;
	const entry = {
		kind: declaration.kind,
		bind: declaration.bind === "yes",
		children: false,
		slots: [],
		props: {},
		events: [],
	};
	const typed = new Map((propsType?.getProperties() ?? []).map((prop) => [prop.name, prop]));
	// Children and named places come from the type: they hold elements, not values.
	for (const [name, prop] of typed) {
		const type = checker.getTypeOfSymbolAtLocation(prop, partsDeclaration);
		if (name === "children") entry.children = true;
		else if (
			isReactNode(type) &&
			!isFunction(type) &&
			name in (declaration.props ?? {}) === false &&
			!/ClassName$/.test(name)
		) {
			entry.slots.push(name);
		}
	}
	for (const [name, kind] of Object.entries(declaration.props ?? {})) {
		const prop = typed.get(name);
		if (!prop) {
			problems.push(`${part.name}.${name}: declared in \`CATALOG\`, but the part has no such prop`);
			continue;
		}
		if (kind === "event") {
			entry.events.push(name);
			continue;
		}
		const rule = ruleOf(
			part.name,
			declaration.kind,
			name,
			kind,
			checker.getTypeOfSymbolAtLocation(prop, partsDeclaration),
		);
		if (rule) entry.props[name] = rule;
	}
	entry.slots.sort();
	entry.events.sort();
	entry.props = Object.fromEntries(Object.entries(entry.props).sort(([a], [b]) => a.localeCompare(b)));
	catalog[part.name] = entry;
}
for (const name of Object.keys(declared))
	if (!(name in catalog) && !problems.some((p) => p.startsWith(name))) {
		problems.push(`${name}: in \`CATALOG\` but not in \`parts\``);
	}
if (problems.length > 0) {
	console.error(`The screen catalog does not build:\n${problems.map((problem) => `  ${problem}`).join("\n")}`);
	process.exit(1);
}

// Written as Biome formats it, so \`pnpm lint\` and \`--check\` agree.
const text = execFileSync("pnpm", ["exec", "biome", "format", `--stdin-file-path=${OUT}`], {
	cwd: ROOT,
	input: JSON.stringify(catalog, null, "\t"),
	encoding: "utf8",
});
if (process.argv.includes("--check")) {
	let current = "";
	try {
		current = readFileSync(OUT, "utf8");
	} catch {}
	if (current !== text) {
		console.error(`${path.relative(ROOT, OUT)} is out of date: run \`pnpm gen:screen-catalog\`.`);
		process.exit(1);
	}
} else {
	writeFileSync(OUT, text);
	console.log(`wrote ${path.relative(ROOT, OUT)} (${Object.keys(catalog).length} parts)`);
}
