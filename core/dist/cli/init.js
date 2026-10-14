import { detectApp } from "./init-detect.js";
import { defaultInitHost, planInstall, runInstallStep } from "./init-install.js";
import { nextSteps } from "./init-next-steps.js";
import { planProject } from "./init-plan.js";
import { collectAnswers } from "./init-prompts.js";
import { writtenLine } from "./init-report.js";
import { applyPlan, ProjectWriter } from "./init-writer.js";
/** The detect stage: reads the app and refuses one `monti init` cannot work with. */
function detectStage(options) {
    const app = detectApp(options.cwd);
    if (!app.next) {
        throw new Error("`next` is not in the dependencies of package.json. `monti init` adds Monti to an existing Next app (App Router); create one with `npx create-next-app@latest` first.");
    }
    if (app.pagesRouterOnly) {
        throw new Error(`This app only has a pages/ folder. Monti needs the App Router: add an ${app.src ? "src/app" : "app"}/ folder (it can sit next to pages/), then run \`monti init\` again.`);
    }
    return { app, manager: options.packageManager ?? app.packageManager };
}
/** Tells the person at the terminal what was found. */
function announce(prompter, app, manager) {
    if (!prompter)
        return;
    prompter.intro(`Add Monti to ${app.packageName ?? "this app"}`);
    const detectedLine = [
        `Next ${(app.next ?? "").replace(/^[\^~]/, "")} (App Router${app.src ? ", src/" : ""})`,
        manager,
        app.typescript ? "TypeScript" : "no TypeScript",
    ].join(" · ");
    prompter.note([
        detectedLine,
        ...app.contentFolders.map((folder) => `Found ${folder.files} Markdown/MDX file${folder.files === 1 ? "" : "s"} in ${folder.dir}/${folder.locales ? ` (${folder.locales.map((locale) => locale.code).join(", ")})` : ""}`),
    ].join("\n"), "Detected");
}
/** Runs the whole of `monti init` in `options.cwd`. Throws {@link Cancelled} when the person cancels, `InitError` when a write fails. */
export async function initProject(options) {
    const { cwd, prompter } = options;
    const host = { ...defaultInitHost, ...options.host };
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
    const report = {
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
    if (!dryRun)
        log(writtenLine(report));
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
    report.next.unshift(...nextSteps({
        cwd,
        manager,
        answers,
        typescript: app.typescript,
        configFile: plan.configFile,
        missing: install.missing,
        installCommand: install.command,
        willInstall: installed || (dryRun && install.installing),
        manual: plan.manual,
    }));
    if (report.steps.some((step) => step.status === "failed"))
        report.ok = false;
    return report;
}
