import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { InitPlan } from "./init-plan";
import type { InitReport } from "./init-types";

/** The write stage of `monti init`: every file goes through {@link ProjectWriter}, which refuses a path outside the project. */

const posix = (file: string) => file.split(path.sep).join("/");

/** An error after files were already written. `written` lists them, so the message can say what is on disk. */
export class InitError extends Error {
	constructor(
		message: string,
		readonly written: readonly string[],
	) {
		super(
			written.length === 0
				? `${message}\n\nNothing was written.`
				: `${message}\n\nThese files were written before it failed (nothing was undone):\n${written.map((file) => `  - ${file}`).join("\n")}\nRun \`monti init\` again to continue: existing files are kept.`,
		);
		this.name = "InitError";
	}
}

/** Writes only inside the project folder: an absolute path, a `..` path, or a path that goes through a symlink out of the folder is refused. */
export class ProjectWriter {
	private readonly root: string;
	readonly written: string[] = [];

	constructor(cwd: string) {
		this.root = realpathSync(cwd);
	}

	/** The absolute path of `file` if it is inside the project, else throws. */
	resolve(file: string): string {
		if (path.isAbsolute(file) || file.split(/[\\/]/).includes("..")) {
			throw new Error(`Refusing to write ${file}: it is outside the project`);
		}
		const target = path.resolve(this.root, file);
		const inside = (candidate: string) => candidate === this.root || candidate.startsWith(this.root + path.sep);
		if (!inside(target)) throw new Error(`Refusing to write ${file}: it is outside the project`);
		// A symlinked folder on the way must not lead out either: check the deepest folder that exists.
		let probe = path.dirname(target);
		while (!existsSync(probe) && probe !== this.root) probe = path.dirname(probe);
		if (!inside(realpathSync(probe)))
			throw new Error(`Refusing to write ${file}: a folder on its path leads outside the project`);
		return target;
	}

	exists(file: string): boolean {
		return existsSync(this.resolve(file));
	}

	read(file: string): string {
		return readFileSync(this.resolve(file), "utf8");
	}

	write(file: string, content: string): void {
		const target = this.resolve(file);
		mkdirSync(path.dirname(target), { recursive: true });
		writeFileSync(target, content);
		this.written.push(posix(file));
	}
}

/**
 * Writes the plan: the new files (and the replaced ones), then the edits to the app's own files, and records each in the report. On a dry run nothing is written and the
 * report says what would be. Throws {@link InitError} when a write fails, naming the files already written.
 */
export function applyPlan(plan: InitPlan, writer: ProjectWriter, report: InitReport, dryRun: boolean): void {
	try {
		for (const entry of plan.writes) {
			if (!dryRun) writer.write(entry.file, entry.content);
			(entry.replace ? report.overwritten : report.created).push(entry.file);
		}
		for (const edit of plan.edits) {
			if (!dryRun) writer.write(edit.file, edit.text);
			report.changed.push({ file: edit.file, change: edit.change });
		}
	} catch (error) {
		throw new InitError(error instanceof Error ? error.message : String(error), writer.written);
	}
}
