import fs from "node:fs";
import path from "node:path";

/**
 * Picks the test files that read the site config, so the other-site runs (`vitest.othersite.config.ts` of core and admin) execute only the tests
 * whose result can depend on the config. A test that never reads the config gives the same result under any config, and the default run covers it.
 *
 * The rule: a test file is config-sensitive when its own text, or the text of a test helper it imports (relative imports inside a `test` or `__test__` folder,
 * with `transitive: true`), reads the config through one of these:
 *  - `any-site` (the helpers that look collections, fields and blocks up from the config; a file named `any-site*` is also selected),
 *  - `testConfig` (the config object itself),
 *  - the config-derived lists and lookups of `testSite` (`COLLECTIONS`, `schemaOf`, `isItemCollection`, `DEFAULT_LOCALE`, ...).
 * A test that hands `testSite` to a config-driven component without naming any of these (the schema screen, a block builder) is listed in `also`.
 *
 * `test/site.ts` is the only reader of `MONTI_TEST_SITE` and defines these names, so it is never followed. Nothing is listed by hand: a new test joins
 * the other-site run by using one of the names above, which is what a config-agnostic test does anyway. A test that merely renders with `testSite` and
 * names no collection or field stays in the default run.
 */
export const READS_CONFIG =
	/\bany-site\b|\btestConfig\b|\btestSite\.(?:COLLECTIONS|DOCUMENT_COLLECTIONS|LINKABLE_COLLECTIONS|isItemCollection|isDocumentCollection|isCollection|schemaOf|DEFAULT_LOCALE|DEFAULT_COLLECTION|LOCALES|BLOCKS|ADDED_BLOCKS|config)\b|\b(?:LINKABLE_COLLECTIONS|PREFIXED_LOCALES)\b/;

const SOURCE_EXT = [".ts", ".tsx"];
const IMPORT = /(?:from|import)\s*\(?\s*["'](\.{1,2}\/[^"']*)["']/g;
const isTestHelper = (file: string) => /[\\/](?:__test__|test)[\\/]/.test(file);

const walk = (dir: string): string[] =>
	fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		if (entry.name === "node_modules") return [];
		const full = path.join(dir, entry.name);
		return entry.isDirectory() ? walk(full) : [full];
	});

const resolveImport = (from: string, spec: string): string | undefined => {
	const base = path.resolve(path.dirname(from), spec);
	const candidates = [
		base,
		...SOURCE_EXT.map((ext) => base + ext),
		...SOURCE_EXT.map((ext) => path.join(base, `index${ext}`)),
	];
	return candidates.find((file) => fs.existsSync(file) && fs.statSync(file).isFile());
};

export function configSensitiveTests(options: {
	/** The package directory the tests live in (the directory of the vitest config). */
	packageDir: string;
	/** Absolute path of `test/site.ts`, which is never followed. */
	siteFile: string;
	/** Also look through the test helpers a test imports (core's contract suites and fixtures). */
	transitive: boolean;
	/** Config-sensitive test files the text rule cannot see (they pass `testSite` to a component that reads the config), package-relative. */
	also?: string[];
	/** Test files that cannot run under another config (they assert the reference blog's values as they are). */
	skip?: (file: string) => boolean;
}): string[] {
	const { packageDir, siteFile, transitive, skip, also = [] } = options;
	const srcDir = path.join(packageDir, "src");
	const testFiles = walk(srcDir).filter((file) => /\.(?:test|spec)\.tsx?$/.test(file));
	const memo = new Map<string, boolean>();
	const reads = (file: string, trail: Set<string>): boolean => {
		const known = memo.get(file);
		if (known !== undefined) return known;
		if (trail.has(file)) return false;
		trail.add(file);
		const text = fs.readFileSync(file, "utf8");
		const result =
			READS_CONFIG.test(text) ||
			(transitive &&
				[...text.matchAll(IMPORT)].some((match) => {
					const dep = resolveImport(file, match[1] ?? "");
					return dep !== undefined && dep !== siteFile && isTestHelper(dep) && reads(dep, trail);
				}));
		trail.delete(file);
		memo.set(file, result);
		return result;
	};
	for (const listed of also) {
		if (!fs.existsSync(path.join(packageDir, listed)))
			throw new Error(`config-sensitive: ${listed} is listed in \`also\` but does not exist`);
	}
	const selected = testFiles
		.filter((file) => !skip?.(file))
		.filter(
			(file) =>
				reads(file, new Set()) ||
				/any-site/.test(path.basename(file)) ||
				also.includes(path.relative(packageDir, file).split(path.sep).join("/")),
		)
		.map((file) => path.relative(packageDir, file).split(path.sep).join("/"))
		.sort();
	if (selected.length === 0) throw new Error(`config-sensitive: no test under ${srcDir} reads the site config`);
	return selected;
}
