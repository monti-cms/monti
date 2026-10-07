import { problemError } from "../core/problem";

/**
 * Reads a schema file from disk (`defineSite({ schema: "./monti.schema.json" })`, `monti schema:types`). Node only: `node:fs` is taken from the running process, so
 * importing this module costs a browser bundle nothing, and calling it there throws a clear error. A relative path is relative to the working directory.
 *
 * A bundled app (Next) should import the file instead (`import schema from "./monti.schema.json"`): the bundler then ships it with the build. Reading by path needs the
 * file to be on disk at run time.
 */
export function readSchemaFile(file: string): unknown {
	const nodeFs = typeof process === "undefined" ? undefined : process.getBuiltinModule?.("node:fs");
	if (!nodeFs) {
		throw problemError({
			what: `The schema "${file}" cannot be read by path here, because there is no file system`,
			where: "`schema` in monti.config.ts",
			fix: 'import the JSON file and pass its content: `import schema from "./monti.schema.json"`',
		});
	}
	let raw: string;
	try {
		raw = nodeFs.readFileSync(file, "utf8");
	} catch (error) {
		const code = (error as NodeJS.ErrnoException).code;
		throw problemError({
			what: `The schema file "${file}" cannot be read (${code === "ENOENT" ? "it does not exist" : (error as Error).message})`,
			where: "`schema` in monti.config.ts",
			fix: `check the path (it is relative to the folder the server runs in, ${process.cwd()}), or import the JSON file and pass its content: \`import schema from "./monti.schema.json"\``,
		});
	}
	try {
		return JSON.parse(raw);
	} catch (error) {
		throw problemError(
			{
				what: `${file} is not valid JSON: ${(error as Error).message}`,
				where: file,
				fix: "correct the syntax at the position it names (a trailing comma, a missing quote or bracket, or a comment); an editor with JSON support underlines it",
			},
			error,
		);
	}
}
