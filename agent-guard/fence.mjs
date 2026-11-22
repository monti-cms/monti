// The fence around the core's tests: what `docs/acceptance/README.md` and `docs/refactor/core.md` (9) require, checked by machine.
//
//   checkFence(root) returns the problems found under `packages/core/src` against `docs/acceptance/core`; an empty list is a pass.
//
// 1. Acceptance conditions (AC) and tests match one to one, and every `expect` has the result number of its AC above it.
// 2. Tests are not skipped, focused or empty, and the database is never faked.
// 3. No suppression comment hides a problem in the code.
// 4. `process.env` is read only as `process.env.NAME` for a variable declared in `packages/core/env.d.ts`, and never with a
//    written-in fallback value.
//
// Sources are read with the TypeScript parser, so a string that looks like a comment or a call is not mistaken for one.
// What it cannot see: a test API renamed on import (`import { it as spec }`), a mock target that is not a string literal,
// environment variables read another way than through `process` or `globalThis.process` (`import { env } from
// "node:process"`, `process[key]` with a key that is not a written string, `process` passed on under another name).

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const ACCEPTANCE_ROOT = "docs/acceptance";
export const CORE_SRC = "packages/core/src";

const SOURCE_FILE = /\.(?:[cm]?[jt]s|[jt]sx)$/;
export const TEST_FILE = /\.(?:test|spec)\.(?:[cm]?[jt]s|[jt]sx)$|(?:^|\/)__test__\//;

const ID = "[A-Z][A-Z0-9]*(?:-[A-Z][A-Z0-9]*)*-\\d+";
const AC_HEADER = new RegExp(
	`^(?:(${ID})\\s{2,}\\S|<summary><strong><code>(${ID})<\\/code><\\/strong>\\s+\\S.*<\\/summary>\\s*$)`,
);
const RESULT_LINE = new RegExp(`^\\s*(?:(?:결과\\s+)?(${ID}\\.\\d+)\\s+\\S|-\\s+\`(${ID}\\.\\d+)\`\\s+\\S)`);
const DEFERRED = /\[보류(?::[^\]]*)?\](?:<\/summary>)?\s*$/;
const TEST_TITLE = new RegExp(`^(${ID})\\s+(\\S.*)$`, "s");
const RESULT_COMMENT = new RegExp(`^//\\s*(${ID}\\.\\d+)\\s*$`);

const TEST_ROOTS = new Set(["it", "test", "describe"]);
const TEST_MODIFIERS = new Set(["concurrent", "sequential", "fails", "skip", "only", "todo"]);
const BANNED_MODIFIERS = new Set(["skip", "only", "todo", "skipIf", "runIf", "fails"]);
const PARAMETERIZED = new Set(["each", "for"]);
const BANNED_OPTIONS = new Set(["skip", "only", "todo"]);
const BANNED_NAMES = new Set(["xit", "xtest", "xdescribe", "fit", "fdescribe"]);

const SUPPRESSION = /biome-ignore|@ts-expect-error|@ts-nocheck|@ts-ignore|eslint-disable|Stryker\s+disable/;
const FAKE_DATABASE = /^(?:pg-mem|pglite|@electric-sql\/pglite[\w-]*|better-sqlite3|sql\.js)(?:\/|$)/;
const DATABASE_MODULE =
	/^(?:pg|postgres|drizzle[\w-]*|kysely|prisma|typeorm|@prisma\/[\w-]+)(?:\/|$)|(?:^|\/)db(?:\/|\.|$)|database/i;
const MOCK_METHODS = new Set(["mock", "doMock", "unstable_mockModule"]);
const DATABASE_WORDS = new Set(["db", "pool", "pg", "database"]);

// ---- TypeScript ----

/** The root of the main checkout when `root` is a linked worktree, or undefined. */
function mainCheckout(root) {
	const result = spawnSync("git", ["rev-parse", "--git-common-dir"], { cwd: root, encoding: "utf8" });
	if (result.status !== 0) return undefined;
	const common = path.resolve(root, result.stdout.trim());
	return path.basename(common) === ".git" ? path.dirname(common) : common;
}

/**
 * Loads TypeScript from this file, from `root`, or from the main checkout. A fresh git worktree has no `node_modules`
 * until it is installed, but the main checkout it was made from has one.
 */
export function loadTypeScript(root) {
	const tried = [];
	const candidates = [() => createRequire(import.meta.url), () => createRequire(path.join(root, "package.json"))];
	const main = () => {
		const mainRoot = mainCheckout(root);
		return mainRoot === undefined ? undefined : createRequire(path.join(mainRoot, "package.json"));
	};
	for (const candidate of [...candidates, main]) {
		try {
			const require = candidate();
			if (require === undefined) continue;
			const mod = require("typescript");
			const ts = mod?.default ?? mod;
			if (ts?.ScriptTarget) return ts;
		} catch (error) {
			tried.push(error.message.split("\n")[0]);
		}
	}
	throw new Error(
		`TypeScript was not found from the agent-guard folder, ${root} or the main checkout: run pnpm install (${tried.join("; ")})`,
	);
}

// ---- acceptance conditions ----

/** Reads `docs/acceptance/<pkg>/*.md` into a map of AC id to its results, and the problems in the documents. */
function readAcceptance(root, acDir) {
	const acs = new Map();
	const problems = [];
	const names = readdirOrEmpty(path.join(root, acDir), { recursive: true })
		.filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
		.map((entry) =>
			path.relative(path.join(root, acDir), path.join(entry.parentPath, entry.name)).split(path.sep).join("/"),
		)
		.sort();

	for (const name of names) {
		const file = `${acDir}/${name}`;
		let current;
		for (const [index, line] of readFileSync(path.join(root, file), "utf8").split(/\r?\n/).entries()) {
			const at = `${file}:${index + 1}`;
			const header = AC_HEADER.exec(line);
			const result = RESULT_LINE.exec(line);
			if (header) {
				const id = header[1] ?? header[2];
				current = { id, at, deferred: DEFERRED.test(line), results: new Map() };
				if (acs.has(id)) problems.push(`${at}: ${id} is already defined at ${acs.get(id).at}`);
				else acs.set(id, current);
			} else if (result) {
				const id = result[1] ?? result[2];
				if (!current) problems.push(`${at}: ${id} is not under an acceptance condition`);
				else if (!id.startsWith(`${current.id}.`)) problems.push(`${at}: ${id} is under ${current.id}`);
				else if (current.results.has(id))
					problems.push(`${at}: ${id} is already defined at ${current.results.get(id).at}`);
				else current.results.set(id, { at, deferred: current.deferred || DEFERRED.test(line) });
			}
		}
	}

	for (const ac of acs.values()) {
		if (!ac.deferred && ac.results.size === 0) problems.push(`${ac.at}: ${ac.id} has no result line`);
	}
	return { acs, problems };
}

function readdirOrEmpty(dir, options = {}) {
	try {
		return readdirSync(dir, { withFileTypes: true, ...options });
	} catch (error) {
		if (error.code === "ENOENT") return [];
		throw error;
	}
}

// ---- reading one source file ----

export function sourceFiles(root, srcDir = CORE_SRC) {
	return readdirOrEmpty(path.join(root, srcDir), { recursive: true })
		.filter((entry) => entry.isFile())
		.map((entry) => path.relative(root, path.join(entry.parentPath, entry.name)).split(path.sep).join("/"))
		.filter(
			(file) => SOURCE_FILE.test(file) && !file.split("/").some((part) => part === "node_modules" || part === "dist"),
		)
		.sort();
}

function descendants(ts, node) {
	const nodes = [];
	const visit = (child) => {
		nodes.push(child);
		ts.forEachChild(child, visit);
	};
	visit(node);
	return nodes;
}

const stringValue = (ts, node) => (node && ts.isStringLiteralLike(node) ? node.text : undefined);

/** The root name of `it`, `it.concurrent` or `it["skip"]`; calls in the chain end it, so `expect(x).toBe` has none. */
function chainRoot(ts, node) {
	let current = node;
	const names = [];
	for (;;) {
		if (ts.isPropertyAccessExpression(current)) names.unshift(current.name.text);
		else if (ts.isElementAccessExpression(current) && stringValue(ts, current.argumentExpression) !== undefined)
			names.unshift(current.argumentExpression.text);
		else break;
		current = current.expression;
	}
	return ts.isIdentifier(current) ? { root: current.text, names } : { root: undefined, names };
}

/** Where a comment may not be: a suppression that hides a problem instead of fixing it. */
function suppressions(ts, sf, at) {
	const text = sf.text;
	const found = new Map();
	const jsxTexts = [];
	const visit = (node) => {
		if (node.kind >= ts.SyntaxKind.FirstJSDocNode && node.kind <= ts.SyntaxKind.LastJSDocNode) return;
		const children = node.getChildren(sf);
		if (children.length > 0) {
			for (const child of children) visit(child);
			return;
		}
		if (node.kind === ts.SyntaxKind.JsxText) jsxTexts.push(node);
		const ranges = [
			...(ts.getLeadingCommentRanges(text, node.pos) ?? []),
			...(ts.getTrailingCommentRanges(text, node.end) ?? []),
		];
		for (const range of ranges) found.set(range.pos, range);
	};
	visit(sf);
	// Text between JSX tags is not code: a `//` there is not a comment, though it looks like one after the `>` before it.
	const inJsxText = (range) => jsxTexts.some((jsx) => jsx.pos <= range.pos && range.pos < jsx.end);
	return [...found.values()]
		.filter((range) => !inJsxText(range) && SUPPRESSION.test(text.slice(range.pos, range.end)))
		.map((range) => at(range.pos, "a suppression comment hides a problem: fix the code instead"));
}

// ---- the database is never faked ----

function moduleName(ts, node) {
	if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) return stringValue(ts, node.moduleSpecifier);
	if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference))
		return stringValue(ts, node.moduleReference.expression);
	if (
		ts.isCallExpression(node) &&
		(node.expression.kind === ts.SyntaxKind.ImportKeyword || isName(ts, node.expression, "require"))
	)
		return stringValue(ts, node.arguments[0]);
	return undefined;
}

const isName = (ts, node, name) => ts.isIdentifier(node) && node.text === name;

/** `vi.mock("x")` and `vi.mock(import("x"))`: the name of the module being replaced. */
function mockedModule(ts, call) {
	const [target] = call.arguments;
	if (target && ts.isCallExpression(target) && target.expression.kind === ts.SyntaxKind.ImportKeyword)
		return stringValue(ts, target.arguments[0]);
	return stringValue(ts, target);
}

const words = (name) => name.match(/[A-Z]+(?![a-z])|[A-Z]?[a-z]+|\d+/g) ?? [];

/** True for a spied-on target like `db`, `pool`, `testDb` or `ctx.pgPool`. */
const namesDatabase = (ts, node) =>
	descendants(ts, node).some(
		(part) => ts.isIdentifier(part) && words(part.text).some((word) => DATABASE_WORDS.has(word.toLowerCase())),
	);

function fakeDatabase(ts, nodes, at) {
	const problems = [];
	for (const node of nodes) {
		const imported = moduleName(ts, node);
		if (imported !== undefined && FAKE_DATABASE.test(imported)) {
			problems.push(at(node.getStart(), `${imported} is a fake database: tests run on the real Postgres`));
		}
		if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) continue;
		const { root, names } = chainRoot(ts, node.expression);
		if (root !== "vi" && root !== "jest") continue;
		const mocked = MOCK_METHODS.has(names[0]) ? mockedModule(ts, node) : undefined;
		if (mocked !== undefined && (DATABASE_MODULE.test(mocked) || FAKE_DATABASE.test(mocked))) {
			problems.push(at(node.getStart(), `${mocked} is mocked: tests run on the real Postgres`));
		}
		if (names[0] === "spyOn" && node.arguments[0] && namesDatabase(ts, node.arguments[0])) {
			problems.push(at(node.getStart(), "the database is spied on: tests run on the real Postgres"));
		}
	}
	return problems;
}

// ---- environment variables ----

/** `process` or `globalThis.process`, with any parentheses around it. */
function isProcess(ts, node) {
	const bare = skipParentheses(ts, node);
	if (isName(ts, bare, "process")) return true;
	return (
		ts.isPropertyAccessExpression(bare) &&
		bare.name.text === "process" &&
		isName(ts, skipParentheses(ts, bare.expression), "globalThis")
	);
}

/** `process.env`, `process["env"]` and `process[\`env\`]`, on `process` or `globalThis.process`. */
function envAccess(ts, node) {
	if (ts.isPropertyAccessExpression(node)) return node.name.text === "env" && isProcess(ts, node.expression);
	if (ts.isElementAccessExpression(node))
		return stringValue(ts, node.argumentExpression) === "env" && isProcess(ts, node.expression);
	return false;
}

/** True for a destructuring key that names `env`: `env`, `"env"` or `["env"]`. */
function isEnvKey(ts, key) {
	if (key === undefined) return false;
	if (ts.isComputedPropertyName(key)) return stringValue(ts, key.expression) === "env";
	return (ts.isIdentifier(key) || ts.isStringLiteralLike(key)) && key.text === "env";
}

/**
 * `const { env } = process`, `function f({ env } = process)` and `({ env } = process)`, also with `env: e`, `["env"]: e`
 * or `globalThis.process`: the `env` taken out of `process` by name.
 */
function envDestructured(ts, node) {
	if (ts.isObjectBindingPattern(node)) {
		const { parent } = node;
		const declares = ts.isVariableDeclaration(parent) || ts.isParameter(parent) || ts.isBindingElement(parent);
		if (!declares || parent.name !== node || !parent.initializer || !isProcess(ts, parent.initializer)) return false;
		return node.elements.some((element) => isEnvKey(ts, element.propertyName ?? element.name));
	}
	if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
		const target = skipParentheses(ts, node.left);
		if (!ts.isObjectLiteralExpression(target) || !isProcess(ts, node.right)) return false;
		return target.properties.some((property) => isEnvKey(ts, property.name));
	}
	return false;
}

/** The expression `node` stands in once parentheses around it are taken away. */
function outermost(ts, node) {
	let current = node;
	while (ts.isParenthesizedExpression(current.parent)) current = current.parent;
	return current;
}

const skipParentheses = (ts, node) =>
	ts.isParenthesizedExpression(node) ? skipParentheses(ts, node.expression) : node;

/** A value written into the code: a string, number, `true`, `false`, `null`, `-1`, or an object or array literal. */
function isLiteral(ts, node) {
	if (node === undefined) return false;
	const bare = skipParentheses(ts, node);
	if (ts.isPrefixUnaryExpression(bare)) return isLiteral(ts, bare.operand);
	return (
		ts.isStringLiteralLike(bare) ||
		ts.isNumericLiteral(bare) ||
		ts.isBigIntLiteral(bare) ||
		ts.isTemplateExpression(bare) ||
		ts.isRegularExpressionLiteral(bare) ||
		ts.isObjectLiteralExpression(bare) ||
		ts.isArrayLiteralExpression(bare) ||
		[ts.SyntaxKind.TrueKeyword, ts.SyntaxKind.FalseKeyword, ts.SyntaxKind.NullKeyword].includes(bare.kind)
	);
}

/** `process.env.X ?? "value"` and `process.env.X || "value"`: a default written into the code. */
function hasFallback(ts, node) {
	const read = outermost(ts, node);
	const { parent } = read;
	if (!ts.isBinaryExpression(parent) || parent.left !== read) return false;
	const operator = parent.operatorToken.kind;
	if (operator !== ts.SyntaxKind.QuestionQuestionToken && operator !== ts.SyntaxKind.BarBarToken) return false;
	return isLiteral(ts, parent.right);
}

/** True for `namespace NodeJS` at the top of the file or inside `declare global`, where Node's own types are merged. */
function isNodeNamespace(ts, node) {
	if (!ts.isModuleDeclaration(node) || !ts.isIdentifier(node.name) || node.name.text !== "NodeJS") return false;
	const { parent } = node;
	if (ts.isSourceFile(parent)) return true;
	const outer = parent.parent;
	return (
		ts.isModuleBlock(parent) &&
		ts.isModuleDeclaration(outer) &&
		ts.isIdentifier(outer.name) &&
		outer.name.text === "global" &&
		ts.isSourceFile(outer.parent)
	);
}

/**
 * The names declared on `interface ProcessEnv` inside `namespace NodeJS` in `envTypes`; none when the file is
 * missing. Another `interface ProcessEnv` in the file does not reach `process.env` and approves nothing.
 */
function approvedEnvironment(ts, root, envTypes) {
	let text;
	try {
		text = readFileSync(path.join(root, envTypes), "utf8");
	} catch {
		return new Set();
	}
	const sf = ts.createSourceFile(envTypes, text, ts.ScriptTarget.Latest, true);
	const names = new Set();
	for (const node of descendants(ts, sf)) {
		if (!ts.isInterfaceDeclaration(node) || node.name.text !== "ProcessEnv") continue;
		if (!ts.isModuleBlock(node.parent) || !isNodeNamespace(ts, node.parent.parent)) continue;
		for (const member of node.members) {
			if (ts.isPropertySignature(member) && (ts.isIdentifier(member.name) || ts.isStringLiteralLike(member.name)))
				names.add(member.name.text);
		}
	}
	return names;
}

/** Every read of `process.env`: `process.env.NAME` for a declared NAME, and without a fallback written in. */
function environmentReads(ts, nodes, at, approved, envTypes) {
	const byName = `process.env must be read as process.env.NAME, with NAME declared in ${envTypes}`;
	const problems = [];
	for (const pattern of nodes.filter((node) => envDestructured(ts, node)))
		problems.push(at(pattern.getStart(), byName));
	for (const env of nodes.filter((node) => envAccess(ts, node))) {
		const { parent } = env;
		if (!ts.isPropertyAccessExpression(env) || !ts.isPropertyAccessExpression(parent) || parent.expression !== env) {
			problems.push(at(env.getStart(), byName));
			continue;
		}
		const name = parent.name.text;
		if (!approved.has(name))
			problems.push(
				at(
					parent.getStart(),
					`process.env.${name} is not declared in ${envTypes}: ask the PM and owner to approve it and add it there instead of inventing one`,
				),
			);
		if (hasFallback(ts, parent))
			problems.push(
				at(
					parent.getStart(),
					`process.env.${name} has a fallback value written in: do not hardcode a value for an environment variable`,
				),
			);
	}
	return problems;
}

// ---- tests ----

/** Skipped, focused and parameterized tests: one test per AC, and every test runs. */
function skippedTests(ts, nodes, at) {
	const problems = [];
	for (const node of nodes) {
		if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
			const { root, names } = chainRoot(ts, node);
			const name = names.at(-1);
			if (TEST_ROOTS.has(root) && BANNED_MODIFIERS.has(name))
				problems.push(at(node.getStart(), `${root}.${name} is not allowed`));
			if (TEST_ROOTS.has(root) && PARAMETERIZED.has(name))
				problems.push(at(node.getStart(), `${root}.${name} is not allowed: write one test per acceptance condition`));
		}
		if (!ts.isCallExpression(node)) continue;
		if (ts.isIdentifier(node.expression) && BANNED_NAMES.has(node.expression.text)) {
			problems.push(at(node.getStart(), `${node.expression.text} is not allowed`));
		}
		if (!TEST_ROOTS.has(chainRoot(ts, node.expression).root)) continue;
		for (const option of node.arguments.filter(ts.isObjectLiteralExpression).flatMap((object) => object.properties)) {
			const name =
				option.name && (ts.isIdentifier(option.name) || ts.isStringLiteral(option.name)) ? option.name.text : undefined;
			const off = ts.isPropertyAssignment(option) && option.initializer.kind === ts.SyntaxKind.FalseKeyword;
			if (BANNED_OPTIONS.has(name) && !off) problems.push(at(option.getStart(), `the ${name} option is not allowed`));
		}
	}
	return problems;
}

const isTestCall = (ts, node) => {
	if (!ts.isCallExpression(node)) return false;
	const { root, names } = chainRoot(ts, node.expression);
	return (root === "it" || root === "test") && names.every((name) => TEST_MODIFIERS.has(name));
};

const isExpectCall = (ts, node) => {
	if (!ts.isCallExpression(node)) return false;
	const callee = node.expression;
	if (isName(ts, callee, "expect")) return true;
	return (
		ts.isPropertyAccessExpression(callee) &&
		isName(ts, callee.expression, "expect") &&
		["soft", "poll"].includes(callee.name.text)
	);
};

/** The statement an `expect` belongs to, or the body of an arrow function when it has no block. */
function statementOf(ts, node) {
	let current = node;
	while (current.parent) {
		const { parent } = current;
		if (ts.isBlock(parent) || ts.isSourceFile(parent) || ts.isCaseOrDefaultClause(parent) || ts.isModuleBlock(parent))
			break;
		if (ts.isArrowFunction(parent) && parent.body === current) break;
		current = parent;
	}
	return current;
}

/** The result number in the `// DB-3.1` comment on the line right above `node`'s statement, or undefined. */
function resultAbove(ts, sf, node) {
	const statement = statementOf(ts, node);
	const comment = ts.getLeadingCommentRanges(sf.text, statement.getFullStart())?.at(-1);
	if (!comment || comment.kind !== ts.SyntaxKind.SingleLineCommentTrivia) return undefined;
	const line = (position) => sf.getLineAndCharacterOfPosition(position).line;
	if (line(comment.end) + 1 !== line(statement.getStart(sf))) return undefined;
	return RESULT_COMMENT.exec(sf.text.slice(comment.pos, comment.end))?.[1];
}

/** Reads the tests in one file into `tests` and returns the problems inside the file itself. */
function readTests(ts, sf, nodes, at, tests) {
	const problems = skippedTests(ts, nodes, at);
	const found = [];
	for (const node of nodes.filter((node) => isTestCall(ts, node))) {
		const title = stringValue(ts, node.arguments[0]);
		const match = title === undefined ? null : TEST_TITLE.exec(title);
		const where = (message) => at(node.getStart(), message);
		if (title === undefined) problems.push(where("the test title must be a string"));
		else if (!match)
			problems.push(where(`the title "${title}" must start with an AC number and then say what is checked`));
		else found.push({ node, id: match[1], at: at(node.getStart()), expects: [] });
	}

	const ownerOf = (node) =>
		nodes.findLast((test) => isTestCall(ts, test) && test.pos <= node.pos && node.end <= test.end);
	for (const expectation of nodes.filter((node) => isExpectCall(ts, node))) {
		const owner = ownerOf(expectation);
		if (!owner) {
			problems.push(
				at(expectation.getStart(), "expect is used outside an it or test: setup and cleanup check nothing"),
			);
			continue;
		}
		const result = resultAbove(ts, sf, expectation);
		if (result === undefined)
			problems.push(
				at(
					expectation.getStart(),
					"the line above this expect must be a comment with the result number, like // DB-3.1",
				),
			);
		found.find((test) => test.node === owner)?.expects.push({ at: at(expectation.getStart()), result });
	}

	for (const test of found) {
		if (test.expects.length === 0) problems.push(`${test.at}: ${test.id} has no expect`);
		tests.push(test);
	}
	return problems;
}

/** Puts the tests against the AC: one each, only for conditions that exist, and every result checked by an expect. */
function matchTests(acs, tests, acDir) {
	const problems = [];
	for (const test of tests) {
		if (!acs.has(test.id)) problems.push(`${test.at}: ${test.id} is not in ${acDir}`);
	}
	for (const ac of acs.values()) {
		const own = tests.filter((test) => test.id === ac.id);
		if (own.length === 0 && !ac.deferred) problems.push(`${ac.at}: ${ac.id} has no test`);
		if (own.length > 1)
			problems.push(
				`${ac.at}: ${ac.id} has ${own.length} tests, expected one: ${own.map((test) => test.at).join(", ")}`,
			);
		const checked = new Set();
		for (const { expects } of own) {
			for (const { at, result } of expects) {
				if (result === undefined) continue;
				if (ac.results.has(result)) checked.add(result);
				else problems.push(`${at}: ${result} is not a result of ${ac.id}`);
			}
		}
		if (own.length === 0 || ac.deferred) continue;
		for (const [result, { at, deferred }] of ac.results) {
			if (!deferred && !checked.has(result))
				problems.push(`${at}: ${result} is not checked by any expect in the test of ${ac.id}`);
		}
	}
	return problems;
}

/** Safety-only test checks for integration suites under `packages/<pkg>/tests`: no skipped/focused/empty tests. */
function checkIntegrationTestFile(ts, nodes, at) {
	const problems = skippedTests(ts, nodes, at);
	const testNodes = nodes.filter((node) => isTestCall(ts, node));
	const expects = nodes.filter((node) => isExpectCall(ts, node));
	for (const testNode of testNodes) {
		const callback = testNode.arguments.find((arg) => ts.isArrowFunction(arg) || ts.isFunctionExpression(arg));
		const emptyBody = callback && ts.isBlock(callback.body) && callback.body.statements.length === 0;
		const hasExpect = expects.some((exp) => testNode.pos <= exp.pos && exp.end <= testNode.end);
		if (emptyBody || (expects.length === 0 && !hasExpect)) {
			problems.push(at(testNode.getStart(), "this test has no expect"));
		}
	}
	return problems;
}

/** Packages under `docs/acceptance/<pkg>/`, plus `core` so core fixtures always run. */
function fencedPackages(root) {
	const dirs = readdirOrEmpty(path.join(root, ACCEPTANCE_ROOT))
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name);
	return [...new Set(["core", ...dirs])].sort();
}

/** Checks one package's `packages/<pkg>/src` against `docs/acceptance/<pkg>`. */
function checkPackageFence(ts, root, pkg) {
	const acDir = `${ACCEPTANCE_ROOT}/${pkg}`;
	const srcDir = `packages/${pkg}/src`;
	const envTypes = `packages/${pkg}/env.d.ts`;
	const checkEnv = pkg === "core" || existsSync(path.join(root, envTypes));
	const { acs, problems } = readAcceptance(root, acDir);
	const tests = [];
	const approved = checkEnv ? approvedEnvironment(ts, root, envTypes) : undefined;
	for (const file of sourceFiles(root, srcDir)) {
		const sf = ts.createSourceFile(file, readFileSync(path.join(root, file), "utf8"), ts.ScriptTarget.Latest, true);
		const at = (position, message) => {
			const place = `${file}:${sf.getLineAndCharacterOfPosition(position).line + 1}`;
			return message === undefined ? place : `${place}: ${message}`;
		};
		const nodes = descendants(ts, sf);
		problems.push(...suppressions(ts, sf, at), ...fakeDatabase(ts, nodes, at));
		if (checkEnv) problems.push(...environmentReads(ts, nodes, at, approved, envTypes));
		if (TEST_FILE.test(file)) problems.push(...readTests(ts, sf, nodes, at, tests));
	}
	problems.push(...matchTests(acs, tests, acDir));
	return problems;
}

/** Checks `packages/<pkg>/tests` across all packages for suppressions, fake DBs, and skipped/empty tests. */
function checkIntegrationDirs(ts, root) {
	const problems = [];
	const pkgs = readdirOrEmpty(path.join(root, "packages"))
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name)
		.sort();
	for (const pkg of pkgs) {
		for (const file of sourceFiles(root, `packages/${pkg}/tests`)) {
			const sf = ts.createSourceFile(file, readFileSync(path.join(root, file), "utf8"), ts.ScriptTarget.Latest, true);
			const at = (position, message) => {
				const place = `${file}:${sf.getLineAndCharacterOfPosition(position).line + 1}`;
				return message === undefined ? place : `${place}: ${message}`;
			};
			const nodes = descendants(ts, sf);
			problems.push(
				...suppressions(ts, sf, at),
				...fakeDatabase(ts, nodes, at),
				...checkIntegrationTestFile(ts, nodes, at),
			);
		}
	}
	return problems;
}

/** Checks all fenced packages (`docs/acceptance/<pkg>` ↔ `packages/<pkg>/src`) and `packages/<pkg>/tests`. */
export function checkFence(root) {
	const ts = loadTypeScript(root);
	const problems = [];
	for (const pkg of fencedPackages(root)) problems.push(...checkPackageFence(ts, root, pkg));
	problems.push(...checkIntegrationDirs(ts, root));
	return problems;
}
