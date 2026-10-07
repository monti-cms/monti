import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	closeGlobalPool,
	createIsolatedTestPool,
	dropIsolatedTestPool,
} from "../../adapters/postgres/__test__/test-database";
import { migrate } from "../migrate";
import { project, setEnv } from "./doctor-helpers";

const DATABASE = process.env.CMS_TEST_DATABASE_URL ?? "";

describe("monti migrate says where it migrates and what it did", () => {
	let pool: Pool;
	let schemaName: string;

	beforeAll(async () => {
		const isolated = await createIsolatedTestPool();
		pool = isolated.pool;
		schemaName = isolated.schemaName;
	});

	afterAll(async () => {
		if (pool && schemaName) await dropIsolatedTestPool(pool, schemaName);
		await closeGlobalPool();
	});

	const run = async () => {
		setEnv({ DATABASE_URL: DATABASE, DATABASE_SCHEMA: schemaName });
		const lines: string[] = [];
		const ok = await migrate({ cwd: project(), envFiles: [], log: (line) => lines.push(line) });
		return { ok, text: lines.join("\n") };
	};

	it("names the host, the database and the schema, and counts the steps it ran", async () => {
		const first = await run();
		expect(first.ok).toBe(true);
		const target = new URL(DATABASE);
		expect(first.text).toContain(`${target.hostname}`);
		expect(first.text).toContain(target.pathname.slice(1));
		expect(first.text).toContain(`schema "${schemaName}"`);
		// The password never appears.
		expect(first.text).not.toContain(decodeURIComponent(target.password));
		const applied = /Applied (\d+) steps?, (\d+) already up to date\./.exec(first.text);
		expect(Number(applied?.[1])).toBeGreaterThan(0);
		expect(applied?.[2]).toBe("0");
	});

	it("a second run applies nothing and counts the same steps as up to date", async () => {
		const again = /Applied 0 steps, (\d+) already up to date\./.exec((await run()).text);
		expect(Number(again?.[1])).toBeGreaterThan(0);
	});
});
