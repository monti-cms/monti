/**
 * Reads the default export of a config file. Where the app is compiled to CommonJS (e.g. when running the CLI with `tsx`),
 * this ES module package receives the `export default` value wrapped once more as `{ default: value }`.
 */
export function unwrapDefault<T>(imported: T): T {
	const value = imported as T & { default?: T; __esModule?: boolean };
	return value && typeof value === "object" && "default" in value && value.default !== undefined
		? value.default
		: imported;
}
