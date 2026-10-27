#!/usr/bin/env node
/**
 * Runs the design system's visual regression in the Linux image CI runs it in, so a shot taken on a Mac or a Windows machine can be compared
 * with the baselines (text is drawn differently per operating system, so the baselines are only ever made on Linux).
 *
 *   pnpm test:visual:docker            # compare with the baselines in packages/ui/visual/baselines
 *   pnpm test:visual:docker --update   # write the baselines again (what changed on purpose)
 *
 * The repo is copied into the container (without node_modules, so the host's install is never touched), installed and built there. Only the
 * baselines and, after a failed comparison, the diff images (packages/ui/visual/test-results) are written back to the repo.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const visual = path.join(root, "packages/ui/visual");
const update = process.argv.includes("--update");

const read = (file) => JSON.parse(readFileSync(path.join(root, file), "utf8"));
// The image is the one of the installed Playwright version, and the same tag the CI job runs in (checked by a test).
const playwright = read("packages/ui/package.json").devDependencies["@playwright/test"];
const image = `mcr.microsoft.com/playwright:v${playwright}-noble`;
const pnpm = read("package.json").packageManager.split("+")[0].split("@")[1];

const baselines = path.join(visual, "baselines");
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
status=0
MONTI_VISUAL_BASELINES=/out pnpm --filter @monti-cms/ui visual:run ${update ? "--update-snapshots" : ""} || status=$?
cp -R packages/ui/visual/test-results/. /results/ 2>/dev/null || true
chown -R "$HOST_UID:$HOST_GID" /out /results
exit $status
`;

const result = spawnSync(
	"docker",
	[
		"run",
		"--rm",
		"--ipc=host",
		"-e",
		`HOST_UID=${process.getuid?.() ?? 0}`,
		"-e",
		`HOST_GID=${process.getgid?.() ?? 0}`,
		"-v",
		`${root}:/src:ro`,
		"-v",
		`${baselines}:/out`,
		"-v",
		`${results}:/results`,
		image,
		"bash",
		"-c",
		inside,
	],
	{ stdio: "inherit" },
);
if (result.error) {
	console.error(`visual-docker: could not run docker (${result.error.message}). Is Docker installed and running?`);
	process.exit(1);
}
process.exit(result.status ?? 1);
