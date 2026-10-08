import { existsSync } from "node:fs";
import path from "node:path";

/** Whether `node_modules/<name>` exists in `from` or a folder above it (the order Node and the bundlers look packages up in). */
export function isPackageInstalled(from: string, name: string): boolean {
	for (let dir = path.resolve(from); ; dir = path.dirname(dir)) {
		if (existsSync(path.join(dir, "node_modules", name, "package.json"))) return true;
		if (path.dirname(dir) === dir) return false;
	}
}
