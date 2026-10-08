import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runDoctor } from "../doctor";
import { EJECTABLE_PACKAGES, ejectability } from "../eject/allowlist";
import { compareVersions } from "../eject/record";
import { runCli } from "../index";

const dirs: string[] = [];
afterEach(() => {
	for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const tmp = (): string => {
	const dir = mkdtempSync(path.join(tmpdir(), "monti-eject-test-"));
	dirs.push(dir);
	return dir;
};

const write = (dir: string, file: string, text: string) => {
	mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
	writeFileSync(path.join(dir, file), text);
};
const read = (dir: string, file: string) => readFileSync(path.join(dir, file), "utf8");
const json = (dir: string, file: string) => JSON.parse(read(dir, file));

/** A package as `pnpm pack` leaves it: `exports` point at `dist`, and the source is in `src`. */
function installPackage(site: string, name: string, version: string, files: Record<string, string> = {}) {
	const dir = path.join(site, "node_modules", name);
	write(
		dir,
		"package.json",
		JSON.stringify({
			name,
			version,
			private: true,
			type: "module",
			exports: {
				".": { types: "./dist/index.d.ts", default: "./dist/index.js" },
				"./hooks": { types: "./dist/hooks/public.d.ts", default: "./dist/hooks/public.js" },
				"./styles.css": "./dist/styles.css",
			},
			peerDependencies: { "@monti-cms/core": "^0.1.0", react: ">=19" },
			devDependencies: { vitest: "^4" },
			scripts: { build: "x" },
			files: ["dist", "src"],
			publishConfig: { exports: {} },
		}),
	);
	write(dir, "src/index.ts", 'export const label = "Save";\n');
	write(dir, "src/hooks/public.ts", "export const hooks = 1;\n");
	write(dir, "src/hooks/__test__/hooks.test.ts", "test\n");
	write(dir, "src/editor.test.tsx", "test\n");
	write(dir, "dist/index.js", "built\n");
	write(dir, "dist/index.d.ts", "built\n");
	write(dir, "dist/styles.css", ".a{}\n");
	write(dir, "dist/fonts/KaTeX.woff2", "font\n");
	write(dir, "README.md", "# admin\n");
	for (const [file, text] of Object.entries(files)) write(dir, file, text);
}

function site(options: { manager?: "pnpm" | "npm"; extra?: Record<string, unknown> } = {}): string {
	const dir = tmp();
	const manager = options.manager ?? "pnpm";
	write(
		dir,
		"package.json",
		`${JSON.stringify(
			{
				name: "my-site",
				private: true,
				dependencies: { "@monti-cms/admin": "file:vendor/admin.tgz", "@monti-cms/core": "^0.1.0" },
				...options.extra,
			},
			null,
			2,
		)}\n`,
	);
	write(dir, manager === "pnpm" ? "pnpm-lock.yaml" : "package-lock.json", "");
	installPackage(dir, "@monti-cms/admin", "0.1.0");
	return dir;
}

async function monti(cwd: string, ...argv: string[]) {
	const out: string[] = [];
	const installs: string[] = [];
	const code = await runCli(["eject", ...argv], {
		cwd,
		log: (line) => out.push(line),
		error: (line) => out.push(line),
		runInstall: (command) => {
			installs.push(`${command.command} ${command.args.join(" ")}`);
		},
	});
	return { code, text: out.join("\n"), installs };
}

describe("monti eject refuses what core guards", () => {
	it.each([
		["@monti-cms/core", /write pipeline/],
		["@monti-cms/auth", /login/],
		["@monti-cms/mdx", /format side|read and writes/],
		["@monti-cms/storage-s3", /storage/],
		["@monti-cms/storage-anything", /storage/],
		["@monti-cms/nextjs", /write/],
		["@monti-cms/syntax-directive", /format side/],
		["@monti-cms/git-sync", /data or server/],
		["@monti-cms/unknown-thing", /not a UI package/],
		["left-pad", /not a Monti package/],
	])("%s is refused, with the reason, and nothing is written", async (name, reason) => {
		const dir = site();
		const before = read(dir, "package.json");
		const { code, text, installs } = await monti(dir, name, "--yes");
		expect(code).toBe(1);
		expect(text).toMatch(reason);
		expect(text).toContain("@monti-cms/admin");
		expect(read(dir, "package.json")).toBe(before);
		expect(existsSync(path.join(dir, "packages"))).toBe(false);
		expect(existsSync(path.join(dir, ".monti"))).toBe(false);
		expect(installs).toEqual([]);
	});

	it("the allowlist holds the UI packages and none of the sealed ones", () => {
		const names = EJECTABLE_PACKAGES.map((entry) => entry.name);
		expect(names).toEqual(expect.arrayContaining(["@monti-cms/admin", "@monti-cms/blocks"]));
		for (const sealed of ["@monti-cms/core", "@monti-cms/auth", "@monti-cms/mdx", "@monti-cms/storage-s3"]) {
			expect(names).not.toContain(sealed);
			expect(ejectability(sealed).ok).toBe(false);
		}
	});

	it("refuses with --json as JSON", async () => {
		const { code, text } = await monti(site(), "@monti-cms/core", "--json");
		expect(code).toBe(1);
		expect(JSON.parse(text)).toMatchObject({ ok: false, error: expect.stringContaining("cannot be ejected") });
	});
});

describe("monti eject @monti-cms/admin", () => {
	it("copies the source, points the dependency at it, records it and installs", async () => {
		const dir = site();
		write(dir, ".gitignore", "node_modules\n.monti/\n");
		write(dir, "pnpm-workspace.yaml", "packages: []\nonlyBuiltDependencies:\n  - esbuild\n");
		const { code, text, installs } = await monti(dir, "@monti-cms/admin", "--yes");
		expect(code, text).toBe(0);

		// the source, without tests, and the built stylesheet under prebuilt/
		expect(read(dir, "packages/monti-admin/src/index.ts")).toContain("Save");
		expect(existsSync(path.join(dir, "packages/monti-admin/src/hooks/__test__"))).toBe(false);
		expect(existsSync(path.join(dir, "packages/monti-admin/src/editor.test.tsx"))).toBe(false);
		expect(existsSync(path.join(dir, "packages/monti-admin/dist"))).toBe(false);
		expect(read(dir, "packages/monti-admin/prebuilt/styles.css")).toBe(".a{}\n");
		expect(existsSync(path.join(dir, "packages/monti-admin/prebuilt/fonts/KaTeX.woff2"))).toBe(true);

		// the manifest of the copy builds from source
		const manifest = json(dir, "packages/monti-admin/package.json");
		expect(manifest.exports).toEqual({
			".": "./src/index.ts",
			"./hooks": "./src/hooks/public.ts",
			"./styles.css": "./prebuilt/styles.css",
		});
		expect(manifest).not.toHaveProperty("devDependencies");
		expect(manifest).not.toHaveProperty("scripts");
		expect(manifest).not.toHaveProperty("publishConfig");
		// the Monti peers are imported from the app's node_modules, not installed by the workspace from the registry
		expect(manifest.peerDependencies).toEqual({ react: ">=19" });
		expect(manifest.montiPeerDependencies).toEqual({ "@monti-cms/core": "^0.1.0" });

		// the site
		expect(json(dir, "package.json").dependencies).toEqual({
			"@monti-cms/admin": "workspace:*",
			"@monti-cms/core": "^0.1.0",
		});
		expect(read(dir, "pnpm-workspace.yaml")).toBe(
			"packages:\n  - packages/monti-admin\nonlyBuiltDependencies:\n  - esbuild\n",
		);
		expect(json(dir, ".monti/ejected.json")).toEqual({
			version: 1,
			packages: [
				{
					package: "@monti-cms/admin",
					version: "0.1.0",
					ejectedAt: expect.stringMatching(/^\d{4}-\d\d-\d\dT/),
					directory: "packages/monti-admin",
				},
			],
		});
		// `.monti/` was ignored: the record must still be committed
		expect(read(dir, ".gitignore")).toBe("node_modules\n.monti/*\n!.monti/ejected.json\n");
		expect(installs).toEqual(["pnpm install --no-frozen-lockfile"]);

		// it says whose job the updates are, and how to compare
		expect(text).toContain("are now the site's job");
		expect(text).toContain("monti eject --diff @monti-cms/admin");
	});

	it("rewrites an override that pins the package to a bundle", async () => {
		const dir = site({ extra: { pnpm: { overrides: { "@monti-cms/admin": "file:vendor/admin.tgz" } } } });
		await monti(dir, "@monti-cms/admin", "--yes");
		expect(json(dir, "package.json").pnpm.overrides).toEqual({ "@monti-cms/admin": "workspace:*" });
		expect(read(dir, "pnpm-workspace.yaml")).toBe("packages:\n  - packages/monti-admin\n");
	});

	it("uses the workspaces field and a version range for npm", async () => {
		const dir = site({ manager: "npm" });
		const { code, installs } = await monti(dir, "@monti-cms/admin", "--yes");
		expect(code).toBe(0);
		const pkg = json(dir, "package.json");
		expect(pkg.workspaces).toEqual(["packages/monti-admin"]);
		expect(pkg.dependencies["@monti-cms/admin"]).toBe("*");
		expect(existsSync(path.join(dir, "pnpm-workspace.yaml"))).toBe(false);
		expect(installs).toEqual(["npm install"]);
	});

	it("--dry-run changes nothing and shows the diff", async () => {
		const dir = site();
		const before = read(dir, "package.json");
		const { code, text, installs } = await monti(dir, "@monti-cms/admin", "--dry-run");
		expect(code).toBe(0);
		expect(text).toContain("Would eject @monti-cms/admin@0.1.0 into packages/monti-admin/");
		expect(text).toContain('+    "@monti-cms/admin": "workspace:*"');
		expect(read(dir, "package.json")).toBe(before);
		expect(existsSync(path.join(dir, "packages"))).toBe(false);
		expect(existsSync(path.join(dir, ".monti"))).toBe(false);
		expect(installs).toEqual([]);
	});

	it("changes nothing without a yes when nobody can be asked", async () => {
		const dir = site();
		const { code, text } = await monti(dir, "@monti-cms/admin");
		expect(code).toBe(1);
		expect(text).toContain("--yes");
		expect(existsSync(path.join(dir, "packages"))).toBe(false);
	});

	it("--json prints the report", async () => {
		const dir = site();
		const { code, text } = await monti(dir, "@monti-cms/admin", "--yes", "--json", "--no-install");
		expect(code).toBe(0);
		expect(JSON.parse(text)).toMatchObject({
			ok: true,
			package: "@monti-cms/admin",
			version: "0.1.0",
			directory: "packages/monti-admin",
			dependency: "workspace:*",
			installed: false,
		});
	});

	it("refuses a second eject, and a package that is not installed", async () => {
		const dir = site();
		await monti(dir, "@monti-cms/admin", "--yes", "--no-install");
		const again = await monti(dir, "@monti-cms/admin", "--yes");
		expect(again.code).toBe(1);
		expect(again.text).toContain("already ejected");
		const missing = await monti(dir, "@monti-cms/blocks", "--yes");
		expect(missing.code).toBe(1);
		expect(missing.text).toContain("not installed");
	});

	it("says so when the installed version shipped no source", async () => {
		const dir = site();
		rmSync(path.join(dir, "node_modules/@monti-cms/admin/src"), { recursive: true });
		const { code, text } = await monti(dir, "@monti-cms/admin", "--yes");
		expect(code).toBe(1);
		expect(text).toContain("without its source");
		expect(existsSync(path.join(dir, "packages"))).toBe(false);
	});
});

describe("monti eject --diff", () => {
	it("lists what changed upstream since the ejected version, and which files the site edited too", async () => {
		const dir = site();
		await monti(dir, "@monti-cms/admin", "--yes", "--no-install");
		// the site edits two files
		write(dir, "packages/monti-admin/src/index.ts", 'export const label = "Keep";\n');
		write(dir, "packages/monti-admin/src/hooks/public.ts", "export const hooks = 1;\n// mine\n");

		const upstream = (version: string, index: string) => {
			const root = tmp();
			installPackage(root, "@monti-cms/admin", version, { "src/index.ts": index });
			return path.join(root, "node_modules/@monti-cms/admin");
		};
		const old = upstream("0.1.0", 'export const label = "Save";\n');
		const next = upstream("0.2.0", 'export const label = "Store";\n');
		write(next, "src/new.ts", "export const added = 1;\n");

		const out: string[] = [];
		const code = await runCli(["eject", "--diff", "@monti-cms/admin", "--to", "0.2.0", "--json"], {
			cwd: dir,
			log: (line) => out.push(line),
			error: (line) => out.push(line),
			fetchPackage: (_name: string, spec: string) => (spec === "0.1.0" ? old : next),
		});
		expect(code).toBe(0);
		const result = JSON.parse(out.join("\n"));
		expect(result).toMatchObject({ from: "0.1.0", to: "0.2.0" });
		expect(result.changes).toEqual([
			{ file: "src/index.ts", status: "changed", editedHere: true },
			{ file: "src/new.ts", status: "added", editedHere: false },
		]);
		expect(result.diff).toContain('-export const label = "Save";');
		expect(result.diff).toContain('+export const label = "Store";');
	});

	it("says a package that was not ejected is not", async () => {
		const { code, text } = await monti(site(), "--diff", "@monti-cms/admin");
		expect(code).toBe(1);
		expect(text).toContain("is not ejected here");
	});
});

describe("monti doctor lists ejected packages", () => {
	const doctor = async (dir: string) =>
		(await runDoctor({ cwd: dir, envFiles: [], only: ["ejected"], env: {} })).checks.filter(
			(check) => check.group === "ejected",
		);

	it("is quiet when nothing is ejected", async () => {
		const [check] = await doctor(site());
		expect(check?.status).toBe("ok");
		expect(check?.message).toContain("no ejected packages");
	});

	it("lists an ejected package and does not warn when it is as new as core", async () => {
		const dir = site();
		await monti(dir, "@monti-cms/admin", "--yes", "--no-install");
		const [check] = await doctor(dir);
		expect(check?.status).toBe("ok");
		expect(check?.message).toContain("@monti-cms/admin@0.1.0 (packages/monti-admin)");
	});

	it("warns when an ejected version is older than the core that runs", async () => {
		const dir = site();
		await monti(dir, "@monti-cms/admin", "--yes", "--no-install");
		const record = json(dir, ".monti/ejected.json");
		record.packages[0].version = "0.0.9";
		write(dir, ".monti/ejected.json", JSON.stringify(record));
		const [check] = await doctor(dir);
		expect(check?.status).toBe("warn");
		expect(check?.message).toContain("@monti-cms/admin@0.0.9");
		expect(check?.fix).toContain("monti eject --diff @monti-cms/admin");
	});

	it("warns when the folder of an ejected package is gone", async () => {
		const dir = site();
		await monti(dir, "@monti-cms/admin", "--yes", "--no-install");
		rmSync(path.join(dir, "packages"), { recursive: true });
		const [check] = await doctor(dir);
		expect(check?.status).toBe("warn");
		expect(check?.message).toContain("folder is gone");
	});
});

describe("compareVersions", () => {
	it("orders versions, with a prerelease before its release", () => {
		expect(compareVersions("0.1.0", "0.1.1")).toBeLessThan(0);
		expect(compareVersions("1.0.0", "0.9.9")).toBeGreaterThan(0);
		expect(compareVersions("0.1.0", "0.1.0")).toBe(0);
		expect(compareVersions("0.2.0-beta.1", "0.2.0")).toBeLessThan(0);
		expect(compareVersions("latest", "0.2.0")).toBeUndefined();
	});
});
