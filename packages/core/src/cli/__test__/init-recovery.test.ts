import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { formatInitReport, initProject } from "../init";
import { fakeHost, fixtureApp, listFiles, read } from "./init-helpers";

describe("monti init when the install fails", () => {
	it("does not say Monti is added: the install step failed, ok is false and the install command is listed", async () => {
		const dir = fixtureApp();
		const host = fakeHost({ install: () => Promise.reject(new Error("`pnpm add` failed")) });
		const report = await initProject({ cwd: dir, host });
		const text = formatInitReport(report);

		expect(report.ok).toBe(false);
		expect(report.steps.map((step) => [step.name, step.status])).toEqual([["Install packages", "failed"]]);
		expect(text).not.toContain("Monti is added to your app");
		expect(text).toContain("Install packages: FAILED");
		expect(report.next.some((line) => /^Install the packages:\npnpm add @monti-cms\/core /.test(line))).toBe(true);
		// The files are still there.
		expect(read(dir, "monti.config.ts")).toContain("defineConfig");
	});

	it("leaves no progress file behind, on a failure or on a dry run", async () => {
		const failed = fixtureApp();
		await initProject({
			cwd: failed,
			host: fakeHost({ install: () => Promise.reject(new Error("offline")) }),
		});
		expect(existsSync(path.join(failed, ".monti"))).toBe(false);

		const dry = fixtureApp();
		const install = vi.fn(() => Promise.reject(new Error("offline")));
		await initProject({ cwd: dry, host: fakeHost({ install }), dryRun: true });
		expect(existsSync(path.join(dry, ".monti"))).toBe(false);
		expect(install).not.toHaveBeenCalled();
	});

	it("completes when init is run again after the failure, and does not overwrite the files from the first run", async () => {
		const dir = fixtureApp();
		const failed = await initProject({
			cwd: dir,
			host: fakeHost({ install: () => Promise.reject(new Error("offline")) }),
		});
		expect(failed.ok).toBe(false);
		const filesAfterFailure = listFiles(dir);
		const edited = `${read(dir, "monti.config.ts")}\n// my edit\n`;
		writeFileSync(path.join(dir, "monti.config.ts"), edited);

		const online = fakeHost();
		const second = await initProject({ cwd: dir, host: online });
		expect(second.ok).toBe(true);
		expect(second.steps.map((step) => [step.name, step.status])).toEqual([["Install packages", "done"]]);
		expect(online.install).toHaveBeenCalled();
		expect(second.overwritten).toEqual([]);
		expect(second.skipped).toContain("monti.config.ts");
		expect(read(dir, "monti.config.ts")).toBe(edited);
		expect(listFiles(dir).filter((file) => !filesAfterFailure.includes(file))).toEqual([]);
		expect(formatInitReport(second)).not.toContain("FAILED");
	});
});
