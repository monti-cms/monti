#!/usr/bin/env node
/**
 * Runs the whole Vitest suite several times on the same code and reports what did not give the same result every time: tests that failed in some
 * runs only (flaky), and the errors Vitest caught outside any test (a timer firing after its file ended). Each run's JSON report and output are kept.
 *
 *   node scripts/test-metrics/repeat-runs.mjs --runs 10 --out <dir>               # the suite as CI runs it
 *   node scripts/test-metrics/repeat-runs.mjs --runs 10 --shuffle --out <dir>     # files and tests in a random order (the seed of each run is kept)
 *   node scripts/test-metrics/repeat-runs.mjs --runs 3 --shuffle-tests --out <dir> # only the tests inside each file in a random order
 *   node scripts/test-metrics/repeat-runs.mjs --runs 1 --one-worker --out <dir>   # one file after another on one worker
 *   node scripts/test-metrics/repeat-runs.mjs --summarize <dir> [<dir> ...]       # the report again, over the runs of one or more folders
 *
 * No failure is not proof of none: after n runs without a failure, the chance of one per run can still be up to 1 - 0.05^(1/n) (95% one-sided),
 * which is about 26% after 10 runs and 3% after 100. The report states that bound with the number of runs.
 * The suite needs its database as usual (`CMS_TEST_DATABASE_URL`). Each run records how many tests it ran: a run that ran none is not a pass (a
 * mistyped option can turn the whole suite into a filter that matches nothing), and the summary names such runs.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const args = process.argv.slice(2);
const option = (name) => {
	const at = args.indexOf(name);
	return at === -1 ? undefined : args[at + 1];
};

const runOnce = (dir, index, { shuffle, shuffleTests, oneWorker }) => {
	const seed = shuffle || shuffleTests ? Math.floor(Math.random() * 2 ** 31) : undefined;
	const report = path.join(dir, `run-${String(index).padStart(2, "0")}.json`);
	const vitestArgs = [
		"exec",
		"vitest",
		"run",
		"--reporter=json",
		`--outputFile=${report}`,
		"--reporter=default",
		...(shuffle ? ["--sequence.shuffle", `--sequence.seed=${seed}`] : []),
		// Only this flag: `--no-sequence.shuffle.files` or `=false` beside it made Vitest run no test at all.
		...(shuffleTests ? ["--sequence.shuffle.tests", `--sequence.seed=${seed}`] : []),
		...(oneWorker ? ["--maxWorkers=1"] : []),
	];
	const started = Date.now();
	const result = spawnSync("pnpm", vitestArgs, {
		cwd: root,
		encoding: "utf8",
		maxBuffer: 512 * 1024 * 1024,
		env: process.env,
	});
	const output = `${result.stdout}${result.stderr}`;
	writeFileSync(report.replace(/\.json$/, ".log"), output);
	// The JSON report has no place for errors outside tests; the summary line of the console output does.
	const unhandled = Number(/Errors\s+(\d+) errors?/.exec(output)?.[1] ?? 0);
	const origins = [...output.matchAll(/This error originated in "([^"]+)"/g)].map((match) => match[1]);
	const tests = existsSync(report) ? JSON.parse(readFileSync(report, "utf8")).numTotalTests : 0;
	return {
		index,
		seed,
		exitCode: result.status,
		seconds: (Date.now() - started) / 1000,
		unhandled,
		origins,
		tests,
		report: path.basename(report),
	};
};

/** How many tests a run ran, read from its report (runs recorded before the count was kept have only the report). */
const testsRun = (run) => {
	const file = path.join(run.dir, run.report);
	return existsSync(file) ? JSON.parse(readFileSync(file, "utf8")).numTotalTests : 0;
};

const summarize = (dirs) => {
	const runs = dirs.flatMap((dir) =>
		JSON.parse(readFileSync(path.join(dir, "runs.json"), "utf8")).map((run) => ({ ...run, dir })),
	);
	const outcomes = new Map();
	for (const run of runs) {
		const file = path.join(run.dir, run.report);
		if (!existsSync(file)) continue;
		const report = JSON.parse(readFileSync(file, "utf8"));
		for (const testFile of report.testResults) {
			const rel = path.relative(root, testFile.name);
			for (const test of testFile.assertionResults) {
				if (test.status !== "passed" && test.status !== "failed") continue;
				const key = `${rel} > ${test.fullName}`;
				const seen = outcomes.get(key) ?? { passed: 0, failed: 0, failedIn: [] };
				seen[test.status] += 1;
				if (test.status === "failed")
					seen.failedIn.push(run.seed === undefined ? `${run.dir}#${run.index}` : `seed ${run.seed}`);
				outcomes.set(key, seen);
			}
			// A file that could not load reports no tests, only its own failure.
			if (testFile.status === "failed" && testFile.assertionResults.length === 0) {
				const key = `${rel} (file failed to run)`;
				const seen = outcomes.get(key) ?? { passed: 0, failed: 0, failedIn: [] };
				seen.failed += 1;
				outcomes.set(key, seen);
			}
		}
	}
	const unstable = [...outcomes.entries()].filter(([, seen]) => seen.failed > 0);
	const n = runs.length;
	const seconds = runs.map((run) => run.seconds).sort((a, b) => a - b);
	const summary = {
		runs: n,
		failedRuns: runs.filter((run) => run.exitCode !== 0).length,
		runsWithUnhandledErrors: runs.filter((run) => run.unhandled > 0).length,
		runsThatRanNoTest: runs.filter((run) => !testsRun(run)).map((run) => `${run.dir}#${run.index}`),
		unhandledOrigins: [...new Set(runs.flatMap((run) => run.origins))],
		seconds: { min: seconds[0], median: seconds[Math.floor(n / 2)], max: seconds[n - 1] },
		tests: outcomes.size,
		testsThatFailed: unstable.map(([key, seen]) => ({
			test: key,
			failed: seen.failed,
			passed: seen.passed,
			failedIn: seen.failedIn,
		})),
		// With no failure seen for a test in n runs, its failure chance per run is below this (95% one-sided).
		upperBoundPerRunIfNoFailure: n ? 1 - 0.05 ** (1 / n) : null,
	};
	console.log(JSON.stringify(summary, null, 2));
	return summary;
};

const summarizeDirs = args.includes("--summarize") ? args.slice(args.indexOf("--summarize") + 1) : undefined;
if (summarizeDirs) {
	summarize(summarizeDirs.map((dir) => path.resolve(dir)));
} else {
	const out = option("--out");
	if (!out) throw new Error("repeat-runs: say where the reports go (`--out <dir>`)");
	const dir = path.resolve(out);
	mkdirSync(dir, { recursive: true });
	const count = Number(option("--runs") ?? 10);
	const settings = {
		shuffle: args.includes("--shuffle"),
		shuffleTests: args.includes("--shuffle-tests"),
		oneWorker: args.includes("--one-worker"),
	};
	const done = existsSync(path.join(dir, "runs.json"))
		? JSON.parse(readFileSync(path.join(dir, "runs.json"), "utf8"))
		: [];
	// A folder that already holds runs gets more of them: the numbering goes on.
	const start = done.length + 1;
	for (let index = start; index < start + count; index++) {
		const run = runOnce(dir, index, settings);
		done.push(run);
		// Written after every run, so a stopped series still has its finished runs.
		writeFileSync(path.join(dir, "runs.json"), JSON.stringify(done, null, 2));
		console.log(
			`run ${index}: exit ${run.exitCode}, ${run.tests} tests, ${run.seconds.toFixed(0)}s, unhandled errors ${run.unhandled}${run.seed === undefined ? "" : `, seed ${run.seed}`}`,
		);
	}
	summarize([dir]);
}
