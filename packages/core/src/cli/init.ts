import { type DetectedApp, detectApp, type PackageManager } from "./init-detect";
import { defaultInitHost, planInstall, runInstallStep } from "./init-install";
import { nextSteps } from "./init-next-steps";
import { planProject } from "./init-plan";
import { collectAnswers } from "./init-prompts";
import { writtenLine } from "./init-report";
import type { InitHost, InitOptions, InitReport } from "./init-types";
import { applyPlan, ProjectWriter } from "./init-writer";
import type { Cancelled, Prompter } from "./prompt";

/**
 * `monti init`: adds Monti to an existing Next app. It reads the app, asks (or takes flags, or defaults), writes Monti's own new files (the config, the schema,
 * the three Next files, `.env.example`), makes the edits Monti needs in the app's own files (`withCms` in `next.config`, `suppressHydrationWarning` on the root
 * layout's `<html>`, `.env.local` and `.monti/` in `.gitignore`) and says exactly what it changed, installs the packages after a confirmation, and ends with a plain
 * summary of what is left, numbered, with exact content to copy. A file whose shape init cannot edit safely is not touched: its step is in that list, with the reason.
 * It writes no `.env.local` and never touches the database.
 *
 * It runs in stages, each its own module: detect (here and `init-detect.ts`), ask (`init-prompts.ts`), plan (`init-plan.ts`), write (`init-writer.ts`), install
 * (`init-install.ts`) and the list of what is left (`init-next-steps.ts`). Nothing is written until every question is answered, so cancelling leaves the project as it
 * was; every write goes through `ProjectWriter`, which refuses a path outside the project, and an existing file is never overwritten unless the person says yes
 * (or passes `overwrite`).
 */

export type { InitOptions, InitReport } from "./init-types";

/** The detect stage: reads the app and refuses one `monti init` cannot work with. */
function detectStage(options: InitOptions): { app: DetectedApp; manager: PackageManager } {
	const app = detectApp(options.cwd);
	if (!app.next) {
		throw new Error(
			"`next` is not in the dependencies of package.json. `monti init` adds Monti to an existing Next app (App Router); create one with `npx create-next-app@latest` first.",
		);
	}
	if (app.pagesRouterOnly) {
		throw new Error(
			`This app only has a pages/ folder. Monti needs the App Router: add an ${app.src ? "src/app" : "app"}/ folder (it can sit next to pages/), then run \`monti init\` again.`,
		);
	}
	return { app, manager: options.packageManager ?? app.packageManager };
}

/** Tells the person at the terminal what was found. */
function announce(prompter: Prompter | undefined, app: DetectedApp, manager: PackageManager): void {
	if (!prompter) return;
	prompter.intro(`Add Monti to ${app.packageName ?? "this app"}`);
	const detectedLine = [
		`Next ${(app.next ?? "").replace(/^[\^~]/, "")} (App Router${app.src ? ", src/" : ""})`,
		manager,
		app.typescript ? "TypeScript" : "no TypeScript",
	].join(" · ");
	prompter.note(
		[
			detectedLine,
			...app.contentFolders.map(
				(folder) =>
					`Found ${folder.files} Markdown/MDX file${folder.files === 1 ? "" : "s"} in ${folder.dir}/${folder.locales ? ` (${folder.locales.map((locale) => locale.code).join(", ")})` : ""}`,
			),
		].join("\n"),
		"Detected",
	);
}

/** Runs the whole of `monti init` in `options.cwd`. Throws {@link Cancelled} when the person cancels, `InitError` when a write fails. */
export async function initProject(options: InitOptions): Promise<InitReport> {
	const { cwd, prompter } = options;
	const host: InitHost = { ...defaultInitHost, ...options.host };
	const log = options.log ?? (() => undefined);
	const dryRun = options.dryRun === true;

	// Detect, then ask.
	const { app, manager } = detectStage(options);
	announce(prompter, app, manager);
	const answers = await collectAnswers(app, options, prompter, host.systemTimeZone);

	// Plan.
	const writer = new ProjectWriter(cwd);
	const plan = await planProject({
		cwd,
		app,
		answers,
		localesFlag: options.locales !== undefined,
		overwrite: options.overwrite === true,
		prompter,
		writer,
	});
	const install = await planInstall({ cwd, app, answers, manager, install: options.install, dryRun, prompter });

	const report: InitReport = {
		ok: true,
		dryRun,
		app: {
			name: app.packageName,
			next: app.next,
			src: app.src,
			packageManager: manager,
			typescript: app.typescript,
			contentFolders: app.contentFolders.map(({ dir, files }) => ({ dir, files })),
		},
		answers,
		created: [],
		skipped: [...plan.skipped],
		overwritten: [],
		changed: [],
		installed: [],
		steps: [],
		notes: [...plan.notes],
		next: [],
	};

	// Write, then install: the package install is the one step init runs after the files, and it is recorded, so a failure is named.
	applyPlan(plan, writer, report, dryRun);
	if (!dryRun) log(writtenLine(report));
	const installed = await runInstallStep({
		cwd,
		host,
		log,
		dryRun,
		manager,
		report,
		installing: install.installing,
		declined: install.declined,
		packages: install.missing,
		specs: install.specs,
	});

	// What is left.
	report.next.unshift(
		...nextSteps({
			cwd,
			manager,
			answers,
			typescript: app.typescript,
			configFile: plan.configFile,
			missing: install.missing,
			installCommand: install.command,
			willInstall: installed || (dryRun && install.installing),
			manual: plan.manual,
		}),
	);
	if (report.steps.some((step) => step.status === "failed")) report.ok = false;
	return report;
}
