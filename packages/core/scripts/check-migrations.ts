/**
 * Fails when a migration step that already exists on the base branch is gone. A store records each step it ran by name (`cms_migrations`), so a step
 * whose file is renamed or deleted runs again, or never, on a store that is upgraded. Adding a step is fine.
 *
 *   pnpm check:migrations                       # compares with the base branch (below)
 *   pnpm check:migrations --base origin/main    # compares with that ref
 *
 * Two checks:
 * - No step file (`migrations/NNNN_name.ts`) of the base is deleted or renamed here (`git diff --name-status <base>...HEAD`, and what is not
 *   committed yet).
 * - The step list (`CONTENT_STORE_MIGRATIONS`) is exactly the step files, in the order of their numbers, so a step's name is its file's name.
 *
 * The base is `--base`; else, in a pull request, its base branch (`GITHUB_BASE_REF`); else, on a push, the remote branch this one was cut from: of the
 * other `origin/*` branches, the one whose merge base is the fewest commits behind HEAD (on a tie, the one with the fewest commits of its own since).
 * CI checks out the full history for this.
 */
import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import path from "node:path";

const DIR = path.resolve(import.meta.dirname, "../src/adapters/postgres/migrations");
const STEP_FILE = /^(\d{4}_\w+)\.ts$/;

const git = (...args: string[]) => execFileSync("git", args, { encoding: "utf8", cwd: DIR }).trim();

const tryGit = (...args: string[]): string | null => {
	try {
		return git(...args);
	} catch {
		return null;
	}
};

/** The ref to compare with, and why it was picked. */
function findBase(): { ref: string; why: string } {
	const flag = process.argv.indexOf("--base");
	if (flag !== -1) {
		const ref = process.argv[flag + 1];
		if (!ref) throw new Error("--base needs a ref (for example origin/main)");
		return { ref, why: "--base" };
	}
	const pullBase = process.env.GITHUB_BASE_REF;
	if (pullBase) return { ref: `origin/${pullBase}`, why: "the pull request's base branch" };

	const branch = process.env.GITHUB_REF_NAME || git("rev-parse", "--abbrev-ref", "HEAD");
	let best: { ref: string; behind: number; ahead: number } | null = null;
	for (const ref of git("for-each-ref", "--format=%(refname:short)", "refs/remotes/origin").split("\n")) {
		if (!ref.startsWith("origin/") || ref === "origin/HEAD" || ref === `origin/${branch}`) continue;
		const mergeBase = tryGit("merge-base", "HEAD", ref);
		if (!mergeBase) continue;
		const behind = Number(git("rev-list", "--count", `${mergeBase}..HEAD`));
		// On a tie (sibling branches cut from the same commit), the one that has moved least since is the branch they were cut from.
		const ahead = Number(git("rev-list", "--count", `${mergeBase}..${ref}`));
		if (!best || behind < best.behind || (behind === best.behind && ahead < best.ahead)) best = { ref, behind, ahead };
	}
	if (!best) {
		throw new Error(
			"no other origin/* branch shares history with HEAD: fetch the full history (fetch-depth: 0) or pass --base <ref>",
		);
	}
	return { ref: best.ref, why: `the branch this one was cut from (${best.behind} commits since)` };
}

async function main(): Promise<void> {
	const problems: string[] = [];
	const relativeDir = git("rev-parse", "--show-prefix");

	const { ref, why } = findBase();
	if (!tryGit("rev-parse", "--verify", "--quiet", `${ref}^{commit}`)) throw new Error(`${ref} is not a commit here`);
	// From the merge base to the working tree, like `<base>...HEAD` plus what is not committed yet.
	const mergeBase = tryGit("merge-base", ref, "HEAD");
	if (!mergeBase) throw new Error(`${ref} shares no history with HEAD: fetch the full history (fetch-depth: 0)`);
	const changes = git("diff", "--name-status", "-M", "--diff-filter=DR", mergeBase, "--", ".");
	for (const line of changes ? changes.split("\n") : []) {
		const [status, from, to] = line.split("\t") as [string, string, string | undefined];
		const name = path.basename(from);
		if (!STEP_FILE.test(name)) continue;
		problems.push(
			status.startsWith("R")
				? `${name} is renamed to ${path.basename(to ?? "")}: a store that ran ${name} runs the step again`
				: `${name} is deleted: a store that ran it is refused as outdated, and a new store never gets it`,
		);
	}

	const files = readdirSync(DIR)
		.map((file) => STEP_FILE.exec(file)?.[1])
		.filter((name): name is string => name !== undefined)
		.sort();
	// Loaded after the git check, so a step deleted together with its import still gets its own line above.
	const steps = await import("../src/adapters/postgres/migrations").then(
		(module) => module.CONTENT_STORE_MIGRATIONS,
		(error: unknown) => {
			problems.push(`migrations/index.ts does not load: ${error instanceof Error ? error.message : String(error)}`);
			return null;
		},
	);
	if (steps && JSON.stringify(files) !== JSON.stringify(steps)) {
		problems.push(
			`the step list in migrations/index.ts is [${steps.join(", ")}], the step files are [${files.join(", ")}]: ` +
				"each step is named after its file, in the order of the numbers",
		);
	}

	if (!problems.length) {
		console.log(`check-migrations: ok (${files.length} steps, compared with ${ref}, ${why})`);
		return;
	}
	console.error(`check-migrations: ${relativeDir} compared with ${ref} (${why}):`);
	for (const problem of problems) console.error(`  ${problem}`);
	console.error("A shipped step keeps its name and file. Put a change in a new step with the next number.");
	process.exitCode = 1;
}

main().catch((error: unknown) => {
	console.error(`check-migrations: ${error instanceof Error ? error.message : String(error)}`);
	process.exitCode = 1;
});
