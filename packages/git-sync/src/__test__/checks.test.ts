import type { CheckOutcome, DoctorCheck } from "@monti-cms/core";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import gitSyncServer from "../server";
import { saveSettings } from "../settings";
import { closeGlobalPool, createHarness, DEFAULT_TARGET, type Harness } from "./harness";

/** The checks of git-sync, run the way `monti doctor` runs them: against a real instance and a GitHub in memory. */

let harness: Harness | undefined;
afterEach(async () => {
	await harness?.close();
	harness = undefined;
});
afterAll(async () => {
	await closeGlobalPool();
});

const checks = gitSyncServer.checks as readonly DoctorCheck[];

const run = (
	h: Harness,
	id: string,
	options: { online?: boolean; env?: Record<string, string | undefined> } = {},
): Promise<CheckOutcome> => {
	const check = checks.find((item) => item.id === id);
	if (!check) throw new Error(`no check ${id}`);
	return Promise.resolve(
		check.run({ cms: h.cms, cwd: "/app", env: options.env ?? {}, online: options.online ?? false }),
	);
};

describe("git-sync checks for monti doctor", () => {
	it("is a list of named checks, and the repo one needs the network", () => {
		expect(checks.map((check) => check.id)).toEqual(["targets", "format", "token", "webhook-secret", "repo"]);
		expect(checks.filter((check) => check.online).map((check) => check.id)).toEqual(["repo"]);
	});

	it("passes when a token and a webhook secret are saved and the repo answers", async () => {
		harness = await createHarness();
		expect(await run(harness, "targets")).toMatchObject({
			status: "ok",
			message: expect.stringContaining("acme/site@main/content"),
		});
		expect((await run(harness, "format")).status).toBe("ok");
		const token = await run(harness, "token");
		expect(token.status).toBe("ok");
		// The token is never printed, only its last four characters.
		expect(token.message).toContain("1234");
		expect(token.message).not.toContain("ghp_test_token");
		const webhook = await run(harness, "webhook-secret", { env: { SITE_URL: "https://blog.example.com/" } });
		expect(webhook.status).toBe("ok");
		expect(webhook.message).toContain("https://blog.example.com/api/cms/v1/git-sync/webhook");
		expect(await run(harness, "repo", { online: true })).toMatchObject({
			status: "ok",
			message: expect.stringContaining("acme/site@main"),
		});
	});

	it("warns, with where and how, when no target is listed", async () => {
		harness = await createHarness({ targets: [] });
		const targets = await run(harness, "targets");
		expect(targets.status).toBe("warn");
		expect(targets.where).toContain("targets");
		expect(targets.fix).toContain("gitSync({ targets");
		expect((await run(harness, "repo", { online: true })).status).toBe("skip");
	});

	it("warns about a missing token and a missing webhook secret, naming the screen and the webhook address", async () => {
		harness = await createHarness({ noSettings: true });
		const token = await run(harness, "token");
		expect(token.status).toBe("warn");
		expect(token.where).toContain("/git-sync");
		expect(token.fix).toContain("Contents: read and write");
		const webhook = await run(harness, "webhook-secret", { env: { SITE_URL: "https://blog.example.com" } });
		expect(webhook.status).toBe("warn");
		expect(webhook.fix).toContain("https://blog.example.com/api/cms/v1/git-sync/webhook");
		expect(webhook.fix).toContain("application/json");
		// Without a token the repo check does not guess.
		expect((await run(harness, "repo", { online: true })).status).toBe("skip");
	});

	it("fails when there is no MONTI_SECRET to keep a token with", async () => {
		harness = await createHarness({ noSecret: true });
		const token = await run(harness, "token");
		expect(token.status).toBe("fail");
		expect(token.message).toContain("MONTI_SECRET");
		expect(token.fix).toContain("openssl rand");
	});

	it("fails when a target writes a format no plugin provides", async () => {
		harness = await createHarness({ targets: [{ ...DEFAULT_TARGET, format: "yaml-front" }] });
		const format = await run(harness, "format");
		expect(format.status).toBe("fail");
		expect(format.message).toContain('"yaml-front"');
		expect(format.fix).toContain("mdx() from @monti-cms/mdx");
	});

	it("tells a rejected token from a repo it cannot see", async () => {
		harness = await createHarness();
		harness.github.failNext("getRepo", { status: 401, message: "Bad credentials" });
		const rejected = await run(harness, "repo", { online: true });
		expect(rejected.status).toBe("fail");
		expect(rejected.message).toContain("rejected the token");
		expect(rejected.fix).toContain("Git sync screen");

		harness.github.failNext("getRepo", { status: 404, message: "Not Found" });
		const hidden = await run(harness, "repo", { online: true });
		expect(hidden.message).toContain("acme/site");
		expect(hidden.fix).toContain("access to that repo");
	});

	it("names a branch that does not exist", async () => {
		harness = await createHarness({ targets: [{ ...DEFAULT_TARGET, branch: "release" }] });
		const branch = await run(harness, "repo", { online: true });
		expect(branch.status).toBe("fail");
		expect(branch.message).toContain('"release" does not exist');
		expect(branch.fix).toContain("branch");
	});
});

describe("git-sync errors say what, where and how to fix", () => {
	it("a missing token is a setup state that points at the Git sync screen", async () => {
		harness = await createHarness({ noSettings: true });
		const message = await harness.ctx.client(harness.target).then(
			() => "",
			(error: Error) => error.message,
		);
		expect(message).toContain("No GitHub token is saved");
		expect(message).toMatch(/Where: .*\/git-sync/);
		expect(message).toContain("Fix:");
	});

	it("saving a token without MONTI_SECRET names the variable and how to make one", async () => {
		harness = await createHarness({ noSecret: true });
		await expect(saveSettings(harness.ctx, { token: "x", expectedVersion: 0 })).rejects.toThrow(
			/MONTI_SECRET.*Where:.*Fix:.*openssl rand/s,
		);
	});

	it("a target whose format no plugin provides says which plugin to add", async () => {
		harness = await createHarness({ targets: [{ ...DEFAULT_TARGET, format: "yaml-front" }] });
		const message = await harness.ctx.format(harness.target).then(
			() => "",
			(error: Error) => error.message,
		);
		expect(message).toContain('"yaml-front"');
		expect(message).toContain("Where:");
		expect(message).toContain("mdx() from @monti-cms/mdx");
	});
});
