import { writeFileSync } from "node:fs";
import path from "node:path";
import type { Pool } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { closeGlobalPool, createIsolatedTestPool, dropIsolatedTestPool } from "../../testing";
import { dbSetup } from "../db";
import type { DoctorReport } from "../doctor";
import { runCli } from "../index";
import { byId, CORE_SRC, configText, project, SCHEMA_TEXT, setEnv, statusesOf } from "./doctor-helpers";

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

	// Each test gets its own database schema: one test's migrations or rows are not the next test's starting point.
	beforeEach(async () => {
		const isolated = await createIsolatedTestPool();
		pool = isolated.pool;
		schemaName = isolated.schemaName;
	});

	afterEach(async () => {
		await dropIsolatedTestPool(pool, schemaName);
	});

	afterAll(async () => {
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

	it("DOC-R1 passes every check, prints no warning, and exits 0", async () => {
		healthyEnv();
		const dir = project();
		expect(await dbSetup({ cwd: dir, envFiles: [], log: () => undefined, error: () => undefined })).toBe(0);

		const { code, report } = await doctor(dir);
		expect(report.checks.filter((check) => check.status === "fail" || check.status === "warn")).toEqual([]);
		expect(code).toBe(0);
		expect(report.ok).toBe(true);
		expect(statusesOf(report)).toMatchObject({
			"config/file": "ok",
			"config/loads": "ok",
			"config/boundary": "ok",
			"schema/file": "ok",
			"database/url": "ok",
			"database/connect": "ok",
			"database/schema": "ok",
			"database/migrations": "ok",
			"secrets/monti-secret": "ok",
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
			"https://blog.example.com/api/monti/auth/callback/github",
		);
		expect(byId(report, "next/admin-path").message).toContain("/studio");
		expect(byId(report, "auth/admins").message).toContain("github:12345678");
	});

	it("DOC-R2 says a database created by an older pre-release cannot be upgraded, and to recreate it", async () => {
		healthyEnv();
		const dir = project();
		await dbSetup({ cwd: dir, envFiles: [], log: () => undefined, error: () => undefined });
		await pool.query(`INSERT INTO "${schemaName}".cms_migrations (name) VALUES ('0023_entry_changed_by')`);

		const { code, report } = await doctor(dir);
		const migrations = byId(report, "database/migrations");
		expect(code).toBe(1);
		expect(migrations.status).toBe("fail");
		// What is wrong (an older pre-release, no upgrade), where (the schema) and the fix (recreate it).
		expect(migrations.message).toContain("older pre-release");
		expect(migrations.message).toContain("cannot be upgraded");
		expect(migrations.fix).toContain("recreate");
		expect(migrations.where).toContain(schemaName);
		// The rest of the setup is still reported: one broken part does not hide the others.
		expect(byId(report, "database/connect").status).toBe("ok");
		expect(byId(report, "config/loads").status).toBe("ok");
	});

	it("DOC-R2 says all migrations are pending, and that the schema is not there yet, for a database nobody migrated", async () => {
		healthyEnv({ DATABASE_SCHEMA: `${schemaName}_none` });
		const { report } = await doctor(project());
		expect(byId(report, "database/schema")).toMatchObject({ status: "warn" });
		expect(byId(report, "database/schema").fix).toContain("monti db:setup");
		const migrations = byId(report, "database/migrations");
		expect(migrations.status).toBe("fail");
		expect(migrations.message).toMatch(/no migration has run: all \d+ are pending/);
		// Nothing is set up, so the fix is the first-time command, not the update one.
		expect(migrations.fix).toContain("monti db:setup");
		expect(migrations.fix).not.toContain("db:migrate");
	});
});

describe("monti doctor on a project with missing settings", () => {
	it("DOC-R1 fails with what, where and how to fix for every missing value, and exits 1", async () => {
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

	it("DOC-R3 runs no GitHub checks for a site whose login has no GitHub provider", async () => {
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

	it("DOC-R3 is stricter about the login when it runs as production", async () => {
		setEnv({ NODE_ENV: "production" });
		const { report } = await doctor(project());
		expect(byId(report, "auth/github-id").status).toBe("fail");
		expect(byId(report, "auth/admins").status).toBe("fail");
		expect(byId(report, "auth/site-url").status).toBe("warn");
		expect(byId(report, "auth/site-url").fix).toContain("SITE_URL=https://");
		expect(byId(report, "auth/trust-host").status).toBe("warn");
		expect(byId(report, "auth/trust-host").fix).toContain("AUTH_TRUST_HOST=true");
	});

	it("DOC-R3 warns about a config with no login in development, and fails for production or a known platform, with how to add GitHub", async () => {
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
			"/api/monti/auth/callback/github",
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

	it("CLI-P1 explains a database that cannot be reached, without printing the password", async () => {
		setEnv({ DATABASE_URL: "postgres://monti:hunter2@127.0.0.1:1/blog", MONTI_SECRET: STRONG_SECRET });
		const { report } = await doctor(project());
		const connect = byId(report, "database/connect");
		expect(connect.status).toBe("fail");
		expect(connect.message).toContain("127.0.0.1:1/blog");
		expect(connect.fix).toContain("DATABASE_URL");
		expect(JSON.stringify(report)).not.toContain("hunter2");
		expect(byId(report, "database/migrations").status).toBe("skip");
	});

	it("DOC-R2 the database/url check warns about an sslmode the driver warns about, and says what to change", async () => {
		// The modes and the URLs that need no warning are the cases of sslmodeWarning (adapters/postgres connection.test.ts); this is the check that shows it.
		setEnv({ DATABASE_URL: "postgres://u:p@db.example.com:5432/blog?sslmode=require" });
		const { report } = await doctor(project(), ["--only", "database/url"]);
		const url = byId(report, "database/url");
		expect(url.status).toBe("warn");
		expect(url.message).toContain("sslmode=require");
		expect(url.fix).toContain("sslmode=verify-full");
	});

	it("INIT-K5 reports a .gitignore that does not keep .env.local out of git, and says what to add", async () => {
		setEnv();
		const exposed = project({ ".gitignore": "node_modules\n.monti/\n", ".env.local": "MONTI_SECRET=x\n" });
		const check = byId((await doctor(exposed, ["--only", "config/env-ignored"])).report, "config/env-ignored");
		expect(check.status).toBe("warn");
		expect(check.message).toContain(".env.local");
		expect(check.where).toBe(".gitignore");
		expect(check.fix).toContain("`.env.local`");

		const covered = project({ ".gitignore": ".env*\n.monti/\n", ".env.local": "MONTI_SECRET=x\n" });
		expect(byId((await doctor(covered, ["--only", "config/env-ignored"])).report, "config/env-ignored").status).toBe(
			"ok",
		);
	});

	it("CLI-P1 warns about a weak MONTI_SECRET and never prints it", async () => {
		setEnv({ MONTI_SECRET: "changeme" });
		const { report } = await doctor(project());
		const secret = byId(report, "secrets/monti-secret");
		expect(secret.status).toBe("warn");
		expect(secret.fix).toContain("openssl rand");
		expect(JSON.stringify(report)).not.toContain("changeme");
	});

	it("DOC-R4 reports a config that does not load, and skips what needs it", async () => {
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

	it("DOC-R4 reports a missing config file with what to do", async () => {
		setEnv();
		const { report } = await doctor(project({ "monti.config.ts": null }));
		expect(byId(report, "config/file").status).toBe("fail");
		expect(byId(report, "config/file").fix).toContain("monti init");
	});

	it("SCHEMA-F14 names the path of what is wrong in the schema file", async () => {
		setEnv();
		const dir = project();
		writeFileSync(
			path.join(dir, "monti.schema.ts"),
			'export default { collections: { post: { kind: "nope" } }, locales: [], defaultLocale: "en" };\n',
		);
		const { report } = await doctor(dir);
		const schema = byId(report, "schema/file");
		expect(schema.status).toBe("fail");
		expect(schema.message).toContain("collections.post");
		expect(schema.where).toBe("monti.schema.ts");
		expect(schema.fix).toContain("defineSchema");
	});

	it("DOC-R4 reports a schema file that is valid but holds code: the admin cannot rewrite it", async () => {
		setEnv();
		const dir = project();
		writeFileSync(
			path.join(dir, "monti.schema.ts"),
			SCHEMA_TEXT.replace(
				"export default defineSchema({\n",
				"const base = { defaultLocale: 'en' };\nexport default defineSchema({\n\t...base,\n",
			),
		);
		const { report } = await doctor(dir);
		const schema = byId(report, "schema/file");
		expect(schema.status).toBe("ok");
		expect(schema.message).toContain("contains code");
		expect(schema.message).toContain("read-only");
	});

	it("DOC-R4 checks the three Next files and the admin path", async () => {
		setEnv();
		const dir = project({
			"app/studio/layout.tsx": null,
			"app/api/monti/[...path]/route.ts": null,
			"next.config.ts": "export default {};\n",
		});
		const { report } = await doctor(dir);
		const files = byId(report, "next/files");
		expect(files.status).toBe("fail");
		expect(files.message).toContain("admin layout is missing");
		expect(files.message).toContain("API route is missing");
		expect(files.fix).toContain("app/api/monti/[...path]/route.ts");
		expect(byId(report, "next/with-cms").status).toBe("fail");
		expect(byId(report, "next/with-cms").fix).toContain("withCms");
	});

	it("DOC-R4 tells when the admin files sit at a different path than the config says", async () => {
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
		expect(files.fix).toContain('admin: { path: "/admin" }');
	});
});

describe("monti doctor on the media storage", () => {
	const withStorage = (store: string) =>
		configText().replace(
			"database: postgres(),",
			`database: postgres(),\n\tstorage: { createStore: () => { ${store} } },`,
		);

	it("DOC-R4 fails with the variable and the fix when the storage cannot be set up, since public images would silently be gone", async () => {
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

	it("DOC-R4 passes when the store can make public file addresses", async () => {
		setEnv();
		const dir = project({
			"monti.config.ts": withStorage(
				// biome-ignore lint/suspicious/noTemplateCurlyInString: the config source holds a template literal on purpose
				"return { getPublicUrl: (key: string) => `https://files.example.com/${key}` } as never;",
			),
		});
		const { report } = await doctor(dir, ["--only", "config/storage"]);
		expect(byId(report, "config/storage").status).toBe("ok");
	});
});

describe("monti doctor --only", () => {
	it("DOC-R1 runs only the groups and checks it names", async () => {
		setEnv();
		const { report } = await doctor(project(), ["--only", "auth/admins,schema/file"]);
		expect(report.checks.map((check) => check.id).sort()).toEqual(["auth/admins", "schema/file"]);
	});
});

describe("monti doctor --json and the text report", () => {
	it("DOC-R1 prints a stable JSON shape for tools", async () => {
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
});

describe("the email and password login on the command line", () => {
	const AUTH_SRC = path.resolve(CORE_SRC, "../../auth/src");

	/** The healthy project's config, with the built-in email and password login instead of GitHub. */
	const passwordConfig = () =>
		configText()
			.replace(
				`import { github } from ${JSON.stringify(path.join(AUTH_SRC, "github.ts"))};`,
				`import { password } from ${JSON.stringify(path.join(AUTH_SRC, "password.ts"))};`,
			)
			.replace("github()", "password()");

	async function run(
		dir: string,
		argv: string[],
		prompter?: { text: () => Promise<string>; password: () => Promise<string> },
	) {
		const out: string[] = [];
		const code = await runCli([...argv, "--no-env-file"], {
			cwd: dir,
			log: (message) => out.push(message),
			error: (message) => out.push(message),
			...(prompter ? { prompter: prompter as never } : {}),
		});
		return { code, text: out.join("\n") };
	}

	const doctor = async (dir: string) => {
		const { code, text } = await run(dir, ["doctor", "--json"]);
		return { code, report: JSON.parse(text) as DoctorReport };
	};

	/** A project with the password login, and the environment pointing at this test's schema (the helpers reset both after every test). */
	const app = (config = passwordConfig()) => {
		setEnv({
			DATABASE_URL: DATABASE,
			DATABASE_SCHEMA: schemaName,
			MONTI_SECRET: STRONG_SECRET,
			SITE_URL: "https://blog.example.com",
		});
		return project({ "monti.config.ts": config });
	};

	let pool: Pool;
	let schemaName: string;

	beforeAll(async () => {
		const isolated = await createIsolatedTestPool();
		pool = isolated.pool;
		schemaName = isolated.schemaName;
		expect(await dbSetup({ cwd: app(), envFiles: [], log: () => undefined, error: () => undefined })).toBe(0);
	});

	// The login keeps its accounts in the plugin storage of the schema: every test starts with no admin account.
	beforeEach(async () => {
		await pool.query(`DELETE FROM "${schemaName}".plugin_documents`);
	});

	afterAll(async () => {
		if (pool && schemaName) await dropIsolatedTestPool(pool, schemaName);
		await closeGlobalPool();
	});

	it("AUTH-L12 doctor warns that there is no admin yet and says to open the admin, and runs no GitHub checks", async () => {
		const dir = app();
		const { report } = await doctor(dir);
		const accounts = byId(report, "auth/admin-accounts");
		expect(accounts.status).toBe("warn");
		expect(accounts.fix).toContain("create the first admin");
		expect(accounts.fix).toContain("https://blog.example.com/studio");
		expect(accounts.fix?.length).toBeLessThan(200);
		for (const id of ["auth/github-id", "auth/github-secret", "auth/admins", "auth/callback-url"]) {
			expect(byId(report, id).status, id).toBe("skip");
		}
	});
});
