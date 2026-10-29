#!/usr/bin/env node
/**
 * How much test code each kind of commit changed, read from the git history (`git log --numstat`), to estimate what the tests cost to keep.
 * The commit kind is the Conventional Commits type of its subject; `!` (a breaking change) is kept apart, because it changes behavior on purpose.
 * A `refactor` without `!` says it keeps behavior, so the tests it had to change are the ones tied to how the code is built. This is an estimate:
 * why each test changed (a stronger check, a rename, a broken one) is not in the history.
 *
 * A squashed pull request carries one kind for everything in it, and a `refactor(ui)` pull request can hold `fix!` commits. `--pr-commits` counts
 * the commits of each pull request instead (the subject ends in `(#N)`; the list comes from GitHub through `gh`, the commits from the
 * `refs/pull/*` refs: `git fetch origin '+refs/pull/*\/head:refs/remotes/origin/pr/*'` first). The lists are cached in `node_modules/.cache`.
 *
 *   node scripts/test-metrics/test-churn.mjs                # every commit of HEAD
 *   node scripts/test-metrics/test-churn.mjs main..HEAD     # a range
 *   node scripts/test-metrics/test-churn.mjs --pr-commits   # the commits inside each pull request
 *   node scripts/test-metrics/test-churn.mjs --json
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const args = process.argv.slice(2);
const asJson = args.includes("--json");
const range = args.find((arg) => !arg.startsWith("--")) ?? "HEAD";
const byPrCommit = args.includes("--pr-commits");

const isTest = (file) =>
	file.startsWith("packages/") &&
	!file.startsWith("packages/ui/visual/") &&
	(/\.(test|spec)\.[cm]?[jt]sx?$/.test(file) || file.split("/").includes("__test__"));
const isSource = (file) =>
	file.startsWith("packages/") &&
	/\/src\//.test(file) &&
	/\.[cm]?[jt]sx?$/.test(file) &&
	!isTest(file) &&
	!/\.stories\./.test(file);

const SEP = "\u0001";
const git = (gitArgs) => execFileSync("git", gitArgs, { cwd: root, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });

/** Commits as `git log --numstat` prints them, each with its kind and the lines it changed per file. */
const parseLog = (log) =>
	log
		.split(SEP)
		.filter(Boolean)
		.map((block) => {
			const [subject = "", ...lines] = block.split("\n");
			const [hash, ...words] = subject.split(" ");
			const title = words.join(" ");
			const match = /^([a-z]+)(?:\([^)]*\))?(!)?:/.exec(title);
			const kind = match ? `${match[1]}${match[2] ?? ""}` : "other";
			const files = lines
				.filter(Boolean)
				.map((line) => line.split("\t"))
				.filter((parts) => parts.length === 3)
				.map(([added, removed, file]) => ({
					// Binary files show `-`; a rename shows `{old => new}`, which is counted under its new path.
					lines: (Number(added) || 0) + (Number(removed) || 0),
					file: file.replace(/\{[^}]* => ([^}]*)\}/, "$1").replace(/\/\//g, "/"),
				}));
			return { hash, title, kind, files };
		});

const squashed = parseLog(git(["log", "--no-merges", "--numstat", `--format=${SEP}%h %s`, range]));

/** The commits of each pull request, from GitHub, cached: a merged pull request's list does not change. */
const prCommits = () => {
	const cacheFile = path.join(root, "node_modules/.cache/test-metrics/pr-commits.json");
	const cache = existsSync(cacheFile) ? JSON.parse(readFileSync(cacheFile, "utf8")) : {};
	for (const commit of squashed) {
		const pr = /\(#(\d+)\)$/.exec(commit.title)?.[1];
		if (!pr || cache[pr]) continue;
		const out = execFileSync(
			"gh",
			["api", `repos/{owner}/{repo}/pulls/${pr}/commits`, "--paginate", "--jq", ".[].sha"],
			{
				cwd: root,
				encoding: "utf8",
			},
		);
		cache[pr] = out.split("\n").filter(Boolean);
	}
	mkdirSync(path.dirname(cacheFile), { recursive: true });
	writeFileSync(cacheFile, JSON.stringify(cache));
	return cache;
};

const expand = () => {
	const lists = prCommits();
	const kept = [];
	const shas = new Set();
	let missing = 0;
	for (const commit of squashed) {
		const pr = /\(#(\d+)\)$/.exec(commit.title)?.[1];
		if (!pr) {
			kept.push(commit);
			continue;
		}
		for (const sha of lists[pr] ?? []) {
			try {
				git(["cat-file", "-e", `${sha}^{commit}`]);
				shas.add(sha);
			} catch {
				missing += 1;
			}
		}
	}
	// One commit can sit in two pull requests (a branch made on another); it is counted once. Merges inside a branch are left out.
	const inner = shas.size
		? parseLog(git(["log", "--no-walk=unsorted", "--no-merges", "--numstat", `--format=${SEP}%h %s`, ...shas]))
		: [];
	return { commits: [...kept, ...inner], missing, pullRequests: Object.keys(lists).length };
};

const expanded = byPrCommit ? expand() : undefined;
const commits = expanded ? expanded.commits : squashed;

const byKind = {};
const perTestFile = {};
for (const commit of commits) {
	const tests = commit.files.filter((entry) => isTest(entry.file));
	const sources = commit.files.filter((entry) => isSource(entry.file));
	byKind[commit.kind] ??= { commits: 0, touchingTests: 0, testFiles: 0, testLines: 0, sourceFiles: 0, sourceLines: 0 };
	const row = byKind[commit.kind];
	row.commits += 1;
	if (tests.length) row.touchingTests += 1;
	row.testFiles += tests.length;
	row.testLines += tests.reduce((sum, entry) => sum + entry.lines, 0);
	row.sourceFiles += sources.length;
	row.sourceLines += sources.reduce((sum, entry) => sum + entry.lines, 0);
	if (commit.kind === "refactor")
		for (const entry of tests) perTestFile[entry.file] = (perTestFile[entry.file] ?? 0) + 1;
}

const kinds = Object.entries(byKind).sort((a, b) => b[1].commits - a[1].commits);
// Only the test files that still exist: a deleted file costs nothing to keep any more.
const topRefactorFiles = Object.entries(perTestFile)
	.filter(([file]) => existsSync(path.join(root, file)))
	.sort((a, b) => b[1] - a[1])
	.slice(0, 15)
	.map(([file, n]) => ({ file, refactorCommits: n }));

if (asJson) {
	console.log(
		JSON.stringify(
			{
				range,
				byPrCommit,
				missing: expanded?.missing,
				commits: commits.length,
				byKind: Object.fromEntries(kinds),
				topRefactorFiles,
			},
			null,
			2,
		),
	);
} else {
	console.log(
		expanded
			? `${commits.length} commits in ${range}, the ${expanded.pullRequests} pull requests counted by their own commits (${expanded.missing} not found locally)`
			: `${commits.length} commits in ${range}`,
	);
	const head = ["kind", "commits", "touch tests", "test files", "test lines", "src lines", "test/src lines"];
	const rows = kinds.map(([kind, row]) => [
		kind,
		row.commits,
		row.touchingTests,
		row.testFiles,
		row.testLines,
		row.sourceLines,
		row.sourceLines ? (row.testLines / row.sourceLines).toFixed(2) : "-",
	]);
	const widths = head.map((cell, i) => Math.max(String(cell).length, ...rows.map((r) => String(r[i]).length)));
	const line = (r) =>
		r.map((cell, i) => (i === 0 ? String(cell).padEnd(widths[i]) : String(cell).padStart(widths[i]))).join("  ");
	console.log(line(head));
	for (const r of rows) console.log(line(r));
	console.log("\ntest files changed by the most refactor commits (no `!`):");
	for (const { file, refactorCommits } of topRefactorFiles) console.log(`  ${refactorCommits}  ${file}`);
}
