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
 * The servers the flows run on (docs/testing.md, L5), all the example app (`examples/blog`): the live site, a live site with no media storage
 * (flow 6·31), and the dev server, for what only the dev server does (getting in without signing in).
 */
export const SERVERS: Server[] = [
	server(4173, "monti_site_e2e", "start"),
	server(4174, "monti_site_e2e_bare", "start", { MONTI_STORAGE: "off" }),
	server(4175, "monti_site_e2e_dev", "dev"),
];

export const LIVE = "http://localhost:4173";
export const BARE = "http://localhost:4174";
export const DEV = "http://localhost:4175";
