import { tmpdir } from "node:os";
import path from "node:path";

/** The admin every e2e run makes. */
export const ADMIN = { email: "e2e@example.dev", password: "e2e password" };

/** The test database (`CMS_TEST_DATABASE_URL`). Each server has its own schema in it. */
export function testDatabase(): string {
	const url = process.env.CMS_TEST_DATABASE_URL;
	if (!url) throw new Error("Set CMS_TEST_DATABASE_URL (postgres://localhost/monti_test) to run the e2e tests.");
	return url;
}

/** The address of one schema of the test database, as the example app's `DATABASE_URL`. */
export function databaseOf(schema: string): string {
	const url = new URL(testDatabase());
	url.searchParams.set("options", `-c search_path=${schema}`);
	return url.toString();
}

type Server = {
	port: number;
	schema: string;
	/** `start`: the app built and started, a live site. `dev`: `next dev`, the dev server. */
	mode: "start" | "dev";
	/** The build's folder under the example app: one for each server. */
	dist: string;
	env: Record<string, string>;
};

const server = (port: number, schema: string, mode: Server["mode"], env: Record<string, string> = {}): Server => ({
	port,
	schema,
	mode,
	dist: `.next-e2e-${port}`,
	env: {
		DATABASE_URL: process.env.CMS_TEST_DATABASE_URL ? databaseOf(schema) : "",
		MONTI_SECRET: "e2e secret",
		// Files on real disk, in a folder of this server that each run empties (`prepare.ts`).
		MONTI_FILES: path.join(tmpdir(), `monti-e2e-files-${port}`),
		...env,
	},
});

/**
 * The first of the five ports. `MONTI_E2E_PORT` moves them, and with them the database schemas, so two checkouts on one machine can run their
 * flows at the same time.
 */
const FIRST = Number(process.env.MONTI_E2E_PORT ?? 4173);
if (!Number.isInteger(FIRST) || FIRST < 1024 || FIRST > 65000) throw new Error("MONTI_E2E_PORT is no port.");
const schemaOf = (name: string) => (FIRST === 4173 ? name : `${name}_${FIRST}`);

/**
 * The servers the flows run on (docs/testing.md, L5), all the example app (`examples/blog`): the live site, a live site with no media storage
 * (flow 6·31), and the dev server, for what only the dev server does (getting in without signing in). The live site also posts its events to a
 * webhook (`HOOK`, `hook.ts`), which a test takes down to see a delivery fail (doc 13).
 */
export const SERVERS: Server[] = [
	server(FIRST, schemaOf("monti_site_e2e"), "start", { MONTI_WEBHOOK: `http://localhost:${FIRST + 3}/hook` }),
	server(FIRST + 1, schemaOf("monti_site_e2e_bare"), "start", { MONTI_STORAGE: "off" }),
	server(FIRST + 2, schemaOf("monti_site_e2e_dev"), "dev"),
];

export const LIVE = `http://localhost:${FIRST}`;
export const BARE = `http://localhost:${FIRST + 1}`;
export const DEV = `http://localhost:${FIRST + 2}`;
/** The webhook's other end: its port, and where a test reaches it. */
export const HOOK_PORT = FIRST + 3;
export const HOOK = `http://localhost:${HOOK_PORT}`;
/** The model service the assistant's key is added with (`model.ts`): its port, and the address the key window is given. */
export const MODEL_PORT = FIRST + 4;
export const MODEL = `http://localhost:${MODEL_PORT}/v1`;
