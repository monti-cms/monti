import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import path from "node:path";
import { findRootLayout } from "./first-run.js";
import { detectApp } from "./init-detect.js";
import { addSuppressHydrationWarning, ignoreForMonti, NEXT_CONFIG_IMPORT, wrapNextConfig, } from "./init-edit.js";
import { collectAnswers, detectedLocales, InitCancelled } from "./init-prompts.js";
import { adminLayoutTemplate, adminPageTemplate, apiRouteTemplate, configTemplate, envExampleTemplate, githubCallbackUrl, nextConfigTemplate, packagesFor, pathFor, schemaTemplate, starterCollections, } from "./templates.js";
/** An error after files were already written. `written` lists them, so the message can say what is on disk. */
export class InitError extends Error {
    written;
    constructor(message, written) {
        super(written.length === 0
            ? `${message}\n\nNothing was written.`
            : `${message}\n\nThese files were written before it failed (nothing was undone):\n${written.map((file) => `  - ${file}`).join("\n")}\nRun \`monti init\` again to continue: existing files are kept.`);
        this.written = written;
        this.name = "InitError";
    }
}
const posix = (file) => file.split(path.sep).join("/");
const dotted = (file) => (file.startsWith(".") ? file : `./${file}`);
/** Writes only inside the project folder: an absolute path, a `..` path, or a path that goes through a symlink out of the folder is refused. */
export class ProjectWriter {
    root;
    written = [];
    constructor(cwd) {
        this.root = realpathSync(cwd);
    }
    /** The absolute path of `file` if it is inside the project, else throws. */
    resolve(file) {
        if (path.isAbsolute(file) || file.split(/[\\/]/).includes("..")) {
            throw new Error(`Refusing to write ${file}: it is outside the project`);
        }
        const target = path.resolve(this.root, file);
        const inside = (candidate) => candidate === this.root || candidate.startsWith(this.root + path.sep);
        if (!inside(target))
            throw new Error(`Refusing to write ${file}: it is outside the project`);
        // A symlinked folder on the way must not lead out either: check the deepest folder that exists.
        let probe = path.dirname(target);
        while (!existsSync(probe) && probe !== this.root)
            probe = path.dirname(probe);
        if (!inside(realpathSync(probe)))
            throw new Error(`Refusing to write ${file}: a folder on its path leads outside the project`);
        return target;
    }
    exists(file) {
        return existsSync(this.resolve(file));
    }
    read(file) {
        return readFileSync(this.resolve(file), "utf8");
    }
    write(file, content) {
        const target = this.resolve(file);
        mkdirSync(path.dirname(target), { recursive: true });
        writeFileSync(target, content);
        this.written.push(posix(file));
    }
}
/** The real host: spawns the package manager. */
export const defaultInitHost = {
    install: (command) => {
        const result = spawnSync(command.command, [...command.args], { cwd: command.cwd, stdio: "inherit" });
        if (result.error || result.status !== 0) {
            throw new Error(`\`${command.command} ${command.args.join(" ")}\` failed${result.error ? `: ${result.error.message}` : ""}`);
        }
    },
};
/** The package manager's command for `monti <args>` and for a package script. */
const exec = (manager, args) => manager === "npm"
    ? `npx monti ${args}`
    : manager === "pnpm"
        ? `pnpm exec monti ${args}`
        : manager === "yarn"
            ? `yarn monti ${args}`
            : `bunx monti ${args}`;
const script = (manager, name) => manager === "npm" || manager === "bun" ? `${manager} run ${name}` : `${manager} ${name}`;
const addCommand = (manager, packages, cwd, dev = false) => ({
    command: manager,
    args: [manager === "npm" ? "install" : "add", ...(dev ? ["-D"] : []), ...packages],
    cwd,
});
/** One argument as a shell word: left as it is when it is plain, else in single quotes (the `&` and `#` of a GitHub spec would end the command or start a comment). */
const shellWord = (arg) => (/^[\w@%+=:,./-]+$/.test(arg) ? arg : `'${arg.replaceAll("'", "'\\''")}'`);
const commandText = (command) => [command.command, ...command.args.map(shellWord)].join(" ");
/** A git address that points at a folder of a repository (`github:owner/repo#ref&path:/core`), as Monti's release bundles are installed. */
const CORE_FOLDER_SPEC = /^(?:github:|git\+|git:|git@|ssh:|https?:\/\/).*(?:^|[#&])path:\/core(?=&|$)/;
/**
 * The install specs of the Monti packages: while Monti is not on npm, `@monti-cms/core` is a GitHub address with `path:/core`, and each sibling is that address with its own folder.
 * With any other spec (or none) the names stay bare. Packages that are not Monti's stay bare.
 */
export function installSpecs(packages, coreSpec) {
    if (coreSpec === undefined || !CORE_FOLDER_SPEC.test(coreSpec))
        return [...packages];
    return packages.map((name) => {
        const folder = name.startsWith("@monti-cms/") ? name.slice("@monti-cms/".length) : undefined;
        return folder ? `${name}@${coreSpec.replace(/(^|[#&])path:\/core(?=&|$)/, `$1path:/${folder}`)}` : name;
    });
}
/** The `next.config` item of the list when init did not edit the file: the reason, then the change by hand against the shape of the file. */
function nextConfigManualStep(file, reason) {
    return `Wrap the config in ${file} (init did not edit it: ${reason}). Add this import at the top:\n${NEXT_CONFIG_IMPORT}\nand export the result of withCms around the config you export now:\nexport default withCms(nextConfig);   // wherever you export your config`;
}
/** The root layout item of the list when init did not edit the file. */
const layoutManualStep = (file, reason) => `Add suppressHydrationWarning to the <html> tag in ${file} (init did not edit it: ${reason}):\n<html lang="en" suppressHydrationWarning>\nThe admin's theme provider sets a class on <html> before React hydrates; without it the first admin screen logs a hydration mismatch.`;
/** `next.config` files init cannot edit, or must not create a second one next to. */
const OTHER_NEXT_CONFIGS = ["next.config.cjs", "next.config.mts", "next.config.cts"];
/** Runs the whole of `monti init` in `options.cwd`. Throws {@link InitCancelled} when the person cancels, {@link InitError} when a write fails. */
export async function initProject(options) {
    const { cwd } = options;
    const host = { ...defaultInitHost, ...options.host };
    const log = options.log ?? (() => undefined);
    const dryRun = options.dryRun === true;
    const prompter = options.prompter;
    const app = detectApp(cwd);
    if (!app.next) {
        throw new Error("`next` is not in the dependencies of package.json. `monti init` adds Monti to an existing Next app (App Router); create one with `npx create-next-app@latest` first.");
    }
    if (app.pagesRouterOnly) {
        throw new Error(`This app only has a pages/ folder. Monti needs the App Router: add an ${app.src ? "src/app" : "app"}/ folder (it can sit next to pages/), then run \`monti init\` again.`);
    }
    const manager = options.packageManager ?? app.packageManager;
    prompter?.intro(`Add Monti to ${app.packageName ?? "this app"}`);
    const detectedLine = [
        `Next ${app.next.replace(/^[\^~]/, "")} (App Router${app.src ? ", src/" : ""})`,
        manager,
        app.typescript ? "TypeScript" : "no TypeScript",
    ].join(" · ");
    prompter?.note([
        detectedLine,
        ...app.contentFolders.map((folder) => `Found ${folder.files} Markdown/MDX file${folder.files === 1 ? "" : "s"} in ${folder.dir}/${folder.locales ? ` (${folder.locales.map((locale) => locale.code).join(", ")})` : ""}`),
    ].join("\n"), "Detected");
    const answers = await collectAnswers(app, options, prompter);
    const foundLocales = detectedLocales(app);
    // Plan the files.
    const writer = new ProjectWriter(cwd);
    const root = app.src ? "src/" : "";
    const configFile = `${root}monti.config.ts`;
    const schemaFile = `${root}monti.schema.ts`;
    const adminDir = posix(path.join(app.appDir, ...answers.adminPath.split("/").filter(Boolean)));
    const pageFile = `${adminDir}/[[...path]]/page.tsx`;
    const layoutFile = `${adminDir}/layout.tsx`;
    const routeFile = `${app.appDir}/api/cms/[...path]/route.ts`;
    const configImport = (from) => dotted(posix(path.relative(path.dirname(from), configFile.replace(/\.ts$/, ""))));
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
        skipped: [],
        overwritten: [],
        changed: [],
        installed: [],
        steps: [],
        notes: [],
        next: [],
    };
    if (foundLocales) {
        const where = foundLocales.from === "filename" ? "the file names" : "the folders";
        report.notes.push(options.locales === undefined && answers.locales.join(",") === foundLocales.codes.join(",")
            ? `The site languages are ${answers.locales.join(", ")}, found in ${where} of ${foundLocales.dir}/. ${answers.locales[0]} is the default${foundLocales.codes.length > 1 ? " (its files have no pair)" : ""}; change "defaultLocale" and "locales" in the schema file if that is wrong.`
            : `${foundLocales.codes.join(", ")} found in ${where} of ${foundLocales.dir}/, but the site languages are ${answers.locales.join(", ")}.`);
    }
    // The next config tells the admin page whether to opt out of the instant navigation check, and is the file init wraps in `withCms` (below).
    // Next's `cacheComponents` (on by default in the apps `create-next-app` 16.4 makes) validates every page for instant navigation in development; the admin opts out.
    const nextConfigText = app.nextConfig === undefined ? undefined : writer.read(app.nextConfig);
    const usesCacheComponents = nextConfigText !== undefined && /\bcacheComponents\s*:\s*true\b/.test(nextConfigText);
    // Files to write when they do not exist yet.
    const planned = [];
    const keepConfig = app.existingConfig !== undefined || app.legacyConfig.length > 0;
    if (app.legacyConfig.length > 0 && app.existingConfig === undefined) {
        report.notes.push(`${app.legacyConfig.join(" and ")} from the earlier setup ${app.legacyConfig.length > 1 ? "are" : "is"} left alone, and no ${configFile} was created. They are one ${configFile} now: move them into it (see "Upgrading" in the core README).`);
    }
    const existingText = app.existingConfig === undefined ? "" : writer.read(app.existingConfig);
    if (answers.directiveSyntax && keepConfig && !existingText.includes("directiveSyntax")) {
        report.notes.push("The directive syntax is on: add mdx({ syntax: [directiveSyntax()] }) (from @monti-cms/syntax-directive) to your existing config.");
    }
    if (!keepConfig) {
        planned.push({ file: configFile, content: configTemplate(answers) });
        const folder = app.contentFolders[0];
        planned.push({ file: schemaFile, content: schemaTemplate(answers, { siteName: app.packageName, folder }) });
        if (folder) {
            const keys = folder.keys.map((key) => key.name);
            report.notes.push(`The post collection follows the front matter of ${folder.dir}/ (${keys.length > 0 ? keys.slice(0, 8).join(", ") : "no front matter found"}), at the path ${pathFor(folder)}. Keys that have no matching field kind are text fields; edit ${schemaFile} to fit.`, ...starterCollections(folder.keys, answers.locales.length > 1).notes);
        }
    }
    else if (app.existingConfig !== undefined) {
        report.skipped.push(app.existingConfig);
        report.notes.push(`${app.existingConfig} already exists, so it was kept and no schema file was written. Add the plugins you want to it by hand; each one is one line (see .env.example for the values).`);
    }
    // The two edits to files the app owns, planned with the new files: an edit is applied only when the file is in a shape init can change safely, else its
    // step goes to the list of what is left, with the reason.
    const edits = [];
    const manual = [];
    const planEdit = (file, edit, manualStep) => {
        if (edit.status === "edit")
            edits.push({ file, text: edit.text, change: edit.change });
        else if (edit.status === "present")
            report.skipped.push(file);
        else
            manual.push(manualStep(edit.reason));
    };
    if (app.nextConfig !== undefined && nextConfigText !== undefined) {
        const file = app.nextConfig;
        planEdit(file, wrapNextConfig(file, nextConfigText), (reason) => nextConfigManualStep(file, reason));
    }
    else {
        const other = OTHER_NEXT_CONFIGS.find((candidate) => writer.exists(candidate));
        if (other) {
            manual.push(nextConfigManualStep(other, "it is not a file init can edit, and a second next.config next to it would be ignored or conflict"));
        }
        else
            planned.push({ file: "next.config.ts", content: nextConfigTemplate() });
    }
    const rootLayout = findRootLayout(cwd);
    if (rootLayout) {
        planEdit(rootLayout, addSuppressHydrationWarning(rootLayout, writer.read(rootLayout)), (reason) => layoutManualStep(rootLayout, reason));
    }
    // .env.local holds the secrets and migrate writes its logs under .monti/: neither belongs in git.
    const gitignore = writer.exists(".gitignore") ? writer.read(".gitignore") : undefined;
    planEdit(".gitignore", ignoreForMonti(gitignore), () => "");
    planned.push({ file: pageFile, content: adminPageTemplate(configImport(pageFile), { instant: usesCacheComponents }) }, { file: layoutFile, content: adminLayoutTemplate(configImport(layoutFile), { blocks: answers.blocks.length > 0 }) }, { file: routeFile, content: apiRouteTemplate(configImport(routeFile)) }, { file: ".env.example", content: envExampleTemplate(answers) });
    // Existing files: skipped, unless the person says to replace them.
    const writes = [];
    for (const entry of planned) {
        if (!writer.exists(entry.file)) {
            writes.push({ ...entry, replace: false });
            continue;
        }
        if (writer.read(entry.file) === entry.content) {
            report.skipped.push(entry.file);
            continue;
        }
        const replace = options.overwrite === true ||
            (prompter !== undefined &&
                (await prompter.confirm({
                    message: `${entry.file} already exists and differs. Overwrite it?`,
                    initial: false,
                })));
        if (replace)
            writes.push({ ...entry, replace: true });
        else {
            report.skipped.push(entry.file);
            report.notes.push(`${entry.file} already exists and was kept. Run with --overwrite to replace it.`);
        }
    }
    // What gets installed, and whether the person agrees to run it (default yes). `--yes`, `--json` and a missing terminal accept without asking.
    const missing = packagesFor(answers).filter((name) => !app.dependencies.has(name));
    const installCommand = addCommand(manager, installSpecs(missing, app.coreSpec), cwd);
    let installing = options.install !== false;
    let declined = false;
    if (installing && missing.length > 0 && prompter && !dryRun) {
        installing = await prompter.confirm({
            message: `Install the ${missing.length} Monti packages with \`${commandText(installCommand)}\`?`,
            initial: true,
        });
        declined = !installing;
    }
    // ---- Apply ----
    try {
        for (const entry of writes) {
            if (!dryRun)
                writer.write(entry.file, entry.content);
            (entry.replace ? report.overwritten : report.created).push(entry.file);
        }
        for (const edit of edits) {
            if (!dryRun)
                writer.write(edit.file, edit.text);
            report.changed.push({ file: edit.file, change: edit.change });
        }
    }
    catch (error) {
        throw new InitError(error instanceof Error ? error.message : String(error), writer.written);
    }
    report.skipped = [...new Set(report.skipped)];
    if (!dryRun)
        log(`Wrote ${writer.written.length} file${writer.written.length === 1 ? "" : "s"}`);
    // The package install is the one step init runs after the files: it is recorded, so a failure is named.
    const installed = await runInstallStep({
        cwd,
        host,
        log,
        dryRun,
        manager,
        report,
        installing,
        declined,
        packages: missing,
        specs: installSpecs(missing, app.coreSpec),
    });
    // ---- What is left: the changes to files the app owns, then the setup, each with exact content ----
    const todo = [];
    if (!app.typescript) {
        todo.push("Add TypeScript (monti.config.ts and the Next files are .ts/.tsx): " +
            commandText(addCommand(manager, ["typescript", "@types/react", "@types/node"], cwd, true)));
    }
    const hasFailure = report.steps.some((step) => step.status === "failed");
    const willInstall = installed || (dryRun && installing);
    if (missing.length > 0 && !willInstall)
        todo.push(`Install the packages:\n${commandText(installCommand)}`);
    todo.push(...manual);
    todo.push([
        "Create .env.local from the example and fill it in (.env.example says what each value is and where to get it):",
        "cp .env.example .env.local",
        "MONTI_SECRET is a long random value. Generate one with:",
        "openssl rand -base64 32",
        "or, without openssl:",
        `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`,
    ].join("\n"));
    todo.push(`Create the tables: ${exec(manager, "migrate")}`, `Check the setup: ${exec(manager, "doctor")}\nIt lists every check as ok, warn or fail, and \`monti doctor\` will tell you if any of the steps above is missing.`, `Start the app: ${script(manager, "dev")}, then open ${answers.siteUrl}${answers.adminPath}`);
    if (answers.gitSync) {
        todo.push(`Name the repo to sync: add a target to gitSync() in ${configFile}, then open ${answers.adminPath}/git-sync to save the GitHub token.`);
    }
    const siteBase = answers.siteUrl.replace(/\/+$/, "");
    const local = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/i.test(siteBase);
    const deployedAdmin = `${local ? "<your site>" : siteBase}${answers.adminPath}`;
    if (answers.login === "github") {
        todo.push([
            "Create the GitHub OAuth app that signs people in (GitHub > Settings > Developer settings > OAuth Apps > New OAuth App):",
            `  Homepage URL: ${answers.siteUrl}`,
            `  Authorization callback URL: ${githubCallbackUrl(answers.siteUrl)}`,
            "Then put its Client ID in AUTH_GITHUB_ID and a new client secret in AUTH_GITHUB_SECRET, and your numeric GitHub id in MONTI_ADMIN_GITHUB_ID (.env.example says where to find it).",
            "Under `next dev` you are the admin without signing in; the GitHub login applies once the app is deployed.",
        ].join("\n"));
    }
    else {
        todo.push([
            `Right after you deploy, open ${deployedAdmin} and create the first admin (an email and a password). That screen closes as soon as one admin exists.`,
            `Or create it beforehand: run the app in production mode (\`${script(manager, "build")}\` then \`${manager === "npm" || manager === "bun" ? `${manager} run start` : `${manager} start`}\`) pointed at the production database (its DATABASE_URL) and open ${answers.adminPath} on this machine. (Under \`next dev\` you are the admin without signing in, so that screen does not show.)`,
            `A forgotten password: ${exec(manager, "admin:reset-password")}`,
        ].join("\n"));
    }
    report.next.unshift(...todo);
    if (hasFailure)
        report.ok = false;
    return report;
}
// ---- The step after the files are written ----
/**
 * Installs the packages and records it in `report.steps`. A failure is recorded as failed (and `report.ok` turns false); running `monti init` again installs
 * what is still missing. Returns whether the packages are in place. Nothing here throws.
 */
async function runInstallStep(input) {
    const { cwd, host, log, dryRun, manager, report } = input;
    if (input.packages.length === 0)
        return true;
    report.installed = [...input.packages];
    const record = (status, detail) => report.steps.push({ name: "Install packages", status, detail });
    if (!input.installing) {
        record("skipped", input.declined ? "you answered no" : "--no-install");
        return false;
    }
    if (dryRun) {
        record("planned", commandText(addCommand(manager, input.specs, cwd)));
        return false;
    }
    log(`Installing ${input.packages.length} packages with ${manager} ...`);
    try {
        await host.install(addCommand(manager, input.specs, cwd));
        record("done", `${input.packages.length} packages with ${manager}`);
        return true;
    }
    catch (error) {
        report.ok = false;
        record("failed", error instanceof Error ? error.message : String(error));
        return false;
    }
}
const WORDS = {
    done: "done",
    skipped: "skipped",
    failed: "FAILED",
    planned: "planned",
};
/** Where Monti's files go and why, so the paths in the lists below make sense. */
export const placementLine = (src) => src
    ? "Your app uses src/app, so Monti's files are in src/ (next to app/)."
    : "Your app uses app/, so Monti's files are in the project root (next to app/).";
/** The plain summary: what was done, then what is left, numbered. */
export function formatInitReport(report) {
    const dry = report.dryRun;
    const list = (title, items) => items.length === 0 ? [] : [title, ...items.map((item) => `  - ${item}`), ""];
    const out = [];
    const failedCount = report.steps.filter((step) => step.status === "failed").length;
    out.push(dry
        ? "Dry run: nothing was written. This is what would happen."
        : failedCount > 0
            ? `Monti is only partly added: ${failedCount === 1 ? "1 step failed" : `${failedCount} steps failed`}. The files are written; the steps below did not finish.`
            : "Monti is added to your app.", "");
    out.push(placementLine(report.app.src), "");
    out.push(...list(dry ? "Would create:" : "Created:", report.created), ...(report.changed.length === 0
        ? []
        : [
            dry ? "Would change:" : "Changed:",
            ...report.changed.map((item) => `  - ${item.file} \u2014 ${item.change}`),
            "",
        ]), ...list(dry ? "Would replace:" : "Replaced (you said yes):", report.overwritten), ...list("Already there, left as they are:", report.skipped));
    if (report.steps.length > 0) {
        out.push("Steps:");
        for (const step of report.steps)
            out.push(`  - ${step.name}: ${WORDS[step.status]}${step.detail ? ` (${step.detail})` : ""}`);
        out.push("");
    }
    if (report.notes.length > 0) {
        out.push("Notes:", ...report.notes.map((note) => `  - ${note.replaceAll("\n", "\n    ")}`), "");
    }
    if (report.next.length > 0) {
        out.push("What is left:");
        for (const [index, step] of report.next.entries())
            out.push(`  ${index + 1}. ${step.replaceAll("\n", "\n     ")}`);
    }
    return out.join("\n").trimEnd();
}
export { InitCancelled };
