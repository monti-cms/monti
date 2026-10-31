import path from "node:path";
import { pathFor, starterCollections } from "./field-mapping";
import type { InitAnswers } from "./init-answers";
import type { DetectedApp } from "./init-detect";
import {
	addSuppressHydrationWarning,
	ignoreForMonti,
	NEXT_CONFIG_IMPORT,
	type TextEdit,
	wrapNextConfig,
} from "./init-edit";
import { detectedLocales } from "./init-prompts";
import type { ProjectWriter } from "./init-writer";
import { findOtherNextConfig, findRootLayout, montiNextFilePath, montiNextFiles } from "./next-app";
import type { Prompter } from "./prompt";
import {
	adminLayoutTemplate,
	adminPageTemplate,
	apiRouteTemplate,
	configTemplate,
	envExampleTemplate,
	nextConfigTemplate,
	schemaTemplate,
} from "./templates";

/**
 * The plan stage of `monti init`: from what was found in the app and what was answered, which files get written, which of the app's own files get edited, and what
 * cannot be done safely and is left to the person. Reads files (to compare and to edit their text); writes none.
 */

/** A file `monti init` writes: new, or replacing one the person said to replace. */
export interface PlannedWrite {
	readonly file: string;
	readonly content: string;
	readonly replace: boolean;
}

/** An edit to a file of the app that exists. */
export interface PlannedEdit {
	readonly file: string;
	readonly text: string;
	readonly change: string;
}

export interface InitPlan {
	readonly writes: readonly PlannedWrite[];
	readonly edits: readonly PlannedEdit[];
	/** Steps for the files init could not edit safely, with the reason, ready for the list of what is left. */
	readonly manual: readonly string[];
	/** Files that are already as they should be, or that were kept. */
	readonly skipped: readonly string[];
	/** Things worth knowing that need no action. */
	readonly notes: readonly string[];
	/** The config file (relative to the project), existing or new. */
	readonly configFile: string;
}

const posix = (file: string) => file.split(path.sep).join("/");
const dotted = (file: string) => (file.startsWith(".") ? file : `./${file}`);

/** The `next.config` item of the list when init did not edit the file: the reason, then the change by hand against the shape of the file. */
function nextConfigManualStep(file: string, reason: string): string {
	return `Wrap the config in ${file} (init did not edit it: ${reason}). Add this import at the top:\n${NEXT_CONFIG_IMPORT}\nand export the result of withCms around the config you export now:\nexport default withCms(nextConfig);   // wherever you export your config`;
}

/** The one line that says which time zone the site got and why: automatic is fine, silent is not. */
export const timeZoneNote = (answers: Pick<InitAnswers, "timeZone" | "timeZoneSource">, schemaFile: string): string => {
	const from =
		answers.timeZoneSource === "flag"
			? "from --time-zone"
			: answers.timeZoneSource === "computer"
				? "from this computer"
				: "this computer's time zone could not be read";
	return `Time zone: ${answers.timeZone} (${from}). Dates on your site and scheduled publishing use it; change \`timeZone\` in ${schemaFile} if your readers are elsewhere.`;
};

/** The root layout item of the list when init did not edit the file. */
const layoutManualStep = (file: string, reason: string): string =>
	`Add suppressHydrationWarning to the <html> tag in ${file} (init did not edit it: ${reason}):\n<html lang="en" suppressHydrationWarning>\nThe admin's theme provider sets a class on <html> before React hydrates; without it the first admin screen logs a hydration mismatch.`;

/** What the plan needs besides the app and the answers. */
export interface PlanInput {
	readonly cwd: string;
	readonly app: DetectedApp;
	readonly answers: InitAnswers;
	/** The `--locales` flag was given (so the languages found in the files are not what was chosen). */
	readonly localesFlag: boolean;
	/** Replace existing files that differ, without asking. */
	readonly overwrite: boolean;
	/** Asked whether to replace a file that exists and differs. */
	readonly prompter?: Prompter;
	readonly writer: ProjectWriter;
}

/** The note about the languages found in the file names or folders of the content, if any. */
export function localeNote(app: DetectedApp, answers: InitAnswers, localesFlag: boolean): string | undefined {
	const found = detectedLocales(app);
	if (!found) return undefined;
	const where = found.from === "filename" ? "the file names" : "the folders";
	return !localesFlag && answers.locales.join(",") === found.codes.join(",")
		? `The site languages are ${answers.locales.join(", ")}, found in ${where} of ${found.dir}/. ${answers.locales[0]} is the default${found.codes.length > 1 ? " (its files have no pair)" : ""}; change "defaultLocale" and "locales" in the schema file if that is wrong.`
		: `${found.codes.join(", ")} found in ${where} of ${found.dir}/, but the site languages are ${answers.locales.join(", ")}.`;
}

/** Plans `monti init` for the app and the answers. May ask whether to replace a file that exists and differs. */
export async function planProject(input: PlanInput): Promise<InitPlan> {
	const { cwd, app, answers, writer } = input;
	const root = app.src ? "src/" : "";
	const configFile = `${root}monti.config.ts`;
	const schemaFile = `${root}monti.schema.ts`;
	const fileOf = (id: "layout" | "page" | "route") => {
		const file = montiNextFiles(answers.adminPath).find((item) => item.id === id);
		return montiNextFilePath(app.appDir, file as NonNullable<typeof file>);
	};
	const pageFile = fileOf("page");
	const layoutFile = fileOf("layout");
	const routeFile = fileOf("route");
	const configImport = (from: string) =>
		dotted(posix(path.relative(path.dirname(from), configFile.replace(/\.ts$/, ""))));

	const notes: string[] = [];
	const skipped: string[] = [];
	const note = localeNote(app, answers, input.localesFlag);
	if (note) notes.push(note);

	// The next config tells the admin page whether to opt out of the instant navigation check, and is the file init wraps in `withCms` (below).
	// Next's `cacheComponents` (on by default in the apps `create-next-app` 16.4 makes) validates every page for instant navigation in development; the admin opts out.
	const nextConfigText = app.nextConfig === undefined ? undefined : writer.read(app.nextConfig);
	const usesCacheComponents = nextConfigText !== undefined && /\bcacheComponents\s*:\s*true\b/.test(nextConfigText);

	// Files to write when they do not exist yet.
	const planned: { file: string; content: string }[] = [];
	const existingText = app.existingConfig === undefined ? "" : writer.read(app.existingConfig);
	if (answers.directiveSyntax && app.existingConfig !== undefined && !existingText.includes("directiveSyntax")) {
		notes.push(
			"The directive syntax is on: add mdx({ syntax: [directiveSyntax()] }) (from @monti-cms/syntax-directive) to your existing config.",
		);
	}
	if (app.existingConfig === undefined) {
		planned.push({ file: configFile, content: configTemplate(answers) });
		const folder = app.contentFolders[0];
		planned.push({ file: schemaFile, content: schemaTemplate(answers, { siteName: app.packageName, folder }) });
		notes.push(timeZoneNote(answers, schemaFile));
		if (folder) {
			const keys = folder.keys.map((key) => key.name);
			notes.push(
				`The post collection follows the front matter of ${folder.dir}/ (${keys.length > 0 ? keys.slice(0, 8).join(", ") : "no front matter found"}), at the path ${pathFor(folder)}. Keys that have no matching field kind are text fields; edit ${schemaFile} to fit.`,
				...starterCollections(folder.keys, answers.locales.length > 1).notes,
			);
		}
	} else {
		skipped.push(app.existingConfig);
		notes.push(
			`${app.existingConfig} already exists, so it was kept and no schema file was written. Add the plugins you want to it by hand; each one is one line (see .env.example for the values).`,
		);
	}

	// The edits to files the app owns, planned with the new files: an edit is applied only when the file is in a shape init can change safely, else its
	// step goes to the list of what is left, with the reason.
	const edits: PlannedEdit[] = [];
	const manual: string[] = [];
	const planEdit = (file: string, edit: TextEdit, manualStep: (reason: string) => string) => {
		if (edit.status === "edit") edits.push({ file, text: edit.text, change: edit.change });
		else if (edit.status === "present") skipped.push(file);
		else manual.push(manualStep(edit.reason));
	};
	if (app.nextConfig !== undefined && nextConfigText !== undefined) {
		const file = app.nextConfig;
		planEdit(file, wrapNextConfig(file, nextConfigText), (reason) => nextConfigManualStep(file, reason));
	} else {
		const other = findOtherNextConfig(cwd);
		if (other) {
			manual.push(
				nextConfigManualStep(
					other,
					"it is not a file init can edit, and a second next.config next to it would be ignored or conflict",
				),
			);
		} else planned.push({ file: "next.config.ts", content: nextConfigTemplate() });
	}
	const rootLayout = findRootLayout(cwd);
	if (rootLayout) {
		planEdit(rootLayout, addSuppressHydrationWarning(rootLayout, writer.read(rootLayout)), (reason) =>
			layoutManualStep(rootLayout, reason),
		);
	}
	// .env.local holds the secrets and db:migrate writes its logs under .monti/: neither belongs in git.
	const gitignore = writer.exists(".gitignore") ? writer.read(".gitignore") : undefined;
	planEdit(".gitignore", ignoreForMonti(gitignore), (reason) => reason);
	planned.push(
		{ file: pageFile, content: adminPageTemplate(configImport(pageFile), { instant: usesCacheComponents }) },
		{ file: layoutFile, content: adminLayoutTemplate(configImport(layoutFile), { blocks: answers.blocks.length > 0 }) },
		{ file: routeFile, content: apiRouteTemplate(configImport(routeFile)) },
		{ file: ".env.example", content: envExampleTemplate(answers) },
	);

	// Existing files: skipped, unless the person says to replace them.
	const writes: PlannedWrite[] = [];
	for (const entry of planned) {
		if (!writer.exists(entry.file)) {
			writes.push({ ...entry, replace: false });
			continue;
		}
		if (writer.read(entry.file) === entry.content) {
			skipped.push(entry.file);
			continue;
		}
		const replace =
			input.overwrite ||
			(input.prompter !== undefined &&
				(await input.prompter.confirm({
					message: `${entry.file} already exists and differs. Overwrite it?`,
					initial: false,
				})));
		if (replace) writes.push({ ...entry, replace: true });
		else {
			skipped.push(entry.file);
			notes.push(`${entry.file} already exists and was kept. Run with --overwrite to replace it.`);
		}
	}
	return { writes, edits, manual, skipped: [...new Set(skipped)], notes, configFile };
}
