/**
 * Writes a file the way the preview script needs it: never through a symlink. A symlink at the path (for example `.env.local` linked to a file
 * outside the repo) is removed first, and a regular file takes its place, so the link's target is never touched.
 */
import { lstatSync, rmSync, writeFileSync } from "node:fs";

/** Returns `true` when a symlink was replaced. */
export function writeRegularFile(file, content) {
	let replaced = false;
	try {
		replaced = lstatSync(file).isSymbolicLink();
	} catch (error) {
		if (error?.code !== "ENOENT") throw error;
	}
	if (replaced) rmSync(file);
	writeFileSync(file, content);
	return replaced;
}
