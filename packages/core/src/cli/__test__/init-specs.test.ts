import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { initProject, installSpecs } from "../init";
import { CREATE_NEXT_APP, fakeHost, fixtureApp } from "./init-helpers";

const GITHUB = "github:monti-cms/monti#release/v0.2.0-next.1&path:/core";

/** A fresh Next app whose package.json lists `@monti-cms/core` with the given spec. */
function appWithCore(spec: string, field: "dependencies" | "devDependencies" = "dependencies") {
	const pkg = JSON.parse(CREATE_NEXT_APP["package.json"] as string);
	pkg[field] = { ...pkg[field], "@monti-cms/core": spec };
	return fixtureApp({ "package.json": JSON.stringify(pkg) });
}

describe("installSpecs", () => {
	it("gives each Monti package the core address with its own folder, and leaves other packages bare", () => {
		expect(installSpecs(["@monti-cms/admin", "@monti-cms/syntax-shiki", "next-themes"], GITHUB)).toEqual([
			"@monti-cms/admin@github:monti-cms/monti#release/v0.2.0-next.1&path:/admin",
			"@monti-cms/syntax-shiki@github:monti-cms/monti#release/v0.2.0-next.1&path:/syntax-shiki",
			"next-themes",
		]);
	});

	it("takes path:/core in any place of the address", () => {
		expect(installSpecs(["@monti-cms/auth"], "github:monti-cms/monti&path:/core")).toEqual([
			"@monti-cms/auth@github:monti-cms/monti&path:/auth",
		]);
	});

	it("keeps bare names for a version range, a missing spec or an address without path:/core", () => {
		const names = ["@monti-cms/admin", "next-themes"];
		for (const spec of ["^0.2.0", "0.2.0-next.0", "latest", "workspace:*", "github:monti-cms/monti#main", undefined]) {
			expect(installSpecs(names, spec)).toEqual(names);
		}
	});
});

describe("monti init with a GitHub spec for core", () => {
	it("installs the missing Monti packages from the same ref, in dependencies or devDependencies", async () => {
		for (const field of ["dependencies", "devDependencies"] as const) {
			const host = fakeHost();
			await initProject({ cwd: appWithCore(GITHUB, field), host });
			const args = host.install.mock.calls[0]?.[0].args ?? [];
			expect(args).toContain("@monti-cms/admin@github:monti-cms/monti#release/v0.2.0-next.1&path:/admin");
			expect(args).toContain("@monti-cms/nextjs@github:monti-cms/monti#release/v0.2.0-next.1&path:/nextjs");
			expect(args).not.toContain("@monti-cms/admin");
			expect(args).not.toContain("@monti-cms/core");
			expect(args.some((arg) => arg.startsWith("@monti-cms/core@"))).toBe(false);
			expect(args).toContain("next-themes");
		}
	});

	it("installs bare names when core has a version range", async () => {
		const host = fakeHost();
		await initProject({ cwd: appWithCore("^0.2.0"), host });
		const args = host.install.mock.calls[0]?.[0].args ?? [];
		expect(args).toContain("@monti-cms/admin");
		expect(args.some((arg) => arg.includes("github:"))).toBe(false);
	});

	it("prints the --no-install command with the same specs, quoted for a shell", async () => {
		const dir = appWithCore(GITHUB);
		const report = await initProject({ cwd: dir, host: fakeHost(), install: false });
		const text = report.next.find((item) => item.startsWith("Install the packages:"))?.split("\n")[1] ?? "";
		expect(text).toContain("'@monti-cms/admin@github:monti-cms/monti#release/v0.2.0-next.1&path:/admin'");
		expect(text).toMatch(/ next-themes /);
		// A shell reads the printed line back as the same arguments, with no `&` or `#` acting on the command.
		const run = spawnSync("sh", ["-c", `set -- ${text.replace(/^pnpm add /, "")}; printf '%s\\n' "$@"`], {
			encoding: "utf8",
		});
		const args = run.stdout.trim().split("\n");
		expect(args).toContain("@monti-cms/admin@github:monti-cms/monti#release/v0.2.0-next.1&path:/admin");
		expect(args).toContain("next-themes");
	});

	it("records the same specs in a dry run", async () => {
		const report = await initProject({ cwd: appWithCore(GITHUB), host: fakeHost(), dryRun: true });
		const step = report.steps.find((entry) => entry.name === "Install packages");
		expect(step?.detail).toContain("'@monti-cms/admin@github:");
		expect(report.installed).toContain("@monti-cms/admin");
	});
});
