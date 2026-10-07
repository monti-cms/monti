/**
 * Reads a schema file from disk (`defineConfig({ schema: "./monti.schema.json" })`, `monti schema:types`). Node only: `node:fs` is taken from the running process, so
 * importing this module costs a browser bundle nothing, and calling it there throws a clear error. A relative path is relative to the working directory.
 *
 * A bundled app (Next) should import the file instead (`import schema from "./monti.schema.json"`): the bundler then ships it with the build. Reading by path needs the
 * file to be on disk at run time.
 */
export function readSchemaFile(file: string): unknown {
	const nodeFs = typeof process === "undefined" ? undefined : process.getBuiltinModule?.("node:fs");
	if (!nodeFs) {
		throw new Error(
			`cms.config: schema "${file}" cannot be read by path here (no file system); import the JSON file and pass its content instead`,
		);
	}
	let raw: string;
	try {
		raw = nodeFs.readFileSync(file, "utf8");
	} catch (error) {
		const code = (error as NodeJS.ErrnoException).code;
		throw new Error(
			`cms.config: cannot read schema file "${file}" (${code === "ENOENT" ? "not found, relative to the working directory" : (error as Error).message})`,
		);
	}
	try {
		return JSON.parse(raw);
	} catch (error) {
		throw new Error(`${file} is not valid JSON: ${(error as Error).message}`);
	}
}
