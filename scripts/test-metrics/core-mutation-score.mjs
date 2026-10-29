#!/usr/bin/env node
/**
 * The mutation score of all of core, one source folder at a time (`stryker.score.config.mjs` on `src/<folder>`), so a run that stops (a sleep, an
 * update) goes on from the folder it was in: each finished folder keeps its report in `packages/core/reports/mutation/score/<folder>.json` and is
 * skipped the next time. `--summarize` adds the folders up.
 *
 *   caffeinate -i node scripts/test-metrics/core-mutation-score.mjs     # run the folders not done yet (needs CMS_TEST_DATABASE_URL)
 *   node scripts/test-metrics/core-mutation-score.mjs --summarize       # the score per folder and in all
 *
 * Stryker writes its mutants into the source files and puts them back when it ends. A run that is killed leaves them in place, so this refuses to
 * start while any source file still holds one; `git checkout -- packages/core/src` puts the sources back (commit your own changes first).
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const core = path.join(root, "packages/core");
const src = path.join(core, "src");
const out = path.join(core, "reports/mutation/score");
const NOT_MUTATED = ["!src/**/__test__/**", "!src/**/*.test.ts", "!src/**/*.d.ts"];

/** The folders of `src`, and `_root` for the files directly in it. */
const groups = [
	...readdirSync(src)
		.filter((name) => name !== "__test__" && statSync(path.join(src, name)).isDirectory())
		.map((name) => ({ name, mutate: [`src/${name}/**/*.ts`, ...NOT_MUTATED] })),
	{ name: "_root", mutate: ["src/*.ts", ...NOT_MUTATED] },
];

const sourceFiles = (dir) =>
	readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const full = path.join(dir, entry.name);
		return entry.isDirectory() ? sourceFiles(full) : /\.tsx?$/.test(entry.name) ? [full] : [];
	});
const leftMutated = () => sourceFiles(src).filter((file) => /stryMutAct_|__stryker__/.test(readFileSync(file, "utf8")));

/** Stryker's own score: caught (killed or timed out) over every mutant a test could have caught. */
const tally = (report) => {
	const counts = {};
	for (const file of Object.values(report.files))
		for (const mutant of file.mutants) counts[mutant.status] = (counts[mutant.status] ?? 0) + 1;
	const caught = (counts.Killed ?? 0) + (counts.Timeout ?? 0);
	const valid = caught + (counts.Survived ?? 0) + (counts.NoCoverage ?? 0);
	return { counts, caught, valid, score: valid ? (caught / valid) * 100 : null };
};

if (process.argv.includes("--summarize")) {
	const rows = groups
		.filter((group) => existsSync(path.join(out, `${group.name}.json`)))
		.map((group) => ({
			name: group.name,
			...tally(JSON.parse(readFileSync(path.join(out, `${group.name}.json`), "utf8"))),
		}));
	const missing = groups.filter((group) => !rows.some((row) => row.name === group.name)).map((group) => group.name);
	const all = rows.reduce((sum, row) => ({ caught: sum.caught + row.caught, valid: sum.valid + row.valid }), {
		caught: 0,
		valid: 0,
	});
	console.log("folder              score   caught / valid   survived  no cover  ignored");
	for (const row of rows.sort((a, b) => b.valid - a.valid))
		console.log(
			`${row.name.padEnd(18)} ${row.score === null ? "    -" : row.score.toFixed(1).padStart(5)}%  ${String(row.caught).padStart(6)} / ${String(row.valid).padEnd(6)}  ${String(row.counts.Survived ?? 0).padStart(8)}  ${String(row.counts.NoCoverage ?? 0).padStart(8)}  ${String(row.counts.Ignored ?? 0).padStart(7)}`,
		);
	console.log(
		`\nall of core: ${all.valid ? ((all.caught / all.valid) * 100).toFixed(1) : "-"}% (${all.caught} / ${all.valid})`,
	);
	if (missing.length) console.log(`not run yet: ${missing.join(", ")}`);
} else {
	mkdirSync(out, { recursive: true });
	for (const group of groups) {
		const report = path.join(out, `${group.name}.json`);
		if (existsSync(report)) {
			console.log(`${group.name}: done before, skipped`);
			continue;
		}
		const mutated = leftMutated();
		if (mutated.length) {
			console.error(
				`${mutated.length} source files still hold mutants from a stopped run (${path.relative(root, mutated[0])}, …).`,
			);
			console.error(
				"Put them back with `git checkout -- packages/core/src` (commit your own changes first), then run this again.",
			);
			process.exit(1);
		}
		const started = Date.now();
		const result = spawnSync(
			"pnpm",
			["exec", "stryker", "run", "stryker.score.config.mjs", "--mutate", group.mutate.join(",")],
			{
				cwd: core,
				encoding: "utf8",
				maxBuffer: 512 * 1024 * 1024,
				env: process.env,
			},
		);
		writeFileSync(path.join(out, `${group.name}.log`), `${result.stdout}${result.stderr}`);
		const written = path.join(out, "mutation.json");
		if (result.status !== 0 || !existsSync(written)) {
			console.error(
				`${group.name}: Stryker failed (exit ${result.status}); see ${path.relative(root, path.join(out, `${group.name}.log`))}`,
			);
			process.exit(1);
		}
		// Renamed only once the run ended: a report under the folder's name is a finished folder.
		renameSync(written, report);
		const { score, caught, valid } = tally(JSON.parse(readFileSync(report, "utf8")));
		console.log(
			`${group.name}: ${score === null ? "-" : score.toFixed(1)}% (${caught} / ${valid}), ${((Date.now() - started) / 60000).toFixed(1)} min`,
		);
	}
}
