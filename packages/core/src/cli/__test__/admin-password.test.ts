import path from "node:path";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { closeGlobalPool, createIsolatedTestPool, dropIsolatedTestPool } from "../../testing";
import { importCms } from "../app";
import type { DoctorReport } from "../doctor";
import { runCli } from "../index";
import { migrate } from "../migrate";
import { byId, CORE_SRC, configText, project, setEnv } from "./doctor-helpers";

const DATABASE = (process.env.CMS_TEST_DATABASE_URL ?? "").replace(
	/sslmode=(require|prefer|verify-ca)/,
	"sslmode=verify-full",
);
const STRONG_SECRET = "h8Kq2vXw9RtZbN4mYcLs7PdFgJe3UaQo6WiTnV5xBzE=";
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
	adminPrompts?: { text: () => Promise<string>; password: () => Promise<string> },
) {
	const out: string[] = [];
	const code = await runCli([...argv, "--no-env-file"], {
		cwd: dir,
		log: (message) => out.push(message),
		error: (message) => out.push(message),
		...(adminPrompts ? { adminPrompts } : {}),
	});
	return { code, text: out.join("\n") };
}

const doctor = async (dir: string) => {
	const { code, text } = await run(dir, ["doctor", "--json"]);
	return { code, report: JSON.parse(text) as DoctorReport };
};

/** Answers for the password questions in order. */
const answers = (...passwords: string[]) => ({
	text: async () => "unused@example.com",
	password: async () => passwords.shift() ?? "",
});

describe("the email and password login on the command line", () => {
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
		expect(await migrate({ cwd: app(), envFiles: [], log: () => undefined })).toBe(true);
	});

	afterAll(async () => {
		if (pool && schemaName) await dropIsolatedTestPool(pool, schemaName);
		await closeGlobalPool();
	});

	it("doctor warns that there is no admin yet and says to open the admin, and runs no GitHub checks", async () => {
		const dir = app();
		const { report } = await doctor(dir);
		const accounts = byId(report, "auth/admin-accounts");
		expect(accounts.status).toBe("warn");
		expect(accounts.fix).toContain("create the first admin");
		expect(accounts.fix).toContain("https://blog.example.com/studio");
		for (const id of ["auth/github-id", "auth/github-secret", "auth/admins", "auth/callback-url"]) {
			expect(byId(report, id).status, id).toBe("skip");
		}
	});

	it("reset-password refuses an email without an account and changes nothing", async () => {
		const dir = app();
		const { code, text } = await run(
			dir,
			["admin:reset-password", "--email", "mina@example.com"],
			answers("a new password!", "a new password!"),
		);
		expect(code).toBe(1);
		expect(text).toContain("no admin account has that email");
	});

	it("doctor is satisfied once an admin exists, and reset-password then replaces the password", async () => {
		const dir = app();
		const cms = await importCms(dir, "monti.config.ts");
		const accounts = cms.auth().accounts;
		if (!accounts) throw new Error("expected accounts");
		expect(await accounts.createFirst({ email: "mina@example.com", password: "first password!" })).toEqual({
			ok: true,
		});
		expect(byId((await doctor(dir)).report, "auth/admin-accounts").status).toBe("ok");

		const signIn = async (secret: string) => {
			const response = (await cms.auth().signIn("password", {
				redirectTo: "/studio",
				request: new Request("https://blog.example.com/api/cms/v1/session/sign-in/password", {
					method: "POST",
					headers: { host: "blog.example.com" },
				}),
				credentials: { email: "mina@example.com", password: secret },
			})) as Response;
			return !response.headers.get("location")?.includes("error=");
		};
		expect(await signIn("first password!")).toBe(true);

		const reset = await run(
			dir,
			["admin:reset-password", "--email", "MINA@example.com"],
			answers("second password!", "second password!"),
		);
		expect(reset.code).toBe(0);
		expect(reset.text).toContain("Password changed for MINA@example.com");
		expect(await signIn("first password!")).toBe(false);
		expect(await signIn("second password!")).toBe(true);
	});

	it("reset-password asks for the email when --email is not given, and does not change anything when the two passwords differ", async () => {
		const dir = app();
		const prompts = {
			text: async () => "mina@example.com",
			password: (() => {
				const queue = ["one password!", "another password"];
				return async () => queue.shift() ?? "";
			})(),
		};
		const { code, text } = await run(dir, ["admin:reset-password"], prompts);
		expect(code).toBe(1);
		expect(text).toContain("not the same");
	});

	it("reset-password refuses a short password", async () => {
		const dir = app();
		const { code, text } = await run(
			dir,
			["admin:reset-password", "--email", "mina@example.com"],
			answers("short", "short"),
		);
		expect(code).toBe(1);
		expect(text).toContain("at least 10 characters");
	});

	it("reset-password says what to do on a site whose login keeps no accounts", async () => {
		const github = app(configText());
		vi.stubEnv("AUTH_GITHUB_ID", "id");
		vi.stubEnv("AUTH_GITHUB_SECRET", "secret");
		const { code, text } = await run(
			github,
			["admin:reset-password", "--email", "mina@example.com"],
			answers("x", "x"),
		);
		expect(code).toBe(1);
		expect(text).toContain("password()");
	});
});
