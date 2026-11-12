import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { sql, testDatabase } from "../__test__/database";

const db = await testDatabase();
const bin = fileURLToPath(new URL("../../bin/monti.mjs", import.meta.url));

const KEY = "sk-piped-key-0000-abcd";
const TYPED = "sk-example-secret-typed-on-the-line";

let site = "";
beforeAll(async () => {
	const { rows } = await sql<{ schema: string }>`select current_schema() as schema`.execute(db);
	const database = new URL(process.env.CMS_TEST_DATABASE_URL as string);
	database.searchParams.set("options", `-c search_path=${rows[0].schema}`);
	site = await mkdtemp(path.join(tmpdir(), "monti-cli-"));
	// A site whose one key service takes exactly KEY, so the command needs no network.
	await writeFile(
		path.join(site, "monti.config.mjs"),
		`export default {
			schema: { locales: { source: "en", list: [{ code: "en", name: "English" }], prefix: "never" }, collections: {} },
			database: ${JSON.stringify(database.toString())},
			secret: "cli-test-secret",
			dev: false,
			plugins: [{ name: "local", keyServices: [{ id: "local", name: "Local",
				check: async ({ secret }) => secret === ${JSON.stringify(KEY)} ? { ok: true, models: [] } : { ok: false, reason: "refused" } }] }],
		};`,
	);
});
afterAll(async () => {
	if (site) await rm(site, { recursive: true, force: true });
});
beforeEach(async () => {
	await sql`truncate api_keys, monti_activity cascade`.execute(db);
});

/** Runs `monti <args>` in the site's folder, as a shell would, with `piped` on its standard input. */
function monti(args: string[], piped?: string) {
	return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
		const child = spawn(process.execPath, [bin, ...args], { cwd: site, env: process.env });
		let stdout = "";
		let stderr = "";
		child.stdout.on("data", (chunk: Buffer) => {
			stdout += chunk.toString();
		});
		child.stderr.on("data", (chunk: Buffer) => {
			stderr += chunk.toString();
		});
		child.on("error", reject);
		child.on("close", (code) => resolve({ code, stdout, stderr }));
		child.stdin.end(piped ?? "");
	});
}

const stored = () => db.selectFrom("api_keys").select(["name", "last4"]).execute();

describe("a key given to the real command", () => {
	it.each([
		["without a final newline (printf '%s')", KEY],
		["with a final newline (echo)", `${KEY}\n`],
	])("14-4 piped in %s it is taken, and standard output is the result alone", async (_how, piped) => {
		const ran = await monti(["keys.add", "--service", "local", "--name", "Local", "--secret", "-"], piped);
		expect(ran.code).toBe(0);
		// What `| jq` would get: JSON and nothing else, no prompt in front of it.
		expect(JSON.parse(ran.stdout).output).toMatchObject({ name: "Local", last4: "abcd" });
		expect(ran.stderr).toBe("");
		expect(await stored()).toEqual([{ name: "Local", last4: "abcd" }]);
	});

	it("14-4 a key typed after `--secret -` is refused, and no output says what was typed", async () => {
		const ran = await monti(["keys.add", "--service", "local", "--name", "Local", "--secret", "-", TYPED], KEY);
		expect(ran.code).toBe(1);
		expect(ran.stdout + ran.stderr).not.toContain(TYPED);
		expect(await stored()).toEqual([]);
	});

	it("14-4 a key typed as an argument cannot be hidden behind `--input`: the command does not run", async () => {
		for (const args of [
			["--secret", TYPED, "--input", JSON.stringify({ secret: "-" })],
			["--input", JSON.stringify({ secret: "-" }), "--secret", TYPED],
			["--secret", "-", "--secret", TYPED],
			["--input", JSON.stringify({ secret: TYPED })],
			[`--secret=${TYPED}`],
		]) {
			const ran = await monti(["keys.add", "--service", "local", "--name", "Local", ...args], KEY);
			expect(ran.code).toBe(1);
			expect(ran.stdout + ran.stderr).not.toContain(TYPED);
			expect(ran.stderr).toContain("standard input");
		}
		expect(await stored()).toEqual([]);
	});

	it("an argument that is no --name is reported by its place, never by what it says", async () => {
		const ran = await monti(["keys.list", "stray-word-on-the-line"]);
		expect(ran.code).toBe(1);
		expect(ran.stdout + ran.stderr).not.toContain("stray-word-on-the-line");
		expect(ran.stderr).toContain("Argument 1");
	});
});
