import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
	copyFileSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	realpathSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, describe, test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { checkFence } from "./fence.mjs";

const FENCE = path.join(path.dirname(fileURLToPath(import.meta.url)), "fence.mjs");
const TYPESCRIPT = path.dirname(createRequire(import.meta.url).resolve("typescript/package.json"));

const roots = [];
after(() => {
	for (const root of roots) rmSync(root, { recursive: true, force: true });
});

/** Writes `files` (path to content) into a fresh repository root and runs the fence on it. */
function fence(files) {
	const root = realpathSync(mkdtempSync(path.join(tmpdir(), "monti-fence-test-")));
	roots.push(root);
	for (const [file, content] of Object.entries(files)) {
		mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
		writeFileSync(path.join(root, file), content);
	}
	return checkFence(root);
}

const passes = (files) => assert.deepEqual(fence(files), []);

/** Every pattern has to match the problems; a fence that fails for another reason does not count. */
function fails(files, ...patterns) {
	const problems = fence(files).join("\n");
	assert.notEqual(problems, "", "the fence passed");
	for (const pattern of patterns) assert.match(problems, pattern);
}

const AC = `# Database

\`\`\`
DB-3  A migration fails midway
  전제  three migrations, the second fails after it creates a table
  행동  run the core migrations
  결과  DB-3.1  the table of the second migration does not exist
        DB-3.2  the second migration is not recorded
        DB-3.3  an error is thrown

DB-4  A migration runs twice
  행동  run the core migrations again
  결과  DB-4.1  nothing changes
\`\`\`
`;

const ACCEPTANCE = { "docs/acceptance/core/db.md": AC };

/** A passing test for DB-3; `checks` replaces its body. */
const dbTest = (checks, title = "DB-3 rolls back a failed migration") =>
	`import { expect, it } from "vitest";

it("${title}", async () => {
${checks}
});
`;

const ALL_CHECKS = `	// DB-3.1
	expect(1).toBe(1);
	// DB-3.2
	expect(2).toBe(2);
	// DB-3.3
	expect(3).toBe(3);`;

const DB_4 = `it("DB-4 changes nothing the second time", () => {
	// DB-4.1
	expect(1).toBe(1);
});
`;

const files = (test, name = "packages/core/src/db/migrate.test.ts", extra = {}) => ({
	...ACCEPTANCE,
	[name]: test,
	"packages/core/src/db/migrate-again.test.ts": `import { expect, it } from "vitest";\n\n${DB_4}`,
	...extra,
});

const PASSING = files(dbTest(ALL_CHECKS));

describe("what passes", () => {
	test("nothing to check: no directories, or empty ones", () => {
		passes({});
		passes({ "docs/acceptance/core/.gitkeep": "", "packages/core/src/.gitkeep": "" });
	});

	test("conditions with no test files yet fail, and the same folders with nothing in them pass", () => {
		fails(ACCEPTANCE, /db\.md:4: DB-3 has no test/, /db\.md:11: DB-4 has no test/);
		passes({
			"docs/acceptance/core/notes.md": "# Notes\n\nNo conditions here.\n",
			"packages/core/src/index.ts": "export {};\n",
		});
	});

	test("a test for every condition with every result above an expect", () => {
		passes(PASSING);
	});

	test("collapsible markdown <details> AC format with backtick result bullets passes and validates deferred markers", () => {
		const collapsibleAc = `# Database

<details>
<summary><strong><code>DB-MIG-3</code></strong> 마이그레이션이 중간에 실패하면 롤백한다</summary>

- **전제**: 마이그레이션 3개가 주어진다
- **행동**: 실행한다
- **결과**:
  - \`DB-MIG-3.1\` 두 번째 테이블이 없다
  - \`DB-MIG-3.2\` 오류가 던져진다

</details>

<details>
<summary><strong><code>DB-MIG-4</code></strong> 보류된 항목 [보류: 추후 구현]</summary>

- **결과**:
  - \`DB-MIG-4.1\` 나중에 확인한다

</details>
`;
		passes({
			"docs/acceptance/core/db.md": collapsibleAc,
			"packages/core/src/db/migrate.test.ts": `import { expect, it } from "vitest";
it("DB-MIG-3 rolls back", () => {
	// DB-MIG-3.1
	expect(1).toBe(1);
	// DB-MIG-3.2
	expect(2).toBe(2);
});
`,
		});
		fails(
			{
				"docs/acceptance/core/db.md": collapsibleAc,
				"packages/core/src/db/migrate.test.ts": `import { expect, it } from "vitest";
it("DB-MIG-3 rolls back", () => {
	// DB-MIG-3.1
	expect(1).toBe(1);
});
`,
			},
			/DB-MIG-3\.2 is not checked/,
		);
	});

	test("title in a template literal, a result checked by more than one expect, and async checks", () => {
		passes(
			files(`import { expect, it } from "vitest";

it(\`DB-3 rolls back a failed migration\`, async () => {
	// DB-3.1
	expect(1).toBe(1);
	// DB-3.1
	await expect(Promise.resolve(2)).resolves.toBe(2);
	// DB-3.2
	expect.soft(2).toBe(2);
	// DB-3.3
	await expect(Promise.reject(new Error("x"))).rejects.toThrow();
});
`),
		);
	});

	test("a test in a __test__ folder, and expect inside a loop or an arrow without a block", () => {
		passes(
			files(
				`import { expect, it } from "vitest";

it("DB-3 rolls back a failed migration", () => {
	for (const n of [1, 2]) {
		// DB-3.1
		expect(n).toBeGreaterThan(0);
	}
	// DB-3.2
	[1].forEach((n) =>
		// DB-3.3
		expect(n).toBe(1),
	);
	// DB-3.2
	expect(2).toBe(2);
});
`,
				"packages/core/src/db/__test__/migrate.ts",
			),
		);
	});

	test("a deferred condition needs no test, and one with a test is still read", () => {
		const deferred = AC.replace(
			"DB-4  A migration runs twice",
			"DB-4  A migration runs twice [보류: waits for step 2]",
		);
		passes({
			...PASSING,
			"docs/acceptance/core/db.md": deferred,
			"packages/core/src/db/migrate-again.test.ts": "export {};\n",
		});
		passes({ ...PASSING, "docs/acceptance/core/db.md": deferred.replace("[보류: waits for step 2]", "[보류]") });
		fails(
			{
				...PASSING,
				"docs/acceptance/core/db.md": deferred,
				"packages/core/src/db/migrate-again.test.ts": `import { expect, it } from "vitest";\n\nit("DB-4 x", () => {\n\t// DB-4.9\n\texpect(1).toBe(1);\n});\n`,
			},
			/migrate-again\.test\.ts:5: DB-4\.9 is not a result of DB-4/,
		);
	});

	test("a deferred result needs no expect, and the others still do", () => {
		const deferred = AC.replace(
			"DB-3.3  an error is thrown",
			"DB-3.3  an error is thrown [보류: waits for the engine]",
		);
		passes({
			...files(dbTest(ALL_CHECKS.replace("DB-3.3", "DB-3.2"))),
			"docs/acceptance/core/db.md": deferred,
		});
		fails(
			{ ...files(dbTest(ALL_CHECKS.replace("DB-3.2", "DB-3.1"))), "docs/acceptance/core/db.md": deferred },
			/db\.md:8: DB-3\.2 is not checked/,
		);
	});
});

describe("the acceptance documents", () => {
	test("a duplicate condition or result number fails", () => {
		fails(
			{ ...PASSING, "docs/acceptance/core/more.md": "DB-4  Again\n  결과  DB-4.1  something\n" },
			/more\.md:1: DB-4 is already defined at .*db\.md:11/,
		);
		fails(
			{ ...PASSING, "docs/acceptance/core/db.md": AC.replace("DB-3.2  the second", "DB-3.1  the second") },
			/db\.md:8: DB-3\.1 is already defined at .*db\.md:7/,
		);
	});

	test("a result under another condition, outside any, or a condition with no result fails", () => {
		fails({ ...PASSING, "docs/acceptance/core/db.md": `${AC}\n        DB-9.1  stray\n` }, /DB-9\.1 is under DB-4/);
		fails(
			{ "docs/acceptance/core/db.md": "  결과  DB-9.1  stray\n" },
			/db\.md:1: DB-9\.1 is not under an acceptance condition/,
		);
		fails(
			{ ...PASSING, "docs/acceptance/core/db.md": `${AC}\nDB-5  No result\n  행동  nothing\n` },
			/DB-5 has no result line/,
		);
	});

	test("only .md files count, in the folder or below it", () => {
		passes({ ...PASSING, "docs/acceptance/core/notes.txt": "DB-8  x\n  결과  DB-8.1  y\n" });
		fails(
			{ ...PASSING, "docs/acceptance/core/more/engine.md": "EN-1  x\n  결과  EN-1.1  y\n" },
			/more\/engine\.md:1: EN-1 has no test/,
		);
	});
});

describe("tests and conditions", () => {
	test("a condition without a test names the condition", () => {
		fails({ ...PASSING, "packages/core/src/db/migrate.test.ts": "export {};\n" }, /db\.md:4: DB-3 has no test/);
	});

	test("two tests for one condition fail and name both", () => {
		fails(
			files(dbTest(ALL_CHECKS), "packages/core/src/db/migrate.test.ts", {
				"packages/core/src/db/other.test.ts": dbTest(ALL_CHECKS, "DB-3 does it again"),
			}),
			/DB-3 has 2 tests, expected one: .*migrate\.test\.ts:3, .*other\.test\.ts:3/,
		);
		fails(
			files(`import { expect, it } from "vitest";

it("DB-3 first", () => {
	// DB-3.1
	expect(1).toBe(1);
});
it("DB-3 second", () => {
	// DB-3.2
	expect(1).toBe(1);
});
`),
			/DB-3 has 2 tests/,
		);
	});

	test("a test of a condition that is not in the documents fails", () => {
		fails(
			files(dbTest(ALL_CHECKS), undefined, {
				"packages/core/src/x.test.ts": dbTest(ALL_CHECKS, "DB-99 is not written down"),
			}),
			/x\.test\.ts:3: DB-99 is not in docs\/acceptance\/core/,
		);
	});

	test("a title with no AC number, a lowercase one, or a bare number fails", () => {
		for (const title of [
			"rolls back a failed migration",
			"db-3 rolls back",
			"DB-3",
			"DB-3.1 rolls back",
			"DB-3: rolls back",
		]) {
			fails(files(dbTest(ALL_CHECKS, title)), /migrate\.test\.ts:3: the title ".*" must start with an AC number/);
		}
	});

	test("a Korean title passes", () => {
		passes(files(dbTest(ALL_CHECKS, "DB-3 실패한 마이그레이션을 되돌린다")));
	});

	test("a title that is not a plain string fails", () => {
		fails(
			files(dbTest(ALL_CHECKS).replace('"DB-3 rolls back a failed migration"', `\`DB-3 \${name}\``)),
			/the test title must be a string/,
		);
		fails(
			files(dbTest(ALL_CHECKS).replace('"DB-3 rolls back a failed migration"', "title")),
			/the test title must be a string/,
		);
	});

	test("describe titles are not tests", () => {
		passes(
			files(`import { describe, expect, it } from "vitest";

describe("the migrations", () => {
	it("DB-3 rolls back a failed migration", () => {
${ALL_CHECKS.replaceAll("\t", "\t\t")}
	});
});
`),
		);
	});
});

describe("results above expects", () => {
	test("an expect with no comment fails", () => {
		fails(
			files(dbTest(`${ALL_CHECKS}\n\texpect(4).toBe(4);`)),
			/migrate\.test\.ts:10: the line above this expect must be a comment with the result number/,
		);
	});

	test("a comment that is not right above the expect, or after it, fails", () => {
		const plain = (line) => files(dbTest(ALL_CHECKS.replace("\t// DB-3.3\n\texpect(3).toBe(3);", line)));
		fails(plain("\t// DB-3.3\n\n\texpect(3).toBe(3);"), /the line above this expect/);
		fails(plain("\texpect(3).toBe(3); // DB-3.3"), /the line above this expect/);
		fails(plain("\t// DB-3.3 an error\n\texpect(3).toBe(3);"), /the line above this expect/);
		fails(plain("\t/* DB-3.3 */\n\texpect(3).toBe(3);"), /the line above this expect/);
		fails(plain("\t// DB-3\n\texpect(3).toBe(3);"), /the line above this expect/);
	});

	test("a result number that is not one of the condition's results fails", () => {
		fails(
			files(dbTest(ALL_CHECKS.replace("DB-3.3", "DB-3.9"))),
			/migrate\.test\.ts:9: DB-3\.9 is not a result of DB-3/,
		);
		fails(files(dbTest(ALL_CHECKS.replace("DB-3.3", "DB-4.1"))), /DB-4\.1 is not a result of DB-3/);
		fails(files(dbTest(ALL_CHECKS.replace("DB-3.3", "DB-30.3"))), /DB-30\.3 is not a result of DB-3/);
	});

	test("a result that no expect checks fails and names it", () => {
		fails(
			files(dbTest(ALL_CHECKS.replace("DB-3.3", "DB-3.2"))),
			/db\.md:9: DB-3\.3 is not checked by any expect in the test of DB-3/,
		);
	});
});

describe("expects and tests", () => {
	test("a test with no expect fails", () => {
		fails(files(dbTest("\tawait Promise.resolve();")), /migrate\.test\.ts:3: DB-3 has no expect/);
	});

	test("an expect in beforeEach, afterAll, describe, a helper or at the top level fails", () => {
		for (const outside of [
			"beforeEach(() => {\n\texpect(1).toBe(1);\n});\n",
			"afterAll(async () => {\n\tawait expect(1).toBe(1);\n});\n",
			'describe("x", () => {\n\t// DB-3.1\n\texpect(1).toBe(1);\n});\n',
			"const check = () => expect(1).toBe(1);\n",
			"function check() {\n\t// DB-3.1\n\texpect(1).toBe(1);\n}\n",
			"// DB-3.1\nexpect(1).toBe(1);\n",
		]) {
			fails(
				files(
					`import { afterAll, beforeEach, describe, expect, it } from "vitest";\n\n${outside}\n${dbTest(ALL_CHECKS)}`,
				),
				/expect is used outside an it or test/,
			);
		}
	});

	test("expect inside a test helper file fails", () => {
		fails(
			files(dbTest(ALL_CHECKS), undefined, {
				"packages/core/src/db/__test__/helpers.ts": "export const ok = () => expect(1).toBe(1);\n",
			}),
			/__test__\/helpers\.ts:1: expect is used outside/,
		);
	});

	test("expect.any and other matchers inside an expect are not expects", () => {
		passes(
			files(
				dbTest(
					ALL_CHECKS.replace(
						"expect(3).toBe(3)",
						"expect({ a: 1 }).toEqual(expect.objectContaining({ a: expect.any(Number) }))",
					),
				),
			),
		);
	});

	test("a test in a file that is not a test file is left alone", () => {
		passes({
			...PASSING,
			"packages/core/src/db/helpers.ts": 'import { it } from "vitest";\n\nit("anything", () => {});\n',
		});
	});
});

describe("skipped, focused and parameterized tests", () => {
	const body = `() => {\n${ALL_CHECKS}\n}`;
	const cases = {
		"it.skip": `it.skip("DB-3 rolls back a failed migration", ${body});`,
		"test.only": `test.only("DB-3 rolls back a failed migration", ${body});`,
		"it.todo": 'it.todo("DB-3 rolls back a failed migration");',
		"it.concurrent.skip": `it.concurrent.skip("DB-3 rolls back a failed migration", ${body});`,
		'it["skip"]': `it["skip"]("DB-3 rolls back a failed migration", ${body});`,
		"it.fails": `it.fails("DB-3 rolls back a failed migration", ${body});`,
		"it.skipIf": `it.skipIf(true)("DB-3 rolls back a failed migration", ${body});`,
		"it.runIf": `it.runIf(true)("DB-3 rolls back a failed migration", ${body});`,
		"it.skip.each": `it.skip.each([1])("DB-3 rolls back a failed migration", ${body});`,
		"it.each": `it.each([1])("DB-3 rolls back a failed migration", ${body});`,
		"test.for": `test.for([1])("DB-3 rolls back a failed migration", ${body});`,
		"describe.skip": `describe.skip("migrations", () => { it("DB-3 rolls back a failed migration", ${body}); });`,
		"describe.only": `describe.only("migrations", () => { it("DB-3 rolls back a failed migration", ${body}); });`,
		"describe.todo": 'describe.todo("migrations");',
		xit: `xit("DB-3 rolls back a failed migration", ${body});`,
		fdescribe: `fdescribe("migrations", () => { it("DB-3 rolls back a failed migration", ${body}); });`,
		"{ skip: true }": `it("DB-3 rolls back a failed migration", { skip: true }, ${body});`,
		"{ only: true } after the callback": `it("DB-3 rolls back a failed migration", ${body}, { only: true });`,
		"{ todo: 'later' } on describe": `describe("migrations", { todo: "later" }, () => { it("DB-3 rolls back a failed migration", ${body}); });`,
		"a skip taken out of it": "const later = it.skip;",
	};

	for (const [name, code] of Object.entries(cases)) {
		test(`${name} fails`, () => {
			fails(files(`import { describe, expect, it, test } from "vitest";\n\n${code}\n`), /is not allowed/);
		});
	}

	test("a skip option that is switched off, and a skip outside the test API, are allowed", () => {
		passes(
			files(
				`import { expect, it } from "vitest";\n\nit("DB-3 rolls back a failed migration", { skip: false }, () => {\n${ALL_CHECKS}\n});\nconst options = { skip: true };\n`,
			),
		);
	});
});

describe("a fake database", () => {
	const IMPORTS = [
		'import { newDb } from "pg-mem";',
		'import { PGlite } from "@electric-sql/pglite";',
		'import { PGlite } from "@electric-sql/pglite/worker";',
		'import { PGlite } from "pglite";',
		'import Database from "better-sqlite3";',
		'import initSqlJs from "sql.js";',
		'export * from "pg-mem";',
		'const { newDb } = await import("pg-mem");',
		'const { newDb } = require("pg-mem");',
		'import pgMem = require("pg-mem");',
	];
	for (const code of IMPORTS) {
		test(`${code} fails, in source and in tests`, () => {
			fails({ ...PASSING, "packages/core/src/db/client.ts": `${code}\n` }, /client\.ts:1: .* is a fake database/);
			fails(files(`${code}\n${dbTest(ALL_CHECKS)}`), /migrate\.test\.ts:1: .* is a fake database/);
		});
	}

	const MOCKS = [
		'vi.mock("pg", () => ({}));',
		'vi.mock("pg/lib/client");',
		'vi.mock("postgres");',
		'vi.mock("drizzle-orm/node-postgres");',
		'vi.mock("../db", () => ({}));',
		'vi.mock("./db/client.js");',
		'vi.mock("../database");',
		'vi.mock(import("../db"));',
		'vi.doMock("pg");',
		'vi.unstable_mockModule("kysely", () => ({}));',
		'vi.mock("@prisma/client");',
		'jest.mock("typeorm");',
		'vi.mock("pg-mem");',
	];
	for (const code of MOCKS) {
		test(`${code} fails`, () => {
			fails(files(`${code}\n${dbTest(ALL_CHECKS)}`), /migrate\.test\.ts:1: .* is mocked/);
		});
	}

	const SPIES = [
		'vi.spyOn(db, "query");',
		'vi.spyOn(pool, "connect");',
		'vi.spyOn(pg, "query");',
		'vi.spyOn(ctx.db, "query");',
		'vi.spyOn(testDb, "query");',
		'vi.spyOn(dbPool, "query");',
		'jest.spyOn(DB, "query");',
	];
	for (const code of SPIES) {
		test(`${code} fails`, () => {
			fails(files(`${code}\n${dbTest(ALL_CHECKS)}`), /migrate\.test\.ts:1: the database is spied on/);
		});
	}

	test("mocking and spying on other things is allowed", () => {
		passes(
			files(`vi.mock("node:fs");
vi.mock("../clock");
vi.spyOn(console, "log");
vi.spyOn(Date, "now");
const text = "pg-mem";
${dbTest(ALL_CHECKS)}`),
		);
	});
});

describe("suppression comments", () => {
	const COMMENTS = [
		"// biome-ignore lint/suspicious/noExplicitAny: because",
		"// @ts-expect-error because",
		"// @ts-nocheck",
		"// @ts-ignore",
		"// eslint-disable-next-line no-console",
		"/* eslint-disable */",
		"/** @ts-expect-error */",
		"// Stryker disable next-line all: because",
		"/* Stryker disable all */",
	];
	for (const comment of COMMENTS) {
		test(`${comment} fails in any source file`, () => {
			for (const name of ["a.ts", "a.mts", "a.cts", "a.tsx", "a.js", "a.mjs", "deep/er/a.ts"]) {
				fails(
					{ ...PASSING, [`packages/core/src/${name}`]: `const x = 1;\n${comment}\nconst y: number = "a";\n` },
					new RegExp(`${name.replace(".", "\\.")}:2: a suppression comment`),
				);
			}
		});
	}

	test("a comment on the first line of a file, or alone in it, fails", () => {
		fails({ ...PASSING, "packages/core/src/a.ts": "// @ts-nocheck\nexport const a = 1;\n" }, /a\.ts:1: a suppression/);
		fails({ ...PASSING, "packages/core/src/a.ts": "// @ts-nocheck" }, /a\.ts:1: a suppression/);
		fails({ ...PASSING, "packages/core/src/a.ts": "/* biome-ignore-all lint: x */" }, /a\.ts:1: a suppression/);
	});

	test("a trailing comment, and one in a test file, fails", () => {
		fails(
			{ ...PASSING, "packages/core/src/a.ts": "const x = 1; // biome-ignore lint: because\n" },
			/a\.ts:1: a suppression/,
		);
		fails(files(`${dbTest(ALL_CHECKS)}\n// @ts-nocheck\n`), /migrate\.test\.ts:\d+: a suppression/);
	});

	test("the same words in a string, a template, a regular expression or a name are not comments", () => {
		passes({
			...PASSING,
			"packages/core/src/a.ts": `export const a = "// biome-ignore";\nexport const b = \`// @ts-nocheck \${a}\`;\nexport const c = /\\/\\/ eslint-disable/;\nexport const d = "x" + \`// @ts-ignore\`;\n`,
			"packages/core/src/b.tsx": "export const e = <p>// @ts-expect-error</p>;\n",
		});
	});

	test("files outside packages/core/src, node_modules and dist are not read", () => {
		passes({
			...PASSING,
			"packages/core/biome-plugins/x.mjs": "// biome-ignore\n",
			"packages/core/src/node_modules/x/index.js": "// @ts-nocheck\n",
			"packages/core/src/dist/x.js": "// @ts-nocheck\n",
			"packages/other/src/x.ts": "// @ts-nocheck\n",
		});
	});
});

describe("environment variables", () => {
	const SOURCE = "packages/core/src/a.ts";
	const HELPER = "packages/core/src/__test__/database.ts";
	const ENV_TYPES = "packages/core/env.d.ts";
	const DECLARED = `declare namespace NodeJS {
	interface ProcessEnv {
		readonly NODE_ENV?: "development" | "production" | "test";
		readonly TEST_DATABASE_URL?: string;
	}
}
`;
	const WITH_ENV = { ...PASSING, [ENV_TYPES]: DECLARED };
	const source = (code, extra = WITH_ENV) => ({ ...extra, [SOURCE]: `${code}\n` });
	const helper = (code) => ({ ...WITH_ENV, [HELPER]: `${code}\n` });

	test("the variables declared on ProcessEnv in packages/core/env.d.ts are read anywhere", () => {
		passes(source('export const dev = process.env.NODE_ENV === "development";'));
		passes(source("export const url = process.env.TEST_DATABASE_URL;"));
		passes(helper("export const dev = process.env.NODE_ENV;\nexport const url = process.env.TEST_DATABASE_URL;"));
	});

	test("a variable added to env.d.ts is approved, and none is without the file", () => {
		const more = {
			...WITH_ENV,
			[ENV_TYPES]: DECLARED.replace("readonly NODE_ENV", "readonly FOO?: string;\n\t\treadonly NODE_ENV"),
		};
		passes(source("export const foo = process.env.FOO;", more));
		fails(
			source("export const dev = process.env.NODE_ENV;", PASSING),
			/a\.ts:1: process\.env\.NODE_ENV is not declared in packages\/core\/env\.d\.ts/,
		);
	});

	test("process.env.FOO fails, in source and in tests, until it is declared", () => {
		const message =
			/:1: process\.env\.FOO is not declared in packages\/core\/env\.d\.ts: ask the PM and owner to approve it/;
		fails(source("export const foo = process.env.FOO;"), message);
		fails(helper("export const foo = process.env.FOO;"), message);
	});

	const FALLBACKS = [
		['process.env.TEST_DATABASE_URL ?? "postgres://localhost:5432/postgres"', "TEST_DATABASE_URL"],
		['process.env.TEST_DATABASE_URL || "postgres://localhost/postgres"', "TEST_DATABASE_URL"],
		["(process.env.NODE_ENV) ?? (`production`)", "NODE_ENV"],
		["process.env.NODE_ENV ?? false", "NODE_ENV"],
		["process.env.NODE_ENV || true", "NODE_ENV"],
		["process.env.NODE_ENV ?? null", "NODE_ENV"],
		["process.env.TEST_DATABASE_URL ?? -1", "TEST_DATABASE_URL"],
		["process.env.TEST_DATABASE_URL ?? (-1n)", "TEST_DATABASE_URL"],
		['process.env.TEST_DATABASE_URL ?? { host: "localhost" }', "TEST_DATABASE_URL"],
		['process.env.TEST_DATABASE_URL ?? ["postgres://localhost"]', "TEST_DATABASE_URL"],
		["globalThis.process.env.NODE_ENV ?? 'test'", "NODE_ENV"],
	];
	for (const [code, name] of FALLBACKS) {
		test(`${code} fails: a fallback value is written in`, () => {
			fails(
				helper(`export const x = ${code};`),
				new RegExp(`database\\.ts:1: process\\.env\\.${name} has a fallback value written in`),
			);
		});
	}

	test("a fallback that is not a written-in value passes", () => {
		passes(helper("const a = process.env.NODE_ENV ?? undefined;\nconst b = process.env.TEST_DATABASE_URL ?? a;"));
		passes(helper("const a = 1;\nexport const b = process.env.NODE_ENV ?? -a;"));
	});

	const NOT_BY_NAME = [
		'export const url = process.env["TEST_DATABASE_URL"];',
		"export const { NODE_ENV } = process.env;",
		'const { NODE_ENV = "test" } = process.env;',
		"const env = process.env;",
		"const all = { ...process.env };",
		"const name = 'NODE_ENV';\nconst value = process.env[name];",
		'export const dev = process["env"].NODE_ENV;',
		"export const dev = process[`env`].NODE_ENV;",
		'export const dev = (process)["env"];',
		"const { env } = process;",
		"const { env: vars } = process;",
		'const { "env": vars } = process;',
		"const { env, argv } = globalThis.process;",
		'export const dev = globalThis.process["env"].NODE_ENV;',
		"export const { NODE_ENV } = globalThis.process.env;",
		'const { ["env"]: vars } = process;',
		"export function read({ env } = process) {\n\treturn env;\n}",
		"let env;\n({ env } = process);",
		'let vars;\n({ "env": vars } = globalThis.process);',
	];
	for (const code of NOT_BY_NAME) {
		test(`${code.replaceAll("\n", " ")} fails: process.env is read only as process.env.NAME`, () => {
			fails(
				source(code),
				/a\.ts:\d+: process\.env must be read as process\.env\.NAME, with NAME declared in packages\/core\/env\.d\.ts/,
			);
		});
	}

	test("process.env in a string or another object's env is not read", () => {
		passes(source('export const a = "process.env.FOO";\nconst config = { env: {} };\nexport const b = config.env;'));
		passes(source('const { argv } = process;\nconst { env } = config;\nexport const a = process["argv"];'));
	});

	test("globalThis.process.env is read like process.env", () => {
		passes(source("export const dev = globalThis.process.env.NODE_ENV;"));
		fails(
			source("export const foo = globalThis.process.env.FOO;"),
			/a\.ts:1: process\.env\.FOO is not declared in packages\/core\/env\.d\.ts/,
		);
	});

	test("only ProcessEnv inside namespace NodeJS approves a variable", () => {
		const declared = (text) => ({ ...WITH_ENV, [ENV_TYPES]: text });
		const notDeclared = /a\.ts:1: process\.env\.FOO is not declared in packages\/core\/env\.d\.ts/;
		const read = "export const foo = process.env.FOO;";
		fails(source(read, declared(`${DECLARED}interface ProcessEnv {\n\treadonly FOO?: string;\n}\n`)), notDeclared);
		fails(
			source(
				read,
				declared(
					`${DECLARED}declare namespace Other {\n\tinterface ProcessEnv {\n\t\treadonly FOO?: string;\n\t}\n}\n`,
				),
			),
			notDeclared,
		);
		fails(
			source(
				read,
				declared(
					`${DECLARED}declare namespace Outer {\n\tnamespace NodeJS {\n\t\tinterface ProcessEnv {\n\t\t\treadonly FOO?: string;\n\t\t}\n\t}\n}\n`,
				),
			),
			notDeclared,
		);
		passes(
			source(
				read,
				declared(
					`${DECLARED}declare global {\n\tnamespace NodeJS {\n\t\tinterface ProcessEnv {\n\t\t\treadonly FOO?: string;\n\t\t}\n\t}\n}\nexport {};\n`,
				),
			),
		);
	});
});

describe("finding TypeScript", () => {
	const gitIn = (cwd, ...args) => {
		const result = spawnSync("git", args, { cwd, encoding: "utf8" });
		assert.equal(result.status, 0, result.stderr);
	};

	const freshDirectory = () => {
		const dir = realpathSync(mkdtempSync(path.join(tmpdir(), "monti-fence-test-")));
		roots.push(dir);
		return dir;
	};

	/** A copy of fence.mjs in `dir`, so it cannot find the TypeScript of this repository by its own location. */
	function copyFence(dir) {
		mkdirSync(path.join(dir, "agent-guard"), { recursive: true });
		copyFileSync(FENCE, path.join(dir, "agent-guard", "fence.mjs"));
	}

	const loadCheckFence = async (dir) =>
		(await import(pathToFileURL(path.join(dir, "agent-guard", "fence.mjs")).href)).checkFence;

	test("a git worktree without node_modules uses the TypeScript of the main checkout", async () => {
		const main = freshDirectory();
		gitIn(main, "init", "-q", "-b", "main");
		gitIn(main, "config", "user.email", "test@example.com");
		gitIn(main, "config", "user.name", "Test");
		gitIn(main, "config", "commit.gpgsign", "false");
		mkdirSync(path.join(main, "docs", "acceptance", "core"), { recursive: true });
		writeFileSync(path.join(main, "docs", "acceptance", "core", "db.md"), AC);
		copyFence(main);
		gitIn(main, "add", "docs", "agent-guard");
		gitIn(main, "commit", "-q", "-m", "initial");
		// Installed in the main checkout only, and not committed, as in the real repository.
		mkdirSync(path.join(main, "node_modules"));
		symlinkSync(TYPESCRIPT, path.join(main, "node_modules", "typescript"), "dir");

		const worktree = path.join(freshDirectory(), "worktree");
		gitIn(main, "worktree", "add", "-q", "-b", "fresh", worktree);
		assert.equal(existsSync(path.join(worktree, "node_modules")), false);

		const checkFenceInWorktree = await loadCheckFence(worktree);
		const problems = checkFenceInWorktree(worktree);
		assert.match(problems.join("\n"), /docs\/acceptance\/core\/db\.md:\d+: DB-3 has no test/);
	});

	test("a folder with no TypeScript anywhere is an error that says so", async () => {
		const dir = freshDirectory();
		copyFence(dir);
		const checkFenceInDir = await loadCheckFence(dir);
		assert.throws(() => checkFenceInDir(dir), /TypeScript was not found .*run pnpm install/);
	});
});

describe("multi-package fence and integration tests", () => {
	test("checks docs/acceptance/<pkg> against packages/<pkg>/src without requiring env.d.ts", () => {
		const cliAc =
			"<details>\n<summary><strong><code>CLI-1</code></strong> prints version</summary>\n- `CLI-1.1` outputs version\n</details>\n";
		const cliTest = 'test("CLI-1 prints version", () => {\n\t// CLI-1.1\n\texpect(1).toBe(1);\n});\n';
		passes({
			"docs/acceptance/cli/cli.md": cliAc,
			"packages/cli/src/bin.mjs": "const env = process.env;\nexport { env };\n",
			"packages/cli/src/cli.test.ts": cliTest,
		});
		fails({ "docs/acceptance/cli/cli.md": cliAc }, /docs\/acceptance\/cli\/cli\.md:2: CLI-1 has no test/);
	});

	test("checks packages/<pkg>/tests for suppressions, fake DBs, skips, and empty tests without requiring AC numbers", () => {
		passes({
			"packages/core/tests/integration.test.ts": 'test("end to end lifecycle", () => {\n\texpect(1).toBe(1);\n});\n',
		});
		fails(
			{
				"packages/core/tests/integration.test.ts": 'test.skip("skipped", () => {\n\texpect(1).toBe(1);\n});\n',
			},
			/test\.skip is not allowed/,
		);
		fails(
			{
				"packages/core/tests/integration.test.ts":
					'// biome-ignore lint/suspicious/noExplicitAny: x\ntest("empty", () => {});\n',
			},
			/suppression comment/,
			/this test has no expect/,
		);
		fails(
			{
				"packages/core/tests/integration.test.ts":
					'import { PGlite } from "@electric-sql/pglite";\ntest("fake", () => {\n\texpect(PGlite).toBeDefined();\n});\n',
			},
			/fake database/,
		);
	});
});
