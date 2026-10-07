import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { addComponents, formatAddReport, type InstallCommand } from "../add";
import { runCli } from "../index";

const repoRoot = fileURLToPath(new URL("../../../../../", import.meta.url));

let dirs: string[] = [];
afterEach(() => {
	for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
	dirs = [];
});

function temp(prefix: string, files: Record<string, string>): string {
	const dir = mkdtempSync(path.join(tmpdir(), `monti-add-${prefix}-`));
	dirs.push(dir);
	for (const [file, content] of Object.entries(files)) {
		mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
		writeFileSync(path.join(dir, file), content);
	}
	return dir;
}

const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;

/** A registry folder (shadcn registry schema): `card` needs `badge`; `card` needs two npm packages. */
function registry(items: Record<string, unknown>): string {
	const files: Record<string, string> = {
		"registry.json": json({ name: "test", items: Object.keys(items).map((name) => ({ name })) }),
	};
	for (const [name, item] of Object.entries(items)) files[`${name}.json`] = json(item);
	return temp("registry", files);
}

const BADGE_SOURCE = `export const Badge = () => <span />;\n`;
const CARD_SOURCE = `import { Badge } from "@/registry/monti/badge/badge";
import { helper } from "./helper";

export const Card = () => <Badge />;
`;
const REGISTRY_ITEMS = {
	badge: {
		name: "badge",
		type: "registry:component",
		files: [{ path: "items/badge/badge.tsx", type: "registry:component", content: BADGE_SOURCE }],
	},
	card: {
		name: "card",
		type: "registry:component",
		dependencies: ["zod", "@scope/pkg@^2.0.0", "react"],
		devDependencies: ["@types/node"],
		registryDependencies: ["badge"],
		files: [
			{ path: "items/card/card.tsx", type: "registry:component", content: CARD_SOURCE },
			{ path: "items/card/helper.ts", type: "registry:lib", content: "export const helper = 1;\n" },
		],
	},
};

const HOST_FILES = {
	"package.json": json({ name: "host", dependencies: { react: "19.0.0" } }),
	"pnpm-lock.yaml": "",
	"tsconfig.json": `{
	// comments are fine
	"compilerOptions": { "paths": { "@/*": ["./src/*"], }, },
}
`,
};

const read = (dir: string, file: string) => readFileSync(path.join(dir, file), "utf8");

describe("monti add", () => {
	it("copies the files to the default alias folder, rewrites registry imports to the host alias, and puts a needed item before the one that needs it", async () => {
		const host = temp("host", HOST_FILES);
		const report = await addComponents({
			cwd: host,
			names: ["card"],
			registry: registry(REGISTRY_ITEMS),
			install: () => {},
		});

		expect(report.items).toEqual(["badge", "card"]);
		expect([...report.created].sort()).toEqual([
			"src/components/monti/badge/badge.tsx",
			"src/components/monti/card/card.tsx",
			"src/components/monti/card/helper.ts",
		]);
		// The registry-internal import now points at where the host has the item; the relative import is untouched.
		expect(read(host, "src/components/monti/card/card.tsx")).toBe(
			CARD_SOURCE.replace("@/registry/monti/badge/badge", "@/components/monti/badge/badge"),
		);
		expect(report.manual).toEqual([]);
	});

	it("installs missing npm packages with the host's package manager and skips those the host already has", async () => {
		const host = temp("host", HOST_FILES);
		const commands: InstallCommand[] = [];
		await addComponents({
			cwd: host,
			names: ["card"],
			registry: registry(REGISTRY_ITEMS),
			install: (command) => void commands.push(command),
		});

		expect(commands.map((c) => [c.command, ...c.args])).toEqual([
			["pnpm", "add", "zod", "@scope/pkg@^2.0.0"],
			["pnpm", "add", "-D", "@types/node"],
		]);
		expect(commands.every((c) => c.cwd === host)).toBe(true);
	});

	it("does not install packages the app already lists under any dependency field", async () => {
		const host = temp("host", {
			"package.json": json({
				dependencies: { zod: "4" },
				devDependencies: { "@scope/pkg": "2", "@types/node": "20", react: "19" },
			}),
		});
		const commands: InstallCommand[] = [];
		await addComponents({
			cwd: host,
			names: ["card"],
			registry: registry(REGISTRY_ITEMS),
			install: (c) => void commands.push(c),
		});
		expect(commands).toEqual([]);
	});

	it("uses npm when the app has no lockfile", async () => {
		const bare = temp("bare", { "package.json": json({}) });
		const commands: InstallCommand[] = [];
		await addComponents({
			cwd: bare,
			names: ["card"],
			registry: registry(REGISTRY_ITEMS),
			install: (c) => void commands.push(c),
		});
		expect(commands.map((c) => [c.command, ...c.args])).toEqual([
			["npm", "install", "zod", "@scope/pkg@^2.0.0", "react"],
			["npm", "install", "-D", "@types/node"],
		]);
	});

	it("follows the components alias of components.json and the folder tsconfig maps it to", async () => {
		const host = temp("host", {
			"package.json": json({
				dependencies: { zod: "4", "@scope/pkg": "2", react: "19" },
				devDependencies: { "@types/node": "20" },
			}),
			"components.json": json({ aliases: { components: "~/ui/parts" } }),
			"tsconfig.json": json({ compilerOptions: { baseUrl: ".", paths: { "~/*": ["app/*"] } } }),
		});
		const report = await addComponents({
			cwd: host,
			names: ["card"],
			registry: registry(REGISTRY_ITEMS),
			install: () => {},
		});

		expect(report.created).toContain("app/ui/parts/monti/card/card.tsx");
		expect(read(host, "app/ui/parts/monti/card/card.tsx")).toContain(`from "~/ui/parts/monti/badge/badge"`);
		expect(report.importAlias).toBe("~/ui/parts/monti");
	});

	it("falls back to the default alias without tsconfig paths and says how to wire it", async () => {
		const host = temp("host", { "package.json": json({ dependencies: { react: "19" } }) });
		const report = await addComponents({
			cwd: host,
			names: ["badge"],
			registry: registry(REGISTRY_ITEMS),
			install: () => {},
		});

		expect(report.created).toEqual(["components/monti/badge/badge.tsx"]);
		expect(report.manual).toHaveLength(1);
		expect(report.manual[0]).toContain("compilerOptions.paths");
		expect(report.manual[0]).toContain(`"@/*": ["./*"]`);
	});

	it("puts a file with a `target` where the target says and never outside the app", async () => {
		const reg = registry({
			page: {
				name: "page",
				files: [
					{
						path: "items/page/page.tsx",
						type: "registry:page",
						target: "~/app/demo/page.tsx",
						content: "export default 1;\n",
					},
				],
			},
			escape: { name: "escape", files: [{ path: "x.ts", target: "../outside.ts", content: "" }] },
		});
		const host = temp("host", HOST_FILES);
		await addComponents({ cwd: host, names: ["page"], registry: reg, install: () => {} });
		expect(read(host, "app/demo/page.tsx")).toBe("export default 1;\n");
		await expect(addComponents({ cwd: host, names: ["escape"], registry: reg, install: () => {} })).rejects.toThrow(
			/outside the app/,
		);
	});

	describe("overwrite guard", () => {
		it("refuses to replace a file the user changed, writes nothing at all, and says which files", async () => {
			const host = temp("host", HOST_FILES);
			const reg = registry(REGISTRY_ITEMS);
			await addComponents({ cwd: host, names: ["badge"], registry: reg, install: () => {} });
			writeFileSync(path.join(host, "src/components/monti/badge/badge.tsx"), "// my edit\n");

			const report = await addComponents({ cwd: host, names: ["card"], registry: reg, install: () => {} });

			expect(report.conflicts).toEqual(["src/components/monti/badge/badge.tsx"]);
			expect(read(host, "src/components/monti/badge/badge.tsx")).toBe("// my edit\n");
			// The files that would have been new are not written either: the install is all or nothing.
			expect(readdirSync(path.join(host, "src/components/monti"))).toEqual(["badge"]);
			expect(formatAddReport(report)).toContain("--overwrite");
		});

		it("does not install npm packages when it stops on a conflict", async () => {
			const host = temp("host", HOST_FILES);
			const reg = registry(REGISTRY_ITEMS);
			await addComponents({ cwd: host, names: ["badge"], registry: reg, install: () => {} });
			writeFileSync(path.join(host, "src/components/monti/badge/badge.tsx"), "// my edit\n");
			const commands: InstallCommand[] = [];
			await addComponents({ cwd: host, names: ["card"], registry: reg, install: (c) => void commands.push(c) });
			expect(commands).toEqual([]);
		});

		it("replaces the changed file with --overwrite and reports it", async () => {
			const host = temp("host", HOST_FILES);
			const reg = registry(REGISTRY_ITEMS);
			await addComponents({ cwd: host, names: ["badge"], registry: reg, install: () => {} });
			writeFileSync(path.join(host, "src/components/monti/badge/badge.tsx"), "// my edit\n");

			const report = await addComponents({
				cwd: host,
				names: ["badge"],
				registry: reg,
				overwrite: true,
				install: () => {},
			});

			expect(report.overwritten).toEqual(["src/components/monti/badge/badge.tsx"]);
			expect(read(host, "src/components/monti/badge/badge.tsx")).toBe(BADGE_SOURCE);
		});

		it("leaves files that already match alone, so running it twice is a no-op", async () => {
			const host = temp("host", HOST_FILES);
			const reg = registry(REGISTRY_ITEMS);
			await addComponents({ cwd: host, names: ["card"], registry: reg, install: () => {} });
			const again = await addComponents({ cwd: host, names: ["card"], registry: reg, install: () => {} });

			expect(again.created).toEqual([]);
			expect(again.conflicts).toEqual([]);
			expect(again.unchanged).toHaveLength(3);
		});
	});

	it("changes nothing on a dry run, neither files nor packages, but reports the same plan", async () => {
		const host = temp("host", HOST_FILES);
		const commands: InstallCommand[] = [];
		const report = await addComponents({
			cwd: host,
			names: ["card"],
			registry: registry(REGISTRY_ITEMS),
			dryRun: true,
			install: (c) => void commands.push(c),
		});

		expect(report.created).toHaveLength(3);
		expect(report.dependencies).toEqual(["zod", "@scope/pkg@^2.0.0"]);
		expect(commands).toEqual([]);
		expect(readdirSync(host).sort()).toEqual(["package.json", "pnpm-lock.yaml", "tsconfig.json"]);
		expect(formatAddReport(report)).toContain("dry run");
	});

	describe("registry", () => {
		it("names the available components when one is missing", async () => {
			const host = temp("host", HOST_FILES);
			await expect(addComponents({ cwd: host, names: ["nope"], registry: registry(REGISTRY_ITEMS) })).rejects.toThrow(
				/No component "nope".*Available: badge, card/,
			);
		});

		it("rejects items that need each other", async () => {
			const reg = registry({
				a: { name: "a", registryDependencies: ["b"], files: [] },
				b: { name: "b", registryDependencies: ["a"], files: [] },
			});
			await expect(addComponents({ cwd: temp("host", HOST_FILES), names: ["a"], registry: reg })).rejects.toThrow(
				/a -> b -> a/,
			);
		});

		it("rejects an item whose files have no content, rather than writing empty files", async () => {
			const reg = registry({ bare: { name: "bare", files: [{ path: "items/bare/bare.ts" }] } });
			await expect(addComponents({ cwd: temp("host", HOST_FILES), names: ["bare"], registry: reg })).rejects.toThrow(
				/no content/,
			);
		});

		it("reads a registry served over HTTP, an item URL as a dependency, and the path of registry.json as a registry", async () => {
			const served: Record<string, unknown> = {
				"https://example.test/r/registry.json": { items: [{ name: "badge" }] },
				"https://example.test/r/badge.json": REGISTRY_ITEMS.badge,
				"https://example.test/r/card.json": {
					...REGISTRY_ITEMS.card,
					dependencies: [],
					devDependencies: [],
					registryDependencies: ["https://example.test/elsewhere/badge.json"],
				},
				"https://example.test/elsewhere/badge.json": REGISTRY_ITEMS.badge,
			};
			const requested: string[] = [];
			const fetch = async (url: string) => {
				requested.push(url);
				return url in served
					? { ok: true, status: 200, text: async () => JSON.stringify(served[url]) }
					: { ok: false, status: 404, text: async () => "" };
			};
			const host = temp("host", HOST_FILES);
			const report = await addComponents({
				cwd: host,
				names: ["card"],
				registry: "https://example.test/r/registry.json",
				fetch,
				install: () => {},
			});

			expect(report.items).toEqual(["badge", "card"]);
			expect(requested).toEqual(["https://example.test/r/card.json", "https://example.test/elsewhere/badge.json"]);

			const onDisk = registry(REGISTRY_ITEMS);
			const other = temp("host", HOST_FILES);
			await addComponents({
				cwd: other,
				names: ["badge"],
				registry: path.join(onDisk, "registry.json"),
				install: () => {},
			});
			expect(read(other, "src/components/monti/badge/badge.tsx")).toBe(BADGE_SOURCE);
		});

		it("reports an unreachable registry URL with its status", async () => {
			const fetch = async () => ({ ok: false, status: 503, text: async () => "" });
			await expect(
				addComponents({ cwd: temp("host", HOST_FILES), names: ["badge"], registry: "https://example.test/r", fetch }),
			).rejects.toThrow(/503/);
		});
	});

	describe("command line", () => {
		const capture = (cwd: string) => {
			const out: string[] = [];
			const err: string[] = [];
			return { io: { cwd, log: (m: string) => void out.push(m), error: (m: string) => void err.push(m) }, out, err };
		};

		it("adds a component and exits 0; exits 1 on a conflict and 0 again with --overwrite", async () => {
			const reg = registry({ badge: REGISTRY_ITEMS.badge });
			const host = temp("host", HOST_FILES);
			const first = capture(host);
			expect(await runCli(["add", "badge", "--registry", reg], first.io)).toBe(0);
			expect(first.out.join("\n")).toContain("src/components/monti/badge/badge.tsx");

			writeFileSync(path.join(host, "src/components/monti/badge/badge.tsx"), "// edited\n");
			const refused = capture(host);
			expect(await runCli(["add", "badge", "--registry", reg], refused.io)).toBe(1);
			expect(refused.out.join("\n")).toContain("--overwrite");
			expect(read(host, "src/components/monti/badge/badge.tsx")).toBe("// edited\n");

			const forced = capture(host);
			expect(await runCli(["add", "badge", "--registry", reg, "--overwrite"], forced.io)).toBe(0);
			expect(read(host, "src/components/monti/badge/badge.tsx")).toBe(BADGE_SOURCE);
		});

		it("takes --dry-run, and fails with a message when no component is named or the app has no package.json", async () => {
			const reg = registry({ badge: REGISTRY_ITEMS.badge });
			const host = temp("host", HOST_FILES);
			const dry = capture(host);
			expect(await runCli(["add", "badge", "--registry", reg, "--dry-run"], dry.io)).toBe(0);
			expect(readdirSync(host)).not.toContain("src");

			const none = capture(host);
			expect(await runCli(["add"], none.io)).toBe(1);
			expect(none.err.join("\n")).toContain("Name the components");

			const empty = capture(temp("empty", {}));
			expect(await runCli(["add", "badge", "--registry", reg], empty.io)).toBe(1);
			expect(empty.err.join("\n")).toContain("package.json");
		});
	});
});

describe("the registry of this repo", () => {
	const registryDir = path.join(repoRoot, "registry/r");
	const index = JSON.parse(readFileSync(path.join(registryDir, "registry.json"), "utf8")) as {
		items: { name: string }[];
	};

	it("is built from the current sources: `pnpm registry:build` leaves it as committed", () => {
		expect(() =>
			execFileSync("node", [path.join(repoRoot, "scripts/build-registry.mjs"), "--check"], { stdio: "pipe" }),
		).not.toThrow();
	});

	it("installs every item into an empty app with nothing left of the registry's own import prefix", async () => {
		const host = temp("host", {
			"package.json": json({ name: "empty" }),
			"tsconfig.json": HOST_FILES["tsconfig.json"],
		});
		const commands: InstallCommand[] = [];
		const names = index.items.map((item) => item.name);
		const report = await addComponents({
			cwd: host,
			names,
			registry: registryDir,
			install: (c) => void commands.push(c),
		});

		expect([...report.items].sort()).toEqual([...names].sort());
		expect(report.conflicts).toEqual([]);
		// The needed item comes before the one that needs it.
		expect(report.items.indexOf("field-row")).toBeLessThan(report.items.indexOf("entry-editor"));
		for (const file of report.created) {
			const source = read(host, file);
			expect(source).not.toContain("@/registry/");
			// Components sit on public package entry points only.
			for (const [, specifier] of source.matchAll(/from "(@monti-cms\/[^"]+)"/g))
				expect([
					"@monti-cms/admin/hooks",
					"@monti-cms/core/render",
					"@monti-cms/core/client",
					"@monti-cms/nextjs",
				]).toContain(specifier);
		}
		expect(read(host, "src/components/monti/entry-editor/entry-editor-screen.tsx")).toContain(
			`from "@/components/monti/field-row/field-row"`,
		);
		// Every package the components import is declared, so `monti add` installs it.
		const declared = commands.flatMap((c) => c.args);
		for (const pkg of ["@monti-cms/admin", "@monti-cms/core", "react"]) expect(declared).toContain(pkg);
	});
});
