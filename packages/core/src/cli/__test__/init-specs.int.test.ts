import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { initProject } from "../init";
import { CREATE_NEXT_APP, fakeHost, fixtureApp, installing } from "./init-helpers";

const GITHUB = "github:monti-cms/monti#release/v0.2.0-next.16&path:/core";

/** A fresh Next app whose package.json lists `@monti-cms/core` with the given spec. */
function appWithCore(spec: string, field: "dependencies" | "devDependencies" = "dependencies") {
	const pkg = JSON.parse(CREATE_NEXT_APP["package.json"] as string);
	pkg[field] = { ...pkg[field], "@monti-cms/core": spec };
	return fixtureApp({ "package.json": JSON.stringify(pkg) });
}

describe("monti init with a GitHub spec for core", () => {
	it("INIT-I1 installs the missing Monti packages from the same ref, in dependencies or devDependencies", async () => {
		for (const field of ["dependencies", "devDependencies"] as const) {
			const host = fakeHost();
			await initProject({ cwd: appWithCore(GITHUB, field), host });
			expect(host.install).toHaveBeenCalledOnce();
			expect(host.install).toHaveBeenCalledWith(
				installing(
					"@monti-cms/admin@github:monti-cms/monti#release/v0.2.0-next.16&path:/admin",
					"@monti-cms/nextjs@github:monti-cms/monti#release/v0.2.0-next.16&path:/nextjs",
					"next-themes",
				),
			);
			expect(host.install).not.toHaveBeenCalledWith(installing("@monti-cms/admin"));
			expect(host.install).not.toHaveBeenCalledWith(installing("@monti-cms/core"));
			expect(host.install).not.toHaveBeenCalledWith(installing(expect.stringMatching(/^@monti-cms\/core@/)));
		}
	});

	it("INIT-R2 installs @monti-cms/syntax-directive from the same ref when the directive syntax is on", async () => {
		const host = fakeHost();
		await initProject({ cwd: appWithCore(GITHUB), host, directiveSyntax: true });
		expect(host.install).toHaveBeenCalledWith(
			installing("@monti-cms/syntax-directive@github:monti-cms/monti#release/v0.2.0-next.16&path:/syntax-directive"),
		);
		const without = fakeHost();
		await initProject({ cwd: appWithCore(GITHUB), host: without, directiveSyntax: false });
		expect(without.install).toHaveBeenCalledOnce();
		expect(without.install).not.toHaveBeenCalledWith(installing(expect.stringContaining("syntax-directive")));
	});

	it("installs bare names when core has a version range", async () => {
		const host = fakeHost();
		await initProject({ cwd: appWithCore("^0.2.0"), host });
		expect(host.install).toHaveBeenCalledOnce();
		expect(host.install).toHaveBeenCalledWith(installing("@monti-cms/admin"));
		expect(host.install).not.toHaveBeenCalledWith(installing(expect.stringContaining("github:")));
	});

	it("INIT-I1 prints the --no-install command with the same specs, quoted for a shell", async () => {
		const dir = appWithCore(GITHUB);
		const report = await initProject({ cwd: dir, host: fakeHost(), install: false });
		const text = report.next.find((item) => item.startsWith("Install the packages:"))?.split("\n")[1] ?? "";
		expect(text).toContain("'@monti-cms/admin@github:monti-cms/monti#release/v0.2.0-next.16&path:/admin'");
		expect(text).toMatch(/ next-themes /);
		// A shell reads the printed line back as the same arguments, with no `&` or `#` acting on the command.
		const run = spawnSync("sh", ["-c", `set -- ${text.replace(/^pnpm add /, "")}; printf '%s\\n' "$@"`], {
			encoding: "utf8",
		});
		const args = run.stdout.trim().split("\n");
		expect(args).toContain("@monti-cms/admin@github:monti-cms/monti#release/v0.2.0-next.16&path:/admin");
		expect(args).toContain("next-themes");
	});

	it("records the same specs in a dry run", async () => {
		const report = await initProject({ cwd: appWithCore(GITHUB), host: fakeHost(), dryRun: true });
		const step = report.steps.find((entry) => entry.name === "Install packages");
		expect(step?.detail).toContain("'@monti-cms/admin@github:");
		expect(report.installed).toContain("@monti-cms/admin");
	});
});

describe("the packages init installs", () => {
	const PACKAGES = path.resolve(import.meta.dirname, "../../../..");
	/** The peers a package asks the app to install: not Monti's own, not React. */
	const peersOf = (folder: string): string[] =>
		Object.keys(
			JSON.parse(readFileSync(path.join(PACKAGES, folder, "package.json"), "utf8")).peerDependencies ?? {},
		).filter((name) => !name.startsWith("@monti-cms/") && name !== "react" && name !== "react-dom");

	it("INIT-R2 includes every library the admin and the AI plugin need as peers, also with no blocks", async () => {
		for (const blocks of ["default", "none"]) {
			const dir = fixtureApp();
			const report = await initProject({ cwd: dir, host: fakeHost(), install: false, extras: "ai", blocks });
			expect(report.installed).toEqual(expect.arrayContaining([...peersOf("admin"), ...peersOf("ai")]));
		}
	});

	it("when the install is left to the person, the list says why the libraries are there", async () => {
		const report = await initProject({ cwd: fixtureApp(), host: fakeHost(), install: false });
		const step = report.next.find((item) => item.startsWith("Install the packages:")) ?? "";
		expect(step).toContain("peer dependencies");
		for (const peer of peersOf("admin")) expect(step).toContain(peer);
	});
});
