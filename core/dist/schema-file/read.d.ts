/**
 * Reads a schema file from disk (`defineSite({ schema: "./monti.schema.json" })`, `monti schema:types`). Node only: `node:fs` is taken from the running process, so
 * importing this module costs a browser bundle nothing, and calling it there throws a clear error. A relative path is relative to the working directory.
 *
 * A bundled app (Next) should import the file instead (`import schema from "./monti.schema.json"`): the bundler then ships it with the build. Reading by path needs the
 * file to be on disk at run time.
 */
export declare function readSchemaFile(file: string): unknown;
