import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Kysely } from "kysely";
import { afterEach, beforeEach, expect, it } from "vitest";
import { createTestDatabase, type TestDatabase } from "../../__test__/database";
import { migrate } from "../../db/migrate";
import { initial } from "../../db/migrations/0001-initial";
import type { Database } from "../../db/types";
import { createMonti } from "../../engine/engine";
import type { MontiConfig } from "../../engine/types";
import { config } from "./config";

let testDb: TestDatabase;
let db: Kysely<Database>;
let dir: string;
let schemaFile: string;
let configFile: string;

/** 이름 말고도 주석, 다른 설정, 사이트 이름 뒤의 플러그인 이름이 든 설정 파일. */
const originalText = `// 사이트 설정.
export default {
	name: "Monti Blog", dev: true,
	plugins: [{ name: "monti-plugin-search" }],
};
`;

const newName = "Monti Journal";

function montiOf(dev: boolean) {
	return createMonti(db, { config }, [], {
		schema: { locales: ["ko"], collections: {} },
		config: { name: "Monti Blog", dev },
		schemaFile,
		configFile,
	});
}

/** 앱이 가져오는 방식대로 읽은 설정 파일의 사이트 이름. 테스트마다 행동 뒤에 한 번만 가져온다. */
async function nameInFile(): Promise<string> {
	const module: { default: MontiConfig } = await import(configFile);
	return module.default.name;
}

beforeEach(async () => {
	testDb = await createTestDatabase();
	await migrate(testDb.db, "core", [initial]);
	db = testDb.db as Kysely<Database>;
	dir = await mkdtemp(path.join(tmpdir(), "monti-config-"));
	schemaFile = path.join(dir, "monti.schema.ts");
	configFile = path.join(dir, "monti.config.ts");
	await writeFile(schemaFile, `export default { locales: ["ko"], collections: {} };\n`);
	await writeFile(configFile, originalText);
});

afterEach(async () => {
	await testDb.drop();
	await rm(dir, { recursive: true });
});

it("CFG-GET-1 현재 사이트 설정을 돌려준다", async () => {
	const monti = montiOf(false);

	// CFG-GET-1.1
	expect(await monti.config.get({})).toEqual({ name: "Monti Blog", dev: false });
});

it("CFG-UPD-1 개발 서버에서 사이트 이름을 바꾸고 설정 파일에 기록한다", async () => {
	const monti = montiOf(true);

	const output = await monti.config.update({ name: newName });

	// CFG-UPD-1.1
	expect(output.name).toBe(newName);
	// CFG-UPD-1.2
	expect(await monti.config.get({})).toEqual({ name: newName, dev: true });
	// CFG-UPD-1.3
	expect(await nameInFile()).toBe(newName);
	// CFG-UPD-1.4
	expect(await readFile(configFile, "utf8")).toBe(originalText.replace('"Monti Blog"', JSON.stringify(newName)));
});

it("CFG-UPD-2 개발 서버가 아니면 사이트 설정을 수정할 수 없다", async () => {
	const monti = montiOf(false);

	// CFG-UPD-2.1
	await expect(monti.config.update({ name: newName })).rejects.toMatchObject({ code: "FORBIDDEN" });
	// CFG-UPD-2.2
	expect(await monti.config.get({})).toEqual({ name: "Monti Blog", dev: false });
	// CFG-UPD-2.3
	expect(await readFile(configFile, "utf8")).toBe(originalText);
});

it("CFG-UPD-3 트랜잭션이 실패해 롤백되면 설정과 설정 파일은 바뀌지 않는다", async () => {
	const monti = montiOf(true);

	const rollback = new Error("롤백");
	await monti
		.transaction(async (tx) => {
			await tx.config.update({ name: newName });
			throw rollback;
		})
		.catch((error: unknown) => {
			if (error !== rollback) throw error;
		});

	// CFG-UPD-3.1
	expect(await monti.config.get({})).toEqual({ name: "Monti Blog", dev: true });
	// CFG-UPD-3.2
	expect(await readFile(configFile, "utf8")).toBe(originalText);
});

it("CFG-UPD-4 드라이런으로 실행하면 설정과 설정 파일은 바뀌지 않는다", async () => {
	const monti = montiOf(true);

	await monti.dryRun(async (tx) => {
		await tx.config.update({ name: newName });
	});

	// CFG-UPD-4.1
	expect(await monti.config.get({})).toEqual({ name: "Monti Blog", dev: true });
	// CFG-UPD-4.2
	expect(await readFile(configFile, "utf8")).toBe(originalText);
});
