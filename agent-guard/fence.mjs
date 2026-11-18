// The fence around the core's tests: what `docs/acceptance/README.md` and `docs/refactor/core.md` (9) require, checked by machine.
//
//   checkFence(root) returns the problems found under `packages/core/src` against `docs/acceptance/core`; an empty list is a pass.
//
// 1. Acceptance conditions (AC) and tests match one to one, and every `expect` has the result number of its AC above it.
// 2. Tests are not skipped, focused or empty, and the database is never faked.
// 3. No suppression comment hides a problem in the code.
//
// Sources are read with the TypeScript parser, so a string that looks like a comment or a call is not mistaken for one.
// What it cannot see: a test API renamed on import (`import { it as spec }`), a mock target that is not a string literal.

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

const AC_DIR = "docs/acceptance/core";
const CORE_SRC = "packages/core/src";

const SOURCE_FILE = /\.(?:[cm]?[jt]s|[jt]sx)$/;
const TEST_FILE = /\.(?:test|spec)\.(?:[cm]?[jt]s|[jt]sx)$|(?:^|\/)__test__\//;

const ID = "[A-Z][A-Z0-9]*-\\d+";
const AC_HEADER = new RegExp(`^(${ID})\\s{2,}\\S`);
const RESULT_LINE = new RegExp(`^\\s*(?:결과\\s+)?(${ID}\\.\\d+)\\s+\\S`);
const DEFERRED = /\[보류(?::[^\]]*)?\]\s*$/;
const TEST_TITLE = new RegExp(`^(${ID})\\s+(\\S.*)$`, "s");
const RESULT_COMMENT = new RegExp(`^//\\s*(${ID}\\.\\d+)\\s*$`);
const HANGUL = /[ᄀ-ᇿㄱ-ㆎ가-힣]/;

const TEST_ROOTS = new Set(["it", "test", "describe"]);
const TEST_MODIFIERS = new Set(["concurrent", "sequential", "fails", "skip", "only", "todo"]);
const BANNED_MODIFIERS = new Set(["skip", "only", "todo", "skipIf", "runIf", "fails"]);
const PARAMETERIZED = new Set(["each", "for"]);
const BANNED_OPTIONS = new Set(["skip", "only", "todo"]);
const BANNED_NAMES = new Set(["xit", "xtest", "xdescribe", "fit", "fdescribe"]);

const SUPPRESSION = /biome-ignore|@ts-expect-error|@ts-nocheck|@ts-ignore|eslint-disable/;
const FAKE_DATABASE = /^(?:pg-mem|pglite|@electric-sql\/pglite[\w-]*|better-sqlite3|sql\.js)(?:\/|$)/;
const DATABASE_MODULE =
	/^(?:pg|postgres|drizzle[\w-]*|kysely|prisma|typeorm|@prisma\/[\w-]+)(?:\/|$)|(?:^|\/)db(?:\/|\.|$)|database/i;
const MOCK_METHODS = new Set(["mock", "doMock", "unstable_mockModule"]);
const DATABASE_WORDS = new Set(["db", "pool", "pg", "database"]);

const kind = ts.SyntaxKind;

// ---- acceptance conditions ----

/** Reads `docs/acceptance/core/*.md` into a map of AC id to its results, and the problems in the documents. */
function readAcceptance(root) {
	const acs = new Map();
	const problems = [];
	const names = readdirOrEmpty(path.join(root, AC_DIR), { recursive: true })
		.filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
		.map((entry) =>
			path.relative(path.join(root, AC_DIR), path.join(entry.parentPath, entry.name)).split(path.sep).join("/"),
		)
		.sort();

	for (const name of names) {
		const file = `${AC_DIR}/${name}`;
		let current;
		for (const [index, line] of readFileSync(path.join(root, file), "utf8").split(/\r?\n/).entries()) {
			const at = `${file}:${index + 1}`;
			const header = AC_HEADER.exec(line);
			const result = RESULT_LINE.exec(line);
			if (header) {
				const [, id] = header;
				current = { id, at, deferred: DEFERRED.test(line), results: new Map() };
				if (acs.has(id)) problems.push(`${at}: ${id} is already defined at ${acs.get(id).at}`);
				else acs.set(id, current);
			} else if (result) {
				const [, id] = result;
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

function sourceFiles(root) {
	return readdirOrEmpty(path.join(root, CORE_SRC), { recursive: true })
		.filter((entry) => entry.isFile())
		.map((entry) => path.relative(root, path.join(entry.parentPath, entry.name)).split(path.sep).join("/"))
		.filter(
			(file) => SOURCE_FILE.test(file) && !file.split("/").some((part) => part === "node_modules" || part === "dist"),
		)
		.sort();
}

function descendants(node) {
	const nodes = [];
	const visit = (child) => {
		nodes.push(child);
		ts.forEachChild(child, visit);
	};
	visit(node);
	return nodes;
}

const stringValue = (node) => (node && ts.isStringLiteralLike(node) ? node.text : undefined);

/** The root name of `it`, `it.concurrent` or `it["skip"]`; calls in the chain end it, so `expect(x).toBe` has none. */
function chainRoot(node) {
	let current = node;
	const names = [];
	for (;;) {
		if (ts.isPropertyAccessExpression(current)) names.unshift(current.name.text);
		else if (ts.isElementAccessExpression(current) && stringValue(current.argumentExpression) !== undefined)
			names.unshift(current.argumentExpression.text);
		else break;
		current = current.expression;
	}
	return ts.isIdentifier(current) ? { root: current.text, names } : { root: undefined, names };
}

/** Where a comment may not be: a suppression that hides a problem instead of fixing it. */
function suppressions(sf, at) {
	const text = sf.text;
	const found = new Map();
	const jsxTexts = [];
	const visit = (node) => {
		if (node.kind >= kind.FirstJSDocNode && node.kind <= kind.LastJSDocNode) return;
		const children = node.getChildren(sf);
		if (children.length > 0) {
			for (const child of children) visit(child);
			return;
		}
		if (node.kind === kind.JsxText) jsxTexts.push(node);
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

function moduleName(node) {
	if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) return stringValue(node.moduleSpecifier);
	if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference))
		return stringValue(node.moduleReference.expression);
	if (ts.isCallExpression(node) && (node.expression.kind === kind.ImportKeyword || isName(node.expression, "require")))
		return stringValue(node.arguments[0]);
	return undefined;
}

const isName = (node, name) => ts.isIdentifier(node) && node.text === name;

/** `vi.mock("x")` and `vi.mock(import("x"))`: the name of the module being replaced. */
function mockedModule(call) {
	const [target] = call.arguments;
	if (target && ts.isCallExpression(target) && target.expression.kind === kind.ImportKeyword)
		return stringValue(target.arguments[0]);
	return stringValue(target);
}

const words = (name) => name.match(/[A-Z]+(?![a-z])|[A-Z]?[a-z]+|\d+/g) ?? [];

/** True for a spied-on target like `db`, `pool`, `testDb` or `ctx.pgPool`. */
const namesDatabase = (node) =>
	descendants(node).some(
		(part) => ts.isIdentifier(part) && words(part.text).some((word) => DATABASE_WORDS.has(word.toLowerCase())),
	);

function fakeDatabase(nodes, at) {
	const problems = [];
	for (const node of nodes) {
		const imported = moduleName(node);
		if (imported !== undefined && FAKE_DATABASE.test(imported)) {
			problems.push(at(node.getStart(), `${imported} is a fake database: tests run on the real Postgres`));
		}
		if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) continue;
		const { root, names } = chainRoot(node.expression);
		if (root !== "vi" && root !== "jest") continue;
		const mocked = MOCK_METHODS.has(names[0]) ? mockedModule(node) : undefined;
		if (mocked !== undefined && (DATABASE_MODULE.test(mocked) || FAKE_DATABASE.test(mocked))) {
			problems.push(at(node.getStart(), `${mocked} is mocked: tests run on the real Postgres`));
		}
		if (names[0] === "spyOn" && node.arguments[0] && namesDatabase(node.arguments[0])) {
			problems.push(at(node.getStart(), "the database is spied on: tests run on the real Postgres"));
		}
	}
	return problems;
}

// ---- tests ----

/** Skipped, focused and parameterized tests: one test per AC, and every test runs. */
function skippedTests(nodes, at) {
	const problems = [];
	for (const node of nodes) {
		if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
			const { root, names } = chainRoot(node);
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
		if (!TEST_ROOTS.has(chainRoot(node.expression).root)) continue;
		for (const option of node.arguments.filter(ts.isObjectLiteralExpression).flatMap((object) => object.properties)) {
			const name =
				option.name && (ts.isIdentifier(option.name) || ts.isStringLiteral(option.name)) ? option.name.text : undefined;
			const off = ts.isPropertyAssignment(option) && option.initializer.kind === kind.FalseKeyword;
			if (BANNED_OPTIONS.has(name) && !off) problems.push(at(option.getStart(), `the ${name} option is not allowed`));
		}
	}
	return problems;
}

const isTestCall = (node) => {
	if (!ts.isCallExpression(node)) return false;
	const { root, names } = chainRoot(node.expression);
	return (root === "it" || root === "test") && names.every((name) => TEST_MODIFIERS.has(name));
};

const isExpectCall = (node) => {
	if (!ts.isCallExpression(node)) return false;
	const callee = node.expression;
	if (isName(callee, "expect")) return true;
	return (
		ts.isPropertyAccessExpression(callee) &&
		isName(callee.expression, "expect") &&
		["soft", "poll"].includes(callee.name.text)
	);
};

/** The statement an `expect` belongs to, or the body of an arrow function when it has no block. */
function statementOf(node) {
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
function resultAbove(sf, node) {
	const statement = statementOf(node);
	const comment = ts.getLeadingCommentRanges(sf.text, statement.getFullStart())?.at(-1);
	if (!comment || comment.kind !== kind.SingleLineCommentTrivia) return undefined;
	const line = (position) => sf.getLineAndCharacterOfPosition(position).line;
	if (line(comment.end) + 1 !== line(statement.getStart(sf))) return undefined;
	return RESULT_COMMENT.exec(sf.text.slice(comment.pos, comment.end))?.[1];
}

/** Reads the tests in one file into `tests` and returns the problems inside the file itself. */
function readTests(sf, nodes, at, tests) {
	const problems = skippedTests(nodes, at);
	const found = [];
	for (const node of nodes.filter(isTestCall)) {
		const title = stringValue(node.arguments[0]);
		const match = title === undefined ? null : TEST_TITLE.exec(title);
		const where = (message) => at(node.getStart(), message);
		if (title === undefined) problems.push(where("the test title must be a string"));
		else if (!match)
			problems.push(where(`the title "${title}" must start with an AC number and then say what is checked`));
		else if (HANGUL.test(title)) problems.push(where(`the title "${title}" must be in English`));
		else found.push({ node, id: match[1], at: at(node.getStart()), expects: [] });
	}

	const ownerOf = (node) => nodes.findLast((test) => isTestCall(test) && test.pos <= node.pos && node.end <= test.end);
	for (const expectation of nodes.filter(isExpectCall)) {
		const owner = ownerOf(expectation);
		if (!owner) {
			problems.push(
				at(expectation.getStart(), "expect is used outside an it or test: setup and cleanup check nothing"),
			);
			continue;
		}
		const result = resultAbove(sf, expectation);
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
function matchTests(acs, tests) {
	const problems = [];
	for (const test of tests) {
		if (!acs.has(test.id)) problems.push(`${test.at}: ${test.id} is not in ${AC_DIR}`);
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

/** Checks `packages/core/src` against `docs/acceptance/core` and returns the problems, empty when it passes. */
export function checkFence(root) {
	const { acs, problems } = readAcceptance(root);
	const tests = [];
	for (const file of sourceFiles(root)) {
		const sf = ts.createSourceFile(file, readFileSync(path.join(root, file), "utf8"), ts.ScriptTarget.Latest, true);
		const at = (position, message) => {
			const place = `${file}:${sf.getLineAndCharacterOfPosition(position).line + 1}`;
			return message === undefined ? place : `${place}: ${message}`;
		};
		const nodes = descendants(sf);
		problems.push(...suppressions(sf, at), ...fakeDatabase(nodes, at));
		if (TEST_FILE.test(file)) problems.push(...readTests(sf, nodes, at, tests));
	}
	problems.push(...matchTests(acs, tests));
	return problems;
}
