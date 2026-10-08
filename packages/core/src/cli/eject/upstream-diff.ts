import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { unifiedDiff } from "../diff";
import { EjectError } from "./eject";
import { type EjectedPackage, readEjected } from "./record";

/**
 * `monti eject --diff <package>`: what changed upstream since the version the package was ejected from. It fetches the ejected version and the one to compare
 * with (the latest by default), and diffs their sources. The ejected copy itself is not the baseline, because the site has changed it; it is only used to say which of
 * the files that changed upstream the site has edited as well, so those can be merged by hand.
 */

/** Gets the package folder (with `src` in it) of `<name>@<spec>`. */
export type FetchPackage = (name: string, spec: string) => string | Promise<string>;

export interface UpstreamDiffOptions {
	readonly cwd: string;
	readonly name: string;
	/** A version or dist-tag (`0.2.0`, `latest`), or a folder or `.tgz` of a package to compare with. Default `latest`. */
	readonly to?: string;
	/** For tests. Default: `npm pack` into a temp folder. */
	readonly fetchPackage?: FetchPackage;
}

export interface UpstreamChange {
	readonly file: string;
	readonly status: "added" | "removed" | "changed";
	/** The site has edited its copy of this file too (it differs from the version it was ejected from). */
	readonly editedHere: boolean;
}

export interface UpstreamDiff {
	readonly package: string;
	readonly from: string;
	readonly to: string;
	readonly changes: readonly UpstreamChange[];
	/** The diffs of the changed files, from the ejected version to the new one. */
	readonly diff: string;
}

/** `npm pack <name>@<spec>` into a temp folder, unpacked. */
const npmPack: FetchPackage = (name, spec) => {
	const work = mkdtempSync(path.join(tmpdir(), "monti-eject-"));
	const packed = spawnSync("npm", ["pack", `${name}@${spec}`, "--pack-destination", work, "--silent"], {
		encoding: "utf8",
		shell: process.platform === "win32",
	});
	if (packed.status !== 0) {
		throw new EjectError(
			`could not download ${name}@${spec} with \`npm pack\`: ${(packed.stderr || packed.stdout || "no output").trim().split("\n").at(-1)}`,
		);
	}
	const file = readdirSync(work).find((entry) => entry.endsWith(".tgz"));
	if (!file) throw new EjectError(`\`npm pack ${name}@${spec}\` produced no file`);
	const unpacked = path.join(work, "unpacked");
	mkdirSync(unpacked);
	const untar = spawnSync("tar", ["-xzf", path.join(work, file), "-C", unpacked]);
	if (untar.status !== 0) throw new EjectError(`could not unpack ${file}: ${String(untar.stderr)}`);
	return path.join(unpacked, "package");
};

/** The source files of a package folder (`src`, without tests), by path relative to `src`. */
export function readSources(packageDir: string): Map<string, string> {
	const out = new Map<string, string>();
	const root = path.join(packageDir, "src");
	const walk = (relative: string) => {
		for (const entry of readdirSync(path.join(root, relative), { withFileTypes: true })) {
			const child = relative === "" ? entry.name : `${relative}/${entry.name}`;
			if (entry.isDirectory()) {
				if (entry.name !== "__test__" && !(relative === "" && entry.name === "test")) walk(child);
			} else if (!/\.test\.tsx?$/.test(entry.name)) out.set(child, readFileSync(path.join(root, child), "utf8"));
		}
	};
	if (existsSync(root)) walk("");
	return out;
}

/** The package folder for `to`: a folder or tarball on disk, else a version or tag to download. */
function resolveTarget(cwd: string, name: string, to: string, fetchPackage: FetchPackage): string | Promise<string> {
	const local = path.resolve(cwd, to);
	if (existsSync(local) && statSync(local).isDirectory()) return local;
	if (existsSync(local) && local.endsWith(".tgz")) {
		const work = mkdtempSync(path.join(tmpdir(), "monti-eject-"));
		const untar = spawnSync("tar", ["-xzf", local, "-C", work]);
		if (untar.status !== 0) throw new EjectError(`could not unpack ${local}: ${String(untar.stderr)}`);
		return path.join(work, "package");
	}
	return fetchPackage(name, to);
}

const versionOf = (packageDir: string): string => {
	try {
		return String(
			(JSON.parse(readFileSync(path.join(packageDir, "package.json"), "utf8")) as { version?: unknown }).version,
		);
	} catch {
		return "unknown";
	}
};

/** The change of upstream between the version `name` was ejected from and `to`. */
export async function upstreamDiff(options: UpstreamDiffOptions): Promise<UpstreamDiff> {
	const { cwd, name } = options;
	const entry: EjectedPackage | undefined = readEjected(cwd).find((item) => item.package === name);
	if (!entry) {
		throw new EjectError(
			`${name} is not ejected here (nothing about it in .monti/ejected.json). \`monti eject ${name}\` takes it.`,
		);
	}
	const fetchPackage = options.fetchPackage ?? npmPack;
	const baselineDir = await fetchPackage(name, entry.version);
	const targetDir = await resolveTarget(cwd, name, options.to ?? "latest", fetchPackage);
	const baseline = readSources(baselineDir);
	const target = readSources(targetDir);
	if (baseline.size === 0) {
		throw new EjectError(
			`${name}@${entry.version} has no source to compare with (it was published without a src folder).`,
		);
	}
	if (target.size === 0) {
		throw new EjectError(
			`${name}@${versionOf(targetDir)} has no source to compare with (it was published without a src folder).`,
		);
	}
	const here = readSources(path.join(cwd, entry.directory));

	const changes: UpstreamChange[] = [];
	const diffs: string[] = [];
	for (const file of [...new Set([...baseline.keys(), ...target.keys()])].sort()) {
		const before = baseline.get(file);
		const after = target.get(file);
		if (before === after) continue;
		const status = before === undefined ? "added" : after === undefined ? "removed" : "changed";
		changes.push({ file: `src/${file}`, status, editedHere: here.get(file) !== before });
		diffs.push(unifiedDiff(`src/${file}`, before ?? "", after ?? ""));
	}
	return { package: name, from: entry.version, to: versionOf(targetDir), changes, diff: diffs.join("\n\n") };
}

/** The diff as lines for a terminal. */
export function formatUpstreamDiff(result: UpstreamDiff): string {
	if (result.changes.length === 0) {
		return `${result.package}: no change in the source between ${result.from} (the version it was ejected from) and ${result.to}.`;
	}
	const lines = [
		`${result.package}: ${result.changes.length} file${result.changes.length === 1 ? "" : "s"} changed upstream between ${result.from} (the version it was ejected from) and ${result.to}.`,
		"",
	];
	for (const change of result.changes) {
		lines.push(
			`  ${change.status.padEnd(7)} ${change.file}${change.editedHere ? "   (you have edited this file too: merge by hand)" : ""}`,
		);
	}
	lines.push(
		"",
		result.diff,
		"",
		"Apply what you want to your copy by hand; then nothing else needs recording. Eject keeps no merge state.",
	);
	return lines.join("\n");
}
