import { writeFileSync } from "node:fs";
import path from "node:path";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeGlobalPool, createIsolatedTestPool, dropIsolatedTestPool } from "../../testing";
import { type DoctorReport, runDoctor } from "../doctor";
import { runCli } from "../index";
import { migrate } from "../migrate";
import { byId, configText, project, setEnv, statusesOf } from "./doctor-helpers";

// The pg driver warns about sslmode=require; verify-full is what it means today, so the healthy project has no warning.
const DATABASE = (process.env.CMS_TEST_DATABASE_URL ?? "").replace(
	/sslmode=(require|prefer|verify-ca)/,
	"sslmode=verify-full",
);
const STRONG_SECRET = "h8Kq2vXw9RtZbN4mYcLs7PdFgJe3UaQo6WiTnV5xBzE=";

/** An app folder and the output of `monti doctor --json` in it. */
async function doctor(dir: string, args: readonly string[] = []) {
	const out: string[] = [];
	const code = await runCli(["doctor", "--json", "--no-env-file", ...args], {
		cwd: dir,
		log: (message) => out.push(message),
		error: (message) => out.push(message),
	});
	return { code, report: JSON.parse(out.join("\n")) as DoctorReport };
}

describe("monti doctor on a healthy project", () => {
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

	const healthyEnv = (extra: Record<string, string> = {}) =>
		setEnv({
			DATABASE_URL: DATABASE,
			DATABASE_SCHEMA: schemaName,
			MONTI_SECRET: STRONG_SECRET,
			AUTH_GITHUB_ID: "Iv1.abc",
			AUTH_GITHUB_SECRET: "shh",
			MONTI_ADMIN_GITHUB_ID: "12345678",
			SITE_URL: "https://blog.example.com",
			...extra,
		});

	it("passes every check, prints no warning, and exits 0", async () => {
		healthyEnv();
		const dir = project();
		expect(await migrate({ cwd: dir, envFiles: [], log: () => undefined })).toBe(true);

		const { code, report } = await doctor(dir);
		expect(report.checks.filter((check) => check.status === "fail" || check.status === "warn")).toEqual([]);
		expect(code).toBe(0);
		expect(report.ok).toBe(true);
		expect(statusesOf(report)).toMatchObject({
			"config/file": "ok",
			"config/loads": "ok",
			"config/boundary": "ok",
			"schema/file": "ok",
			"schema/types": "ok",
			"database/url": "ok",
			"database/connect": "ok",
			"database/schema": "ok",
			"database/migrations": "ok",
			"secrets/monti-secret": "ok",
			"secrets/old-secrets": "ok",
			"auth/github-id": "ok",
			"auth/github-secret": "ok",
			"auth/admins": "ok",
			"auth/site-url": "ok",
			"auth/trust-host": "ok",
			"auth/callback-url": "ok",
			"next/files": "ok",
			"next/with-cms": "ok",
			"next/admin-path": "ok",
		});
		expect(byId(report, "auth/callback-url").message).toContain(
			"https://blog.example.com/api/cms/auth/callback/github",
		);
		expect(byId(report, "next/admin-path").message).toContain("/studio");
		expect(byId(report, "auth/admins").message).toContain("github:12345678");
	});

	it("reads the pending migrations: how many, and what to run", async () => {
		healthyEnv();
		const dir = project();
		await migrate({ cwd: dir, envFiles: [], log: () => undefined });
		const applied = await pool.query<{ name: string }>(
			`SELECT name FROM "${schemaName}".cms_migrations WHERE name ~ '^[0-9]{4}_' ORDER BY name DESC LIMIT 2`,
		);
		await pool.query(`DELETE FROM "${schemaName}".cms_migrations WHERE name = ANY($1)`, [
			applied.rows.map((row) => row.name),
		]);

		const { code, report } = await doctor(dir);
		const migrations = byId(report, "database/migrations");
		expect(code).toBe(1);
		expect(migrations.status).toBe("fail");
		expect(migrations.message).toMatch(/^2 of \d+ migrations are pending/);
		expect(migrations.message).toContain(applied.rows[0]?.name);
		expect(migrations.fix).toContain("monti migrate");
		expect(migrations.where).toContain(schemaName);
		// The rest of the setup is still reported: one broken part does not hide the others.
		expect(byId(report, "database/connect").status).toBe("ok");
		expect(byId(report, "config/loads").status).toBe("ok");
	});

	it("says all migrations are pending, and that the schema is not there yet, for a database nobody migrated", async () => {
		healthyEnv({ DATABASE_SCHEMA: `${schemaName}_none` });
		const { report } = await doctor(project());
		expect(byId(report, "database/schema")).toMatchObject({ status: "warn" });
		expect(byId(report, "database/schema").fix).toContain("monti migrate");
		const migrations = byId(report, "database/migrations");
		expect(migrations.status).toBe("fail");
		expect(migrations.message).toMatch(/no migration has run: all \d+ are pending/);
	});
});

describe("monti doctor on a project with missing settings", () => {
	it("fails with what, where and how to fix for every missing value, and exits 1", async () => {
		setEnv();
		const { code, report } = await doctor(project());
		expect(code).toBe(1);
		expect(report.ok).toBe(false);

		const url = byId(report, "database/url");
		expect(url.status).toBe("fail");
		expect(url.message).toContain("DATABASE_URL");
		expect(url.where).toContain(".env.local");
		expect(url.fix).toContain("postgres://");
		// Nothing to connect with: the next checks say so instead of failing again.
		expect(byId(report, "database/connect").status).toBe("skip");
		expect(byId(report, "database/migrations").status).toBe("skip");

		const secret = byId(report, "secrets/monti-secret");
		expect(secret.status).toBe("fail");
		expect(secret.message).toContain("MONTI_SECRET");
		expect(secret.fix).toContain("openssl rand -base64 32");

		// Without GitHub values or an admin the login is only a warning on a development machine (`next dev` signs you in), a failure in production.
		expect(byId(report, "auth/github-id")).toMatchObject({ status: "warn" });
		expect(byId(report, "auth/github-id").message).toContain("AUTH_GITHUB_ID");
		expect(byId(report, "auth/github-secret").message).toContain("AUTH_GITHUB_SECRET");
		const admins = byId(report, "auth/admins");
		expect(admins.status).toBe("warn");
		expect(admins.fix).toContain("MONTI_ADMIN_GITHUB_ID");
		expect(admins.fix).toContain("api.github.com/users");
	});

	it("runs no GitHub checks for a site whose login has no GitHub provider", async () => {
		setEnv({ MONTI_SECRET: STRONG_SECRET });
		const other =
			'{ id: "gitlab", name: "GitLab", label: { en: "Sign in with GitLab" }, setup: () => ({ id: "gitlab", type: "oauth" }), account: () => null }';
		const config = configText().replace("github()", other);
		const { report } = await doctor(project({ "monti.config.ts": config }));
		for (const id of ["auth/github-id", "auth/github-secret", "auth/admins"]) {
			expect(byId(report, id).status, id).toBe("skip");
		}
		expect(byId(report, "auth/github-id").message).toContain("no GitHub provider");
	});

	it("is stricter about the login when it runs as production", async () => {
		setEnv({ NODE_ENV: "production" });
		const { report } = await doctor(project());
		expect(byId(report, "auth/github-id").status).toBe("fail");
		expect(byId(report, "auth/admins").status).toBe("fail");
		expect(byId(report, "auth/site-url").status).toBe("warn");
		expect(byId(report, "auth/site-url").fix).toContain("SITE_URL=https://");
		expect(byId(report, "auth/trust-host").status).toBe("warn");
		expect(byId(report, "auth/trust-host").fix).toContain("AUTH_TRUST_HOST=true");
	});

	it("warns about a config with no login in development, and fails for production or a known platform, with how to add GitHub", async () => {
		const noAuth = configText().replace("\tauth: auth({ providers: [github()] }),\n", "");
		expect(noAuth).not.toContain("auth: ");
		setEnv({ MONTI_SECRET: STRONG_SECRET });
		const dev = byId((await doctor(project({ "monti.config.ts": noAuth }))).report, "auth/login");
		expect(dev.status).toBe("warn");
		for (const text of [
			"@monti-cms/auth",
			"auth: auth({ providers: [github()] })",
			"AUTH_GITHUB_ID",
			"AUTH_GITHUB_SECRET",
			"MONTI_ADMIN_GITHUB_ID",
			"/api/cms/auth/callback/github",
		]) {
			expect(dev.fix, text).toContain(text);
		}

		setEnv({ NODE_ENV: "production", MONTI_SECRET: STRONG_SECRET });
		const { report, code } = await doctor(project({ "monti.config.ts": noAuth }));
		expect(byId(report, "auth/login").status).toBe("fail");
		expect(code).toBe(1);
		// The GitHub checks have nothing to say about a site that never chose GitHub.
		for (const id of ["auth/github-id", "auth/github-secret", "auth/admins", "auth/callback-url"]) {
			expect(byId(report, id).status, id).toBe("skip");
		}

		setEnv({ VERCEL: "1", MONTI_SECRET: STRONG_SECRET });
		expect(byId((await doctor(project({ "monti.config.ts": noAuth }))).report, "auth/login").status).toBe("fail");
	});

	it("explains a database that cannot be reached, without printing the password", async () => {
		setEnv({ DATABASE_URL: "postgres://monti:hunter2@127.0.0.1:1/blog", MONTI_SECRET: STRONG_SECRET });
		const { report } = await doctor(project());
		const connect = byId(report, "database/connect");
		expect(connect.status).toBe("fail");
		expect(connect.message).toContain("127.0.0.1:1/blog");
		expect(connect.fix).toContain("DATABASE_URL");
		expect(JSON.stringify(report)).not.toContain("hunter2");
		expect(byId(report, "database/migrations").status).toBe("skip");
	});

	it("rejects a DATABASE_URL that is not a Postgres URL", async () => {
		setEnv({ DATABASE_URL: "mysql://root@localhost/blog" });
		const { report } = await doctor(project());
		expect(byId(report, "database/url").status).toBe("fail");
		expect(byId(report, "database/url").message).toContain("postgres://");
	});

	it("warns about sslmode=require|prefer|verify-ca without uselibpqcompat, and says what to change", async () => {
		for (const mode of ["require", "prefer", "verify-ca"]) {
			setEnv({ DATABASE_URL: `postgres://u:p@db.example.com:5432/blog?sslmode=${mode}` });
			const { report } = await doctor(project());
			const url = byId(report, "database/url");
			expect(url.status).toBe("warn");
			expect(url.message).toContain("SECURITY WARNING");
			expect(url.fix).toContain("sslmode=verify-full");
		}
		for (const query of ["sslmode=verify-full", "sslmode=require&uselibpqcompat=true", ""]) {
			setEnv({ DATABASE_URL: `postgres://u:p@db.example.com:5432/blog${query ? `?${query}` : ""}` });
			const { report } = await doctor(project());
			expect(byId(report, "database/url").status).toBe("ok");
		}
	});

	it("lists what Monti decided on its own as Topic: value [source], one line each", async () => {
		setEnv({ DATABASE_URL: "postgres://u:p@localhost:5432/monti", MONTI_SECRET: STRONG_SECRET });
		const { report } = await doctor(project());
		const automatic = byId(report, "config/automatic");
		expect(automatic.status).toBe("ok");
		const lines = automatic.message.split("\n");
		expect(lines.length).toBeGreaterThan(0);
		for (const line of lines) expect(line).toMatch(/^[^:]+: .+ \[.+\]$/);
		const database = lines.find((line) => line.startsWith("Database:"));
		expect(database).toContain("localhost:5432/monti");
		expect(database).toContain("from env DATABASE_URL");
		expect(automatic.message).not.toContain("u:p");
	});

	it("warns about a weak MONTI_SECRET and never prints it", async () => {
		setEnv({ MONTI_SECRET: "changeme" });
		const { report } = await doctor(project());
		const secret = byId(report, "secrets/monti-secret");
		expect(secret.status).toBe("warn");
		expect(secret.fix).toContain("openssl rand");
		expect(JSON.stringify(report)).not.toContain("changeme");
	});

	it("reports a config that does not load, and skips what needs it", async () => {
		setEnv();
		const dir = project({ "monti.config.ts": 'import "this-package-does-not-exist";\nexport const cms = {};\n' });
		const { code, report } = await doctor(dir);
		expect(code).toBe(1);
		const loads = byId(report, "config/loads");
		expect(loads.status).toBe("fail");
		expect(loads.message).toContain("this-package-does-not-exist");
		expect(loads.where).toBe("monti.config.ts");
		expect(loads.fix).toContain("this-package-does-not-exist");
		expect(byId(report, "database/url").status).toBe("skip");
		// The file checks still run.
		expect(byId(report, "schema/file").status).toBe("ok");
	});

	it("reports a missing config file with what to do", async () => {
		setEnv();
		const { report } = await doctor(project({ "monti.config.ts": null }));
		expect(byId(report, "config/file").status).toBe("fail");
		expect(byId(report, "config/file").fix).toContain("monti init");
	});

	it("names the JSON path of what is wrong in the schema file", async () => {
		setEnv();
		const dir = project();
		writeFileSync(path.join(dir, "monti.schema.json"), '{ "collections": { "post": { "kind": "nope" } } }');
		const { report } = await doctor(dir);
		const schema = byId(report, "schema/file");
		expect(schema.status).toBe("fail");
		expect(schema.message).toContain("collections.post");
		expect(schema.where).toBe("monti.schema.json");
		expect(schema.fix).toContain("$schema");
		expect(byId(report, "schema/types").status).toBe("skip");
	});

	it("warns when the generated types are stale", async () => {
		setEnv();
		const dir = project();
		writeFileSync(path.join(dir, "monti-env.d.ts"), "// stale\n");
		const { report } = await doctor(dir);
		const types = byId(report, "schema/types");
		expect(types.status).toBe("warn");
		expect(types.fix).toContain("monti schema:types");
	});

	it("checks the three Next files and the admin path", async () => {
		setEnv();
		const dir = project({
			"app/studio/layout.tsx": null,
			"app/api/cms/[...path]/route.ts": null,
			"next.config.ts": "export default {};\n",
		});
		const { report } = await doctor(dir);
		const files = byId(report, "next/files");
		expect(files.status).toBe("fail");
		expect(files.message).toContain("admin layout is missing");
		expect(files.message).toContain("API route is missing");
		expect(files.fix).toContain("app/api/cms/[...path]/route.ts");
		expect(byId(report, "next/with-cms").status).toBe("fail");
		expect(byId(report, "next/with-cms").fix).toContain("withCms");
	});

	it("warns about a root layout without suppressHydrationWarning, and is quiet once it has it", async () => {
		setEnv();
		const dir = project({ "app/layout.tsx": '<html lang="en"><body /></html>\n' });
		const { report } = await doctor(dir);
		const hydration = byId(report, "next/hydration");
		expect(hydration.status).toBe("warn");
		expect(hydration.fix).toContain("suppressHydrationWarning");
		expect(report.checks.some((check) => check.id === "next/theme-styles")).toBe(false);

		const fixed = project({ "app/layout.tsx": '<html lang="en" suppressHydrationWarning><body /></html>\n' });
		const again = await doctor(fixed);
		expect(byId(again.report, "next/hydration").status).toBe("ok");
	});

	it("tells when the admin files sit at a different path than the config says", async () => {
		setEnv();
		const dir = project({
			"app/studio/layout.tsx": null,
			"app/studio/[[...path]]/page.tsx": null,
			"app/admin/layout.tsx": "export default function L() { return <CmsAdminLayout cms={cms} />; }\n",
			"app/admin/[[...path]]/page.tsx": "export default function P() { return <CmsAdminPage cms={cms} />; }\n",
		});
		const { report } = await doctor(dir);
		const files = byId(report, "next/files");
		expect(files.status).toBe("fail");
		expect(files.fix).toContain("serves /admin");
		expect(files.fix).toContain('"path": "/admin"');
	});
});

describe("monti doctor on a project that still has the old setup", () => {
	it("gives the exact steps for the old config files, env names, route group, and options", async () => {
		setEnv({
			CMS_DATABASE_URL: "postgres://old",
			HOST_URL: "https://old.example.com",
			CMS_SECRET: STRONG_SECRET,
			AUTH_SECRET: "x",
		});
		const dir = project({
			"cms.config.ts": "export default {};\n",
			"cms.server.ts": "export const cms = {};\n",
			"lib/posts.ts": 'import { cms } from "@/cms.server";\nexport const read = () => cms;\n',
			"monti.config.ts": `${configText()}\nconst legacy = process.env.CMS_DATABASE_URL;\nconst nextHost = undefined;\nconst host = nextHost;\n`,
			"app/studio/layout.tsx": null,
			"app/studio/[[...path]]/page.tsx": null,
			"app/(admin)/studio/layout.tsx": "export default function L() { return <CmsAdminLayout cms={cms} />; }\n",
			"app/(admin)/studio/[[...path]]/page.tsx": "export default function P() { return <CmsAdminPage cms={cms} />; }\n",
		});
		writeFileSync(path.join(dir, ".env.local"), "CMS_DATABASE_URL=postgres://old\nHOST_URL=https://old.example.com\n");

		const report = await runDoctor({ cwd: dir, env: process.env });

		const files = byId(report, "upgrade/config-files");
		expect(files.status).toBe("warn");
		expect(files.message).toContain("cms.config.ts and cms.server.ts");
		expect(files.fix).toContain("one `export const cms = defineConfig");
		expect(files.fix).toContain("Delete cms.config.ts and cms.server.ts");
		expect(files.fix).toContain("lib/posts.ts");

		const env = byId(report, "upgrade/env");
		expect(env.status).toBe("warn");
		expect(env.where).toContain(".env.local");
		expect(env.fix).toContain("rename CMS_DATABASE_URL to DATABASE_URL");
		expect(env.fix).toContain("rename HOST_URL to SITE_URL");
		expect(env.fix).toContain("environment settings of your host");

		const secrets = byId(report, "secrets/old-secrets");
		expect(secrets.status).toBe("warn");
		expect(secrets.fix).toContain("CMS_SECRET: rename it to MONTI_SECRET, keeping the same value");
		expect(secrets.fix).toContain("AUTH_SECRET: delete it");

		const groups = byId(report, "upgrade/route-groups");
		expect(groups.status).toBe("warn");
		expect(groups.fix).toContain('git mv "app/(admin)/studio" "app/studio"');
		// The files are still found through the group, so the Next files check passes.
		expect(byId(report, "next/files").status).toBe("ok");

		const text = byId(report, "upgrade/config-text");
		expect(text.status).toBe("warn");
		expect(text.fix).toContain("host");
		expect(text.fix).toContain("DATABASE_URL");
	});

	it("is quiet about the secret that previousSecrets still reads", async () => {
		setEnv({ CMS_SECRET: STRONG_SECRET, MONTI_SECRET: STRONG_SECRET });
		const dir = project({
			"monti.config.ts": `${configText()}\n// previousSecrets: [process.env.CMS_SECRET]\nexport const previous = [process.env.CMS_SECRET];\n`,
		});
		const { report } = await doctor(dir);
		expect(byId(report, "secrets/old-secrets").status).toBe("ok");
	});
});

describe("monti doctor on the media storage", () => {
	const withStorage = (store: string) =>
		configText().replace(
			"database: postgres(),",
			`database: postgres(),\n\tstorage: { createStore: () => { ${store} } },`,
		);

	it("says uploads are off when the config has no storage", async () => {
		setEnv();
		const { report } = await doctor(project());
		expect(byId(report, "config/storage")).toMatchObject({ status: "ok" });
		expect(byId(report, "config/storage").message).toContain("no `storage`");
	});

	it("fails with the variable and the fix when the storage cannot be set up, since public images would silently be gone", async () => {
		setEnv();
		const dir = project({
			"monti.config.ts": withStorage(
				"throw Object.assign(new Error('S3_BUCKET is not set'), { problem: { what: 'S3_BUCKET is not set', where: '.env.local', fix: 'set S3_BUCKET' } });",
			),
		});
		const { code, report } = await doctor(dir, ["--only", "config/storage"]);
		const storage = byId(report, "config/storage");
		expect(storage.status).toBe("fail");
		expect(storage.message).toBe("S3_BUCKET is not set");
		expect(storage.where).toBe(".env.local");
		expect(storage.fix).toContain("set S3_BUCKET");
		expect(storage.fix).toContain("unavailable");
		expect(code).toBe(1);
	});

	it("passes when the store can make public file addresses", async () => {
		setEnv();
		const dir = project({
			"monti.config.ts": withStorage(
				"return { getPublicUrl: (key: string) => `https://files.example.com/${key}` } as never;",
			),
		});
		const { report } = await doctor(dir, ["--only", "config/storage"]);
		expect(byId(report, "config/storage").status).toBe("ok");
	});
});

describe("monti doctor --only", () => {
	it("runs only the groups and checks it names", async () => {
		setEnv();
		const { report } = await doctor(project(), ["--only", "auth/admins,schema/file"]);
		expect(report.checks.map((check) => check.id).sort()).toEqual(["auth/admins", "schema/file"]);
	});

	it("lists only the core groups, in order", async () => {
		setEnv();
		const { report } = await doctor(project());
		const groups = [...new Set(report.checks.map((check) => check.group))];
		expect(groups).toEqual(["config", "schema", "database", "secrets", "auth", "next", "upgrade"]);
	});
});

describe("monti doctor --json and the text report", () => {
	it("prints a stable JSON shape for tools", async () => {
		setEnv();
		const { report } = await doctor(project());
		expect(Object.keys(report).sort()).toEqual(["checks", "cwd", "ok", "summary"]);
		expect(report.summary).toEqual({
			ok: expect.any(Number),
			warn: expect.any(Number),
			fail: expect.any(Number),
			skip: expect.any(Number),
		});
		expect(report.summary.ok + report.summary.warn + report.summary.fail + report.summary.skip).toBe(
			report.checks.length,
		);
		for (const check of report.checks) {
			expect(check).toMatchObject({
				id: expect.stringMatching(/^[a-z-]+\/[a-z-]+$/),
				group: expect.any(String),
				title: expect.any(String),
				status: expect.stringMatching(/^(ok|warn|fail|skip)$/),
				message: expect.any(String),
			});
			expect(check.id.startsWith(`${check.group}/`)).toBe(true);
			// where and fix only come with a warning or a failure.
			if (check.status === "ok" || check.status === "skip") expect(check.fix).toBeUndefined();
			if (check.status === "fail") expect(check.fix).toEqual(expect.any(String));
		}
	});

	it("prints readable text without --json: each check on its own line, a fix under a warning or a failure", async () => {
		setEnv();
		const out: string[] = [];
		const code = await runCli(["doctor", "--no-env-file"], {
			cwd: project(),
			log: (m) => out.push(m),
			error: (m) => out.push(m),
		});
		const text = out.join("\n");
		expect(code).toBe(1);
		expect(text).toMatch(/FAIL\s+database\/url\s+DATABASE_URL is not set/);
		expect(text).toMatch(/\n\s+where: .*\.env\.local/);
		expect(text).toMatch(/\n\s+fix: +put your Postgres URL/);
		expect(text).toMatch(/ok\s+config\/loads/);
		expect(text).toContain("Fix the failed checks (marked FAIL) first");
	});

	it("is in the help", async () => {
		const out: string[] = [];
		await runCli(["help"], { cwd: "/", log: (m) => out.push(m), error: (m) => out.push(m) });
		expect(out.join("\n")).toContain("doctor");
		expect(out.join("\n")).not.toContain("check:boundary");
	});
});
