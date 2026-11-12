// A screen's banner stands at the very top of the screen (docs/design/admin/screens/common.md, "화면의 알림 띠"). `check:design` runs this as its
// `banner-place` rule over the screens: the admin's, the plugins' and the reference screens of `packages/ui/src/screens`.
//
// The files are parsed, and three things are top places:
// - the `banner` of `SidebarInset` or `StandalonePage` (the frame's own banners, an editor's);
// - the children of `PageBanner` (a page's own banner, drawn into the frame's top place);
// - the `banner` of a component of the checked code that has a `banner` prop: its own body is held to the second rule below.
//
// The rules:
// 1. A `<Banner>` stands in a top place, or is what its component returns (alone, behind a condition, or in a fragment of nothing but banners). A
//    component that returns a banner is a banner itself: wherever it is drawn (`<SessionEndedBanner />`) the same rule holds, through any number
//    of files.
// 2. A `banner` prop is only passed on to a top place, or asked about (`banner ? … : …`), in its component and in every helper written inside
//    it that uses it.
//
// A component is a function under a name, also one wrapped in `memo` or `forwardRef`, or named a second time (`const Notice = memo(Plain)`).
//
// What it cannot see:
// - that a top place is at the top. That is the parts' own work (`SidebarInset`, `StandalonePage`), measured by their tests; a `PageBanner` with no
//   frame around it draws where it stands.
// - a banner that reaches the screen as a value: kept in an object or a list, passed under a prop not named `banner` and drawn by a component
//   outside the checked code, or spread in (`{...props}`).
// - a banner component it cannot follow by name: exported under another name (`export { A as B }`, a default export, `export *`), or taken from a
//   package other than `@monti-cms/ui`, or written under a namespace (`<ui.Banner>`).
// - something that looks like a banner and is not one (a `Box` with the banner's ground). `drawing-only` keeps raw styling out of screens.
// - the mockups of the spec pack (`*.screen.json`): they are not code (tracker T150).
import path from "node:path";

let parseSync = () => {
	throw new Error("oxc-parser is not installed (pnpm install)");
};
try {
	({ parseSync } = await import("oxc-parser"));
} catch {
	// Said when a file is read.
}

/** The parts of `@monti-cms/ui` the rule knows, and the files of the package a reference screen takes them from. */
const UI_PARTS = new Set(["Banner", "PageBanner", "SidebarInset", "StandalonePage"]);
const UI_FILES = /^packages\/ui\/src\/(?:index|internal|banner|sidebar|page-banner)\.tsx?$/;
/** The parts whose `banner` is the top place. */
const TOP_PARTS = new Set(["ui#SidebarInset", "ui#StandalonePage"]);

const FUNCTIONS = new Set(["FunctionDeclaration", "FunctionExpression", "ArrowFunctionExpression"]);
/** Wrappers a value passes through unchanged. */
const THROUGH = new Set(["ParenthesizedExpression", "TSAsExpression", "TSNonNullExpression", "TSSatisfiesExpression"]);

const nameOf = (jsxName) => (jsxName?.type === "JSXIdentifier" ? jsxName.name : null);

/** What one file says: its imports, its components (with whether each has a `banner` prop), and every node with the nodes around it. */
function read(file, text, known) {
	const { program, errors } = parseSync(file, text);
	if (errors.length > 0) return null;
	const imports = new Map();
	const components = new Map();
	const nodes = [];
	const resolve = (from) => {
		if (from === "@monti-cms/ui" || from === "@monti-cms/ui/internal") return "ui";
		if (!from.startsWith(".")) return null;
		const base = path.posix.join(path.posix.dirname(file), from);
		for (const end of ["", ".tsx", ".ts", "/index.tsx", "/index.ts"]) {
			if (UI_FILES.test(base + end)) return "ui";
			if (known.has(base + end)) return base + end;
		}
		return null;
	};
	const walk = (node, parents) => {
		if (!node || typeof node !== "object") return;
		if (Array.isArray(node)) {
			for (const each of node) walk(each, parents);
			return;
		}
		if (typeof node.type !== "string") return;
		nodes.push({ node, parents });
		if (node.type === "ImportDeclaration" && node.importKind !== "type") {
			const from = resolve(node.source.value);
			for (const specifier of node.specifiers ?? [])
				if (from && specifier.type === "ImportSpecifier" && specifier.importKind !== "type")
					imports.set(specifier.local.name, { from, name: specifier.imported.name ?? specifier.imported.value });
		}
		// A component is a function under a name: declared, kept in a `const`, or wrapped on the way (`memo(function () {…})`). A `const` that
		// only names another component (`memo(Plain)`, `const Notice = Plain`) is that component under a second name.
		const named =
			node.type === "FunctionDeclaration" && node.id
				? { name: node.id.name, fn: node }
				: node.type === "VariableDeclarator" && node.id.type === "Identifier"
					? { name: node.id.name, ...wrapped(node.init) }
					: null;
		if (named?.fn) components.set(named.name, { fn: named.fn, bannerProp: bannerPropOf(named.fn) });
		else if (named?.aliasOf) components.set(named.name, { aliasOf: named.aliasOf });
		const around = [...parents, node];
		for (const key of Object.keys(node)) if (key !== "type") walk(node[key], around);
	};
	walk(program, []);
	return { imports, components, nodes, lineAt: (offset) => text.slice(0, offset).split("\n").length };
}

function unwrap(node) {
	let inner = node;
	while (inner && THROUGH.has(inner.type)) inner = inner.expression;
	return inner;
}

/** React's wrappers that give back the component they take: `memo(…)`, `forwardRef(…)`, alone or as `React.memo(…)`, one inside the other. */
const WRAPPERS = new Set(["memo", "forwardRef"]);
const isWrapper = (callee) =>
	(callee.type === "Identifier" && WRAPPERS.has(callee.name)) ||
	(callee.type === "MemberExpression" && !callee.computed && WRAPPERS.has(callee.property.name));

/** What a `const` holds, when it is a component: its function (`{ fn }`), or the name of another component (`{ aliasOf }`). */
function wrapped(init) {
	const inner = unwrap(init);
	if (!inner) return {};
	if (FUNCTIONS.has(inner.type)) return { fn: inner };
	if (inner.type === "Identifier") return { aliasOf: inner.name };
	if (inner.type === "CallExpression" && isWrapper(inner.callee)) return wrapped(inner.arguments[0]);
	return {};
}

/** The names a pattern binds (`{ banner, rest: [first] }`). */
function namesOf(pattern) {
	if (!pattern) return [];
	if (pattern.type === "Identifier") return [pattern.name];
	if (pattern.type === "AssignmentPattern") return namesOf(pattern.left);
	if (pattern.type === "RestElement") return namesOf(pattern.argument);
	if (pattern.type === "TSParameterProperty") return namesOf(pattern.parameter);
	if (pattern.type === "ArrayPattern") return pattern.elements.flatMap(namesOf);
	if (pattern.type === "ObjectPattern")
		return pattern.properties.flatMap((property) => namesOf(property.type === "Property" ? property.value : property));
	return [];
}

/** The names a statement declares where it stands (`const`, `function`, `class`, behind an `export` too). */
function declared(statement) {
	const inner = /^Export(Named|Default)Declaration$/.test(statement?.type) ? statement.declaration : statement;
	if (inner?.type === "VariableDeclaration") return inner.declarations.flatMap((each) => namesOf(each.id));
	if (inner?.type === "FunctionDeclaration" || inner?.type === "ClassDeclaration")
		return inner.id ? [inner.id.name] : [];
	return [];
}

/**
 * Whether a node gives a name a meaning of its own for what is inside it: a function's parameters (and its own name), the declarations of a block,
 * the variable of a loop, what a `catch` takes.
 */
function declares(scope, name) {
	if (FUNCTIONS.has(scope.type)) return [...scope.params.flatMap(namesOf), scope.id?.name].includes(name);
	if (scope.type === "BlockStatement" || scope.type === "Program" || scope.type === "StaticBlock")
		return scope.body.some((statement) => declared(statement).includes(name));
	if (scope.type === "SwitchStatement")
		return scope.cases.some((each) => each.consequent.some((statement) => declared(statement).includes(name)));
	if (scope.type === "ForStatement") return declared(scope.init).includes(name);
	if (scope.type === "ForInStatement" || scope.type === "ForOfStatement") return declared(scope.left).includes(name);
	if (scope.type === "CatchClause") return namesOf(scope.param).includes(name);
	return false;
}

/**
 * The function whose `banner` prop a name is, where it is used: the nearest thing around the use that gives the name a meaning is that function's
 * own parameters. So a helper written inside a component (`const Body = () => <PageBody>{banner}</PageBody>`) uses the component's prop, and a
 * helper with a `banner` of its own (a parameter, a `const`) does not.
 */
function bannerPropOwner(name, parents) {
	const scope = parents.findLast((each) => declares(each, name));
	return scope && FUNCTIONS.has(scope.type) && bannerPropOf(scope) === name ? scope : null;
}

/** The local name a component gives its `banner` prop (`{ banner }`, `{ banner: shown }`), or null. */
function bannerPropOf(fn) {
	// `({ banner })`, and `({ banner } = {})` for a component whose props are all optional.
	const first = fn.params?.[0];
	const props = first?.type === "AssignmentPattern" ? first.left : first;
	if (props?.type !== "ObjectPattern") return null;
	for (const property of props.properties) {
		if (property.type !== "Property" || property.key?.name !== "banner") continue;
		const value = property.value?.type === "AssignmentPattern" ? property.value.left : property.value;
		if (value?.type === "Identifier") return value.name;
	}
	return null;
}

/** The function a node is in, with the nodes between the two (nearest last). */
function functionAround(parents) {
	for (let index = parents.length - 1; index >= 0; index -= 1)
		if (FUNCTIONS.has(parents[index].type)) return { fn: parents[index], between: parents.slice(index + 1) };
	return null;
}

/**
 * Whether a node is what its function returns: on the way up to the `return` (or to the arrow's own body) there is nothing but conditions, fragments
 * and wrappers. A node in the test of a condition is not returned. Gives the function and the fragments passed on the way, or null.
 */
function returned(node, parents) {
	const around = functionAround(parents);
	if (!around) return null;
	const fragments = [];
	let child = node;
	for (let index = around.between.length - 1; index >= 0; index -= 1) {
		const parent = around.between[index];
		if (parent.type === "ReturnStatement") {
			// A `return` inside a block of the function: nothing but statements between it and the function.
			const outside = around.between.slice(0, index);
			return outside.every((each) => /Statement$|^SwitchCase$|^CatchClause$/.test(each.type))
				? { fn: around.fn, fragments }
				: null;
		}
		const passes =
			THROUGH.has(parent.type) ||
			parent.type === "JSXFragment" ||
			parent.type === "JSXExpressionContainer" ||
			(parent.type === "ConditionalExpression" && parent.test !== child) ||
			(parent.type === "LogicalExpression" && (parent.right === child || parent.operator !== "&&"));
		if (!passes) return null;
		if (parent.type === "JSXFragment") fragments.push(parent);
		child = parent;
	}
	// No `return` on the way: the node is the body of an arrow function.
	return around.fn.type === "ArrowFunctionExpression" && around.fn.body === child ? { fn: around.fn, fragments } : null;
}

/** What an expression can come to: the ends of its conditions, fragments and wrappers. */
function ends(node) {
	if (!node) return [];
	if (THROUGH.has(node.type) || node.type === "JSXExpressionContainer") return ends(node.expression);
	if (node.type === "ConditionalExpression") return [...ends(node.consequent), ...ends(node.alternate)];
	if (node.type === "LogicalExpression")
		return [...(node.operator === "&&" ? [] : ends(node.left)), ...ends(node.right)];
	if (node.type === "JSXFragment") return node.children.flatMap(ends);
	return [node];
}
/** An end that draws nothing: `null`, `false`, `undefined`, an empty `{}` (a comment), the space between tags. */
const draws = (node) =>
	!(
		(node.type === "Literal" && (node.value === null || node.value === false)) ||
		(node.type === "Identifier" && node.name === "undefined") ||
		node.type === "JSXEmptyExpression" ||
		(node.type === "JSXText" && node.value.trim() === "")
	);

/** Whether a node is only asked about: the test of a condition, the left of `&&`, under `!`. */
function asked(node, parents) {
	const parent = parents.at(-1);
	if (!parent) return false;
	if ((parent.type === "ConditionalExpression" || parent.type === "IfStatement") && parent.test === node) return true;
	if (parent.type === "LogicalExpression" && parent.left === node && parent.operator === "&&") return true;
	return parent.type === "UnaryExpression" && parent.operator === "!";
}

/**
 * What is wrong with where the banners of these files stand.
 * @param {Record<string, string>} files Repo-relative path → source, of the screens to check (every file a banner may pass through).
 * @returns {{ file: string, line: number, message: string }[]}
 */
export function problems(files) {
	const known = new Set(Object.keys(files));
	const found = [];
	const facts = new Map();
	for (const [file, text] of Object.entries(files)) {
		const fact = read(file, text, known);
		if (fact) facts.set(file, fact);
		else found.push({ file, line: 1, message: "cannot be parsed, so where its banners stand is not checked" });
	}

	/** What a name means in a file: `ui#Banner`, `<file>#<component>`, or null for anything the check does not follow. */
	const meaning = (file, name, seen = new Set()) => {
		const fact = facts.get(file);
		if (!fact || !name) return null;
		const own = fact.components.get(name);
		// A second name for another component, here or imported (never back to itself).
		if (own?.aliasOf) return own.aliasOf === name || seen.has(name) ? null : meaning(file, own.aliasOf, seen.add(name));
		if (own) return `${file}#${name}`;
		const imported = fact.imports.get(name);
		if (!imported) return null;
		if (imported.from === "ui") return UI_PARTS.has(imported.name) ? `ui#${imported.name}` : null;
		return facts.get(imported.from)?.components.has(imported.name) ? meaning(imported.from, imported.name, seen) : null;
	};
	const componentOf = (key) => {
		const [file, name] = key?.split("#") ?? [];
		return facts.get(file)?.components.get(name) ?? null;
	};
	/** The component a function is, as its key, or null for a function with no name of its own (a callback). */
	const keyOfFunction = (file, fn) => {
		for (const [name, component] of facts.get(file).components) if (component.fn === fn) return `${file}#${name}`;
		return null;
	};

	/** What a node draws, as a meaning: an element's name, or the function a call calls. */
	const drawn = (file, node) =>
		node.type === "JSXElement"
			? meaning(file, nameOf(node.openingElement.name))
			: node.type === "CallExpression" && node.callee.type === "Identifier"
				? meaning(file, node.callee.name)
				: null;

	// The components that return a banner, through any number of others: found until nothing more is.
	const banners = new Set(["ui#Banner"]);
	for (let grew = true; grew; ) {
		grew = false;
		for (const [file, fact] of facts)
			for (const { node, parents } of fact.nodes) {
				if (!banners.has(drawn(file, node))) continue;
				const root = returned(node, parents);
				const key = root && keyOfFunction(file, root.fn);
				if (key && !banners.has(key)) {
					banners.add(key);
					grew = true;
				}
			}
	}

	/** Whether a node stands in a top place: under a `PageBanner`, or in the `banner` of a part or a component that has one. */
	const inTopPlace = (file, parents) =>
		parents.some((parent, index) => {
			if (parent.type === "JSXElement") {
				// Its children, not what stands in its attributes.
				return (
					meaning(file, nameOf(parent.openingElement.name)) === "ui#PageBanner" &&
					parents[index + 1] !== parent.openingElement
				);
			}
			if (parent.type !== "JSXAttribute" || nameOf(parent.name) !== "banner") return false;
			const owner = meaning(file, nameOf(parents[index - 1]?.name));
			return TOP_PARTS.has(owner) || Boolean(componentOf(owner)?.bannerProp);
		});

	const HOW =
		"A screen's banner stands at the very top: inside the frame give it with <PageBanner>, outside it in the `banner` of <StandalonePage> " +
		"(docs/design/admin/screens/common.md)";
	for (const [file, fact] of facts)
		for (const { node, parents } of fact.nodes) {
			const what = drawn(file, node);
			if (banners.has(what)) {
				if (inTopPlace(file, parents)) continue;
				// What a named component returns is that component's banner: the rule holds where the component is drawn.
				const root = returned(node, parents);
				if (root && keyOfFunction(file, root.fn)) {
					// Returned with something that is not a banner, the page would go to the top place with it.
					const other = root.fragments.flatMap(ends).find((end) => draws(end) && !banners.has(drawn(file, end)));
					if (other)
						found.push({
							file,
							line: fact.lineAt(other.start),
							message: `a banner is returned in a fragment with something that is not one. ${HOW}`,
						});
					continue;
				}
				const name = node.type === "JSXElement" ? `<${nameOf(node.openingElement.name)}>` : `${node.callee.name}()`;
				found.push({ file, line: fact.lineAt(node.start), message: `${name} is drawn outside the top place. ${HOW}` });
				continue;
			}
			// A `banner` prop: every use of it inside its component.
			if (node.type !== "Identifier") continue;
			const parent = parents.at(-1);
			const isUse =
				!(parent.type === "Property" && parents.at(-2)?.type === "ObjectPattern") &&
				!(parent.type === "AssignmentPattern" && parent.left === node) &&
				!(parent.type === "MemberExpression" && parent.property === node && !parent.computed) &&
				!(parent.type === "Property" && parent.key === node && !parent.computed && !parent.shorthand) &&
				!/^TS/.test(parent.type);
			if (!isUse) continue;
			// Whose prop the name is, through any helper written inside that component.
			if (!bannerPropOwner(node.name, parents)) continue;
			if (asked(node, parents) || inTopPlace(file, parents)) continue;
			found.push({
				file,
				line: fact.lineAt(node.start),
				message: `the \`${node.name}\` prop holds a banner and is passed on outside the top place. ${HOW}`,
			});
		}
	return found.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
}
