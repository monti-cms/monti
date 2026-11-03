// Generates the screen spec's catalog from the real prop types of the parts it can name (`packages/ui/src/spec/parts.tsx`). Run from the repo root:
// `pnpm gen:screen-catalog`. `pnpm gen:screen-catalog --check` (CI) writes nothing and fails when the catalog differs from what the script would write.
//
// Writes `packages/ui/src/spec/screen-catalog.generated.json`: for each part, the props a spec may set and the values each takes (a union of literals
// becomes its list of choices), the named places (`slots`: its `ReactNode` props) and whether it takes children. Left out: `className`, `style`, handlers,
// refs, and every prop a part inherits from an HTML element but those in `HTML_PROPS`.
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

/** The strings of an array literal (`[...] as const`, or `new Set([...])`). */
function strings(node) {
	const found = [];
	const visit = (child) => {
		if (ts.isStringLiteral(child)) found.push(child.text);
		ts.forEachChild(child, visit);
	};
	visit(node);
	return found;
}

const htmlProps = new Set(strings(constant("HTML_PROPS").initializer));
const containers = new Set(strings(constant("CONTAINERS").initializer));
const pixelProps = new Set(strings(constant("PIXEL_PROPS").initializer));
/** `DATA_FIELDS`: for each `Part.prop` filled from the data, the fields its items may have. */
const dataFields = new Map(
	constant("DATA_FIELDS").initializer.properties.map((property) => [property.name.text, strings(property.initializer)]),
);
const partsDeclaration = constant("parts");
const SHAPING = /^(className|style|ref|key)$|ClassName$/;
const isFunction = (type) =>
	(type.isUnion() ? type.types : [type]).some((member) => member.getCallSignatures().length > 0);
const isReactNode = (type) => /\bReact(Node|Element|Portal)\b/.test(checker.typeToString(type));

/** What a spec may write for one prop, or undefined when no spec value fits it (a function, an object). */
function ruleOf(type) {
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
	if (types.every((member) => member.flags & ts.TypeFlags.Number)) return { type: "number" };
	return undefined;
}

const catalog = {};
for (const part of checker.getTypeAtLocation(partsDeclaration.name).getProperties()) {
	const component = checker.getTypeOfSymbolAtLocation(part, partsDeclaration);
	const [parameter] = component.getCallSignatures()[0]?.getParameters() ?? [];
	const entry = { container: containers.has(part.name), children: false, slots: [], props: {}, events: [] };
	if (parameter) {
		const propsType = checker.getTypeOfSymbolAtLocation(parameter, partsDeclaration);
		for (const prop of propsType.getProperties()) {
			if (prop.name === "children") {
				entry.children = true;
				continue;
			}
			const own = (prop.getDeclarations() ?? []).some((declaration) =>
				declaration.getSourceFile().fileName.startsWith(path.join(UI, "src")),
			);
			if (SHAPING.test(prop.name) || !(own || htmlProps.has(prop.name))) continue;
			if (pixelProps.has(`${part.name}.${prop.name}`)) continue;
			const type = checker.getTypeOfSymbolAtLocation(prop, partsDeclaration);
			// A handler or a render function: a spec cannot hold one yet, so it is listed for the step that wires behavior by name.
			if (/^on[A-Z]/.test(prop.name) || isFunction(type)) {
				entry.events.push(prop.name);
			} else if (isReactNode(type)) entry.slots.push(prop.name);
			else if (dataFields.has(`${part.name}.${prop.name}`)) {
				// A list or an object (a list head's columns, a menu's options): only the data gives it, and only with these fields.
				entry.props[prop.name] = { type: "data", fields: dataFields.get(`${part.name}.${prop.name}`) };
			} else {
				const value = ruleOf(type);
				if (value) entry.props[prop.name] = value;
			}
		}
	}
	entry.slots.sort();
	entry.events.sort();
	entry.props = Object.fromEntries(Object.entries(entry.props).sort(([a], [b]) => a.localeCompare(b)));
	catalog[part.name] = entry;
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
