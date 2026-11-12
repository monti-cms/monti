import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { type AddressInfo, createServer, type Socket } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { sql, testDatabase } from "../../__test__/database";
import type { MontiConfig } from "../../config";
import { localFolderStorage } from "../../media/local-storage";
import { memoryStorage } from "../../media/storage";
import { doctor } from "./command";
import { type DoctorOptions, runDoctor } from "./run";

const db = await testDatabase();
const { rows } = await sql<{ schema: string }>`select current_schema() as schema`.execute(db);
/** The test database, at a schema: this file's own (with the core's tables), or another. */
const databaseAt = (schema: string) => {
	const address = new URL(process.env.CMS_TEST_DATABASE_URL as string);
	address.searchParams.set("options", `-c search_path=${schema}`);
	return address.toString();
};
const DATABASE = databaseAt(rows[0].schema);
const SECRET = "a-long-secret-of-the-test-site-0123456789";

const made: string[] = [];
afterEach(() => {
	for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true });
});
afterAll(async () => {
	await sql`drop schema if exists doctor_bare cascade`.execute(db);
	await sql`drop schema if exists doctor_odd cascade`.execute(db);
});

/**
 * A site's folder as `monti init` leaves it: a Next app with the three packages, the admin's page, layout and API route. With `under` it is a
 * package of a workspace: the installed packages stay at the workspace's root.
 */
function site(
	change: { versions?: Record<string, string>; files?: Record<string, string | null>; under?: string } = {},
) {
	const root = mkdtempSync(path.join(tmpdir(), "monti-doctor-"));
	made.push(root);
	const dir = path.join(root, change.under ?? "");
	const files: Record<string, string | null> = {
		"package.json": JSON.stringify({ name: "site", dependencies: { next: "16.4.6" } }),
		"node_modules/next/package.json": JSON.stringify({ version: "16.4.6" }),
		...Object.fromEntries(
			["core", "admin", "next"].map((name) => [
				`node_modules/@monti-cms/${name}/package.json`,
				JSON.stringify({ version: change.versions?.[name] ?? "0.2.0" }),
			]),
		),
		"monti.config.ts": "export default {};\n",
		"monti.schema.ts": "export default {};\n",
		"app/(site)/layout.tsx": "export default function Layout() { return null; }\n",
		"app/(site)/page.tsx": "export default function Home() { return null; }\n",
		"app/admin/layout.tsx": "export default function Layout() { return null; }\n",
		"app/admin/page.tsx": 'import { AdminPage } from "@monti-cms/next/admin";\nexport default () => <AdminPage />;\n',
		"app/admin/api/[...path]/route.ts": "export const { GET, POST, PUT } = adminRoute(monti);\n",
		".gitignore": "node_modules\n.env*\n",
		...change.files,
	};
	for (const [name, text] of Object.entries(files)) {
		if (text === null) continue;
		const file = name.startsWith("node_modules/") ? path.join(root, name) : path.join(dir, name);
		mkdirSync(path.dirname(file), { recursive: true });
		writeFileSync(file, text);
	}
	return dir;
}

const config = (change: Partial<MontiConfig> = {}): MontiConfig => ({
	schema: {
		locales: { source: "en", list: [{ code: "en", name: "English" }], prefix: "never" },
		collections: {
			post: {
				kind: "document",
				path: "/posts/:slug",
				fields: { title: { kind: "text", required: true }, slug: { kind: "slug", required: true } },
			},
		},
	},
	database: DATABASE,
	dev: false,
	plugins: [{ name: "files", storage: memoryStorage() }],
	...change,
});

const options = (
	cwd: string,
	change: Partial<DoctorOptions> & { config?: Partial<MontiConfig> } = {},
): DoctorOptions => {
	const { config: changed, ...rest } = change;
	return {
		cwd,
		env: { MONTI_SECRET: SECRET, DATABASE_URL: DATABASE },
		envFrom: new Map([["MONTI_SECRET", ".env.local"]]),
		configFile: path.join(cwd, "monti.config.ts"),
		loadConfig: async () => config(changed),
		...rest,
	};
};
/** What a check found: its status and its fix. */
const found = async (given: DoctorOptions, id: string) => {
	const check = (await runDoctor(given)).checks.find((each) => each.id === id);
	return { status: check?.status, fix: check?.fix, message: check?.message };
};

describe("monti doctor", () => {
	it("20-8 a site set up as init leaves it has no failure and no warning, every check in the order a person reads them", async () => {
		const report = await runDoctor(options(site()));
		expect(report.checks.map((check) => `${check.status} ${check.id}`)).toEqual([
			"ok site/next",
			"ok site/packages",
			"ok site/layout",
			"ok files/config",
			"ok files/schema",
			"ok files/admin",
			"ok files/gitignore",
			"ok env/secret",
			"ok database/url",
			"ok database/reachable",
			"ok database/migrations",
			"ok storage/configured",
			"ok storage/reachable",
			"ok storage/host",
			"ok auth/login",
		]);
		expect(report.ok).toBe(true);
	});

	it("20-8 a missing or weak secret fails by its name and says how to make one", async () => {
		const dir = site();
		expect(await found(options(dir, { env: { DATABASE_URL: DATABASE } }), "env/secret")).toMatchObject({
			status: "fail",
			fix: "add MONTI_SECRET with a long random value (openssl rand -base64 32)",
		});
		expect((await found(options(dir, { env: { MONTI_SECRET: "change-me" } }), "env/secret")).status).toBe("fail");
		expect((await found(options(dir, { env: { MONTI_SECRET: "short" } }), "env/secret")).status).toBe("fail");
	});

	it("20-8 a database that does not answer fails as unreachable, and what waits on it is skipped, not failed", async () => {
		const report = await runDoctor(options(site(), { config: { database: "postgres://127.0.0.1:9/nowhere" } }));
		const by = Object.fromEntries(report.checks.map((check) => [check.id, check.status]));
		expect(by["database/reachable"]).toBe("fail");
		expect(by["database/migrations"]).toBe("skip");
		// The address holds a password: the message names the host and the database only.
		expect(report.checks.find((check) => check.id === "database/reachable")?.message).toContain("127.0.0.1/nowhere");
	});

	it("20-8 a database without Monti's tables, or behind this version, fails with the command that brings it up", async () => {
		await sql`create schema doctor_bare`.execute(db);
		expect(
			await found(options(site(), { config: { database: databaseAt("doctor_bare") } }), "database/migrations"),
		).toMatchObject({
			status: "fail",
			fix: "npx monti db:setup",
		});
		// A step this database has not run yet.
		const last = await sql<{ name: string }>`select name from monti_migration order by name desc limit 1`.execute(db);
		await sql`delete from monti_migration where name = ${last.rows[0].name}`.execute(db);
		try {
			expect(await found(options(site()), "database/migrations")).toMatchObject({
				status: "fail",
				fix: "npx monti db:migrate",
			});
		} finally {
			await sql`insert into monti_migration (name, timestamp) values (${last.rows[0].name}, ${new Date().toISOString()})`.execute(
				db,
			);
		}
	});

	it("20-8 a broken schema, a storage that does not answer, a folder on a host with no disk and packages of two releases each fail by name", async () => {
		const broken = config().schema;
		broken.collections.post = { ...broken.collections.post, path: "posts" } as never;
		expect((await found(options(site(), { config: { schema: broken } }), "files/schema")).status).toBe("fail");

		const dead = { ...memoryStorage(), stat: async () => Promise.reject(new Error("AccessDenied: no such bucket")) };
		expect(
			await found(options(site(), { config: { plugins: [{ name: "files", storage: dead }] } }), "storage/reachable"),
		).toMatchObject({
			status: "fail",
			message: "The storage does not answer: AccessDenied: no such bucket",
		});

		const dir = site();
		const folder = {
			plugins: [{ name: "files", storage: localFolderStorage({ dir: path.join(dir, ".monti", "files") }) }],
		};
		expect((await found(options(dir, { config: folder }), "storage/host")).status).toBe("ok");
		expect(
			await found(options(dir, { config: folder, env: { MONTI_SECRET: SECRET, VERCEL: "1" } }), "storage/host"),
		).toMatchObject({ status: "fail", fix: "use an S3-compatible storage on this host" });
		expect((await found(options(dir, { config: { plugins: [] } }), "storage/configured")).status).toBe("warn");

		expect(await found(options(site({ versions: { admin: "0.1.9" } })), "site/packages")).toMatchObject({
			status: "fail",
			fix: "install all three from one release",
		});
	});

	it("20-15 an admin drawn inside the site's own layout is a warning that says what to move; an admin with no layout at all fails", async () => {
		const shared = site({
			files: {
				"app/(site)/layout.tsx": null,
				"app/(site)/page.tsx": null,
				"app/admin/layout.tsx": null,
				"app/layout.tsx": "export default function Root() { return null; }\n",
				"app/page.tsx": "export default function Home() { return null; }\n",
			},
		});
		expect(await found(options(shared), "site/layout")).toMatchObject({
			status: "warn",
			fix: "move the site's pages and that layout into app/(site)/, then run npx monti init again: it writes the admin's own layout",
		});
		expect((await found(options(site({ files: { "app/admin/layout.tsx": null } })), "site/layout")).status).toBe(
			"fail",
		);
	});

	it("20-9 without a config, or with one that does not load, it runs to the end: the config fails and what needs it is skipped", async () => {
		const dir = site({ files: { "monti.config.ts": null } });
		const none = await runDoctor(options(dir, { configFile: null, env: { MONTI_SECRET: SECRET } }));
		const by = Object.fromEntries(none.checks.map((check) => [check.id, check.status]));
		expect(by).toMatchObject({
			"site/next": "ok",
			"files/config": "fail",
			"files/schema": "skip",
			"env/secret": "ok",
			"database/url": "fail",
			"storage/configured": "skip",
			"auth/login": "skip",
		});
		expect(none.checks).toHaveLength(15);
		const thrown = await runDoctor(
			options(site(), {
				loadConfig: async () => {
					throw new Error("Unexpected token (3:1)\n  at parse");
				},
			}),
		);
		expect(thrown.checks.find((check) => check.id === "files/config")).toMatchObject({
			status: "fail",
			message: "monti.config.ts does not load: Unexpected token (3:1)",
		});
		// The address in the environment is still tried.
		expect(thrown.checks.find((check) => check.id === "database/reachable")?.status).toBe("ok");
	});

	it("20-9 it writes nothing, to the folder, the storage or the database, and prints no secret; a failure ends it with 1, and --json is the same report", async () => {
		const dir = site();
		const storage = memoryStorage();
		const put = vi.spyOn(storage, "put");
		const remove = vi.spyOn(storage, "remove");
		const tree = (at: string): string[] =>
			readdirSync(at, { withFileTypes: true }).flatMap((entry) =>
				entry.isDirectory() ? tree(path.join(at, entry.name)) : [path.join(at, entry.name)],
			);
		const before = tree(dir);
		const activity = async () =>
			(await db.selectFrom("monti_activity").select(db.fn.countAll<string>().as("n")).executeTakeFirstOrThrow()).n;
		const rowsBefore = await activity();
		const password = "the-database-password";
		const given = {
			...options(dir, {
				config: { plugins: [{ name: "files", storage }], database: `postgres://monti:${password}@127.0.0.1:9/nowhere` },
			}),
			argv: [] as string[],
		};
		const printed: string[] = [];
		expect(await doctor({ ...given, out: (line) => printed.push(line) })).toBe(1);
		expect(printed.join("\n")).toContain("FAIL  database/reachable");
		expect(printed.join("\n")).not.toContain(SECRET);
		expect(printed.join("\n")).not.toContain(password);
		expect(tree(dir)).toEqual(before);
		expect(put).not.toHaveBeenCalled();
		expect(remove).not.toHaveBeenCalled();
		expect(await activity()).toBe(rowsBefore);

		const json: string[] = [];
		expect(await doctor({ ...given, argv: ["--json"], out: (line) => json.push(line) })).toBe(1);
		const report = JSON.parse(json.join("\n")) as { ok: boolean; checks: { id: string; status: string }[] };
		expect(report.ok).toBe(false);
		expect(report.checks.find((check) => check.id === "database/reachable")?.status).toBe("fail");
		expect(json.join("\n")).not.toContain(password);
		// A healthy site ends with 0.
		expect(await doctor({ ...options(site()), argv: [], out: () => {} })).toBe(0);
	});

	it("20-9 what it cannot read is that check's failure, not a crash: a broken change file, tables it cannot read, a site that does not open; --json still prints", async () => {
		const broken = site({ files: { "monti/changes/0001-first.json": "{ not json" } });
		const report = await runDoctor(options(broken));
		expect(report.checks.find((check) => check.id === "database/migrations")).toMatchObject({
			status: "fail",
			where: "monti/changes",
		});
		expect(report.checks.find((check) => check.id === "database/migrations")?.message).toMatch(
			/^The schema's change files do not read: /,
		);
		expect(report.checks).toHaveLength(15);
		expect(report.checks.at(-1)).toMatchObject({ id: "auth/login", status: "ok" });

		// A table by Monti's name that is not Monti's: reading what was followed fails.
		await sql`create schema doctor_odd`.execute(db);
		await sql`create table doctor_odd.monti_migration (id int)`.execute(db);
		expect(
			await found(options(site(), { config: { database: databaseAt("doctor_odd") } }), "database/migrations"),
		).toMatchObject({
			status: "fail",
			message: 'What the database has followed could not be read: column "name" does not exist',
		});

		const twice = {
			plugins: [
				{ name: "files", storage: memoryStorage() },
				{ name: "more", storage: memoryStorage() },
			],
		};
		const printed: string[] = [];
		expect(
			await doctor({ ...options(site(), { config: twice }), argv: ["--json"], out: (line) => printed.push(line) }),
		).toBe(1);
		const json = JSON.parse(printed.join("\n")) as { checks: { id: string; status: string; message: string }[] };
		expect(json.checks.filter((check) => check.id.startsWith("storage/"))).toEqual([
			expect.objectContaining({
				id: "storage/configured",
				status: "fail",
				message: "The site does not open: Two plugins bring a media storage: files, more. A site has one.",
			}),
			expect.objectContaining({ id: "storage/reachable", status: "skip" }),
			expect.objectContaining({ id: "storage/host", status: "skip" }),
		]);
		expect(json.checks.at(-1)?.id).toBe("auth/login");
	});

	it("20-9 a database or a storage that takes the call and never answers fails its check by name, in time", async () => {
		// Takes the connection and says nothing.
		const taken: Socket[] = [];
		const silent = createServer((socket) => taken.push(socket));
		await new Promise<void>((resolve) => silent.listen(0, "127.0.0.1", resolve));
		try {
			const { port } = silent.address() as AddressInfo;
			const started = Date.now();
			const report = await runDoctor(
				options(site(), { timeout: 100, config: { database: `postgres://127.0.0.1:${port}/nowhere` } }),
			);
			expect(Date.now() - started).toBeLessThan(3000);
			expect(report.checks.find((check) => check.id === "database/reachable")).toMatchObject({ status: "fail" });
			expect(report.checks.find((check) => check.id === "database/migrations")?.status).toBe("skip");
			expect(report.checks).toHaveLength(15);
		} finally {
			for (const socket of taken) socket.destroy();
			silent.close();
		}

		const hung = { ...memoryStorage(), stat: () => new Promise<never>(() => {}) };
		expect(
			await found(
				options(site(), { timeout: 100, config: { plugins: [{ name: "files", storage: hung }] } }),
				"storage/reachable",
			),
		).toMatchObject({ status: "fail", message: "The storage does not answer: no answer in 0.1 seconds" });
	});

	it("20-8 in a workspace the packages are found above the site's folder, and an admin in a route group is found with its address and the layout over it", async () => {
		const dir = site({
			under: "apps/web",
			files: {
				"app/admin/layout.tsx": null,
				"app/admin/page.tsx": null,
				"app/admin/api/[...path]/route.ts": null,
				"app/(cms)/layout.tsx": "export default function Layout() { return null; }\n",
				"app/(cms)/admin/page.tsx":
					'import { AdminPage } from "@monti-cms/next/admin";\nexport default () => <AdminPage />;\n',
				"app/(cms)/admin/api/[...path]/route.ts": "export const { GET, POST, PUT } = adminRoute(monti);\n",
			},
		});
		const report = await runDoctor(
			options(dir, {
				origin: "https://example.com",
				config: {
					auth: { password: false, github: { clientId: "id", clientSecret: "secret", admin: "someone" } },
				},
			}),
		);
		const by = Object.fromEntries(report.checks.map((check) => [check.id, check]));
		expect(by["site/next"]).toMatchObject({ status: "ok" });
		expect(by["site/packages"]).toMatchObject({ status: "ok" });
		expect(by["site/layout"]).toMatchObject({ status: "ok" });
		expect(by["files/admin"]).toMatchObject({ status: "ok", message: "the admin is at /admin (app/(cms)/admin/)" });
		expect(by["auth/login"]?.message).toContain("https://example.com/admin/api/auth/github");
	});
});
