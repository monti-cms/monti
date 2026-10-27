#!/usr/bin/env node
/**
 * Runs the design system's visual regression in the Linux image CI runs it in, so a shot taken on a Mac or a Windows machine can be compared
 * with the baselines (text is drawn differently per operating system, so the baselines are only ever made on Linux).
 *
 *   pnpm test:visual:docker            # compare with the baselines in packages/ui/visual/baselines
 *   pnpm test:visual:docker --update   # write the baselines again (what changed on purpose)
 *   pnpm test:visual:docker --baselines <dir> [--update]   # read or write the baselines of another folder (a trial run)
 *
 * The repo is copied into the container (without node_modules, so the host's install is never touched), installed and built there. Only the
 * baselines (after `--update`) and, after a failed comparison, the diff images (packages/ui/visual/test-results) are copied back.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const visual = path.join(root, "packages/ui/visual");
const args = process.argv.slice(2);
const update = args.includes("--update");
const folder = args.indexOf("--baselines");

const read = (file) => JSON.parse(readFileSync(path.join(root, file), "utf8"));
// The image is the one of the installed Playwright version, and the same tag the CI job runs in (checked by a test).
const playwright = read("packages/ui/package.json").devDependencies["@playwright/test"];
const image = `mcr.microsoft.com/playwright:v${playwright}-noble`;
const pnpm = read("package.json").packageManager.split("+")[0].split("@")[1];

if (folder !== -1 && !args[folder + 1]) {
	console.error("visual-docker: --baselines needs a folder.");
	process.exit(1);
}
const baselines = folder === -1 ? path.join(visual, "baselines") : path.resolve(args[folder + 1] ?? "");
const results = path.join(visual, "test-results");
mkdirSync(baselines, { recursive: true });
mkdirSync(results, { recursive: true });

const inside = `
set -e
mkdir /work
tar -C /src --exclude=node_modules --exclude=.git --exclude=.claude --exclude=storybook-static --exclude=test-results --exclude=./examples -cf - . | tar -C /work -xf -
cd /work
npm install --global pnpm@${pnpm}
HUSKY=0 pnpm install --frozen-lockfile
pnpm --filter @monti-cms/ui build-storybook
MONTI_VISUAL_BASELINES=/out pnpm --filter @monti-cms/ui visual:run ${update ? "--update-snapshots" : ""}
`;

const docker = (...dockerArgs) => spawnSync("docker", dockerArgs, { stdio: "inherit" });
const fail = (message) => {
	console.error(`visual-docker: ${message}`);
	process.exit(1);
};

// The repo is mounted read-only; the baselines go in and out with `docker cp`, so the run works with any Docker (Docker Desktop, Colima, a remote
// engine) whatever folders it shares with the host.
const created = spawnSync("docker", ["create", "--ipc=host", "-v", `${root}:/src:ro`, image, "bash", "-c", inside], {
	encoding: "utf8",
});
if (created.error) fail(`could not run docker (${created.error.message}). Is Docker installed and running?`);
if (created.status !== 0) fail(`could not create the container:\n${created.stderr}`);
const container = created.stdout.trim();

let status = 1;
try {
	if (docker("cp", baselines, `${container}:/out`).status !== 0)
		fail("could not copy the baselines into the container.");
	status = docker("start", "--attach", container).status ?? 1;
	// The baselines are written back after an update; the diff images after any run.
	if (update && docker("cp", `${container}:/out/.`, baselines).status !== 0) fail("could not copy the baselines out.");
	// There is no such folder after a run with no failure.
	spawnSync("docker", ["cp", `${container}:/work/packages/ui/visual/test-results/.`, results], { stdio: "ignore" });
} finally {
	docker("rm", "--force", "--volumes", container);
}
process.exit(status);
