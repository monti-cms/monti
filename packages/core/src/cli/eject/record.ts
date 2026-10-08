import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

/** Where `monti eject` records what it took, relative to the site. It is committed: it is the site's own bookkeeping, not progress of a command. */
export const EJECTED_FILE = ".monti/ejected.json";

export interface EjectedPackage {
	/** The npm name, e.g. `@monti-cms/admin`. */
	readonly package: string;
	/** The version the source was taken from. */
	readonly version: string;
	/** ISO time of the eject. */
	readonly ejectedAt: string;
	/** The folder of the copy, relative to the site, with `/`. */
	readonly directory: string;
}

export interface EjectedRecord {
	readonly version: 1;
	readonly packages: readonly EjectedPackage[];
}

/** The ejected packages of the site in `cwd`. A missing file is an empty list; a file that does not parse is an error that says which file. */
export function readEjected(cwd: string): readonly EjectedPackage[] {
	const file = path.join(cwd, EJECTED_FILE);
	if (!existsSync(file)) return [];
	let parsed: unknown;
	try {
		parsed = JSON.parse(readFileSync(file, "utf8"));
	} catch (error) {
		throw new Error(`${EJECTED_FILE} is not valid JSON (${error instanceof Error ? error.message : String(error)})`);
	}
	const list = (parsed as { packages?: unknown } | null)?.packages;
	if (!Array.isArray(list)) throw new Error(`${EJECTED_FILE} has no "packages" list`);
	return list.filter(
		(entry): entry is EjectedPackage =>
			typeof entry === "object" &&
			entry !== null &&
			typeof (entry as EjectedPackage).package === "string" &&
			typeof (entry as EjectedPackage).version === "string" &&
			typeof (entry as EjectedPackage).ejectedAt === "string" &&
			typeof (entry as EjectedPackage).directory === "string",
	);
}

/** Text of the record file for a list of packages. */
export function ejectedText(packages: readonly EjectedPackage[]): string {
	const record: EjectedRecord = { version: 1, packages };
	return `${JSON.stringify(record, null, "\t")}\n`;
}

export function writeEjected(cwd: string, packages: readonly EjectedPackage[]): void {
	const file = path.join(cwd, EJECTED_FILE);
	mkdirSync(path.dirname(file), { recursive: true });
	writeFileSync(file, ejectedText(packages));
}

/** `major.minor.patch` of a version, for comparing. A prerelease sorts before its release. `undefined` when it is not a version. */
function parseVersion(version: string): { numbers: [number, number, number]; pre: string } | undefined {
	const match = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+.*)?$/.exec(version.trim());
	if (!match) return undefined;
	return { numbers: [Number(match[1]), Number(match[2]), Number(match[3])], pre: match[4] ?? "" };
}

/** Negative when `a` is older than `b`, positive when newer, 0 when equal; `undefined` when either is not a version. */
export function compareVersions(a: string, b: string): number | undefined {
	const left = parseVersion(a);
	const right = parseVersion(b);
	if (!left || !right) return undefined;
	for (let index = 0; index < 3; index++) {
		const difference = (left.numbers[index] ?? 0) - (right.numbers[index] ?? 0);
		if (difference !== 0) return difference;
	}
	if (left.pre === right.pre) return 0;
	if (left.pre === "") return 1;
	if (right.pre === "") return -1;
	return left.pre < right.pre ? -1 : 1;
}
