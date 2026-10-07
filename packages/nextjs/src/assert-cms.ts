import { problemError } from "@monti-cms/core";

/**
 * Stops with a message that says what to change when a Next file got no CMS instance: the usual cause is an import of the wrong name or from the wrong file, and
 * the plain `Cannot read properties of undefined` that follows does not say so.
 */
export function assertCms(cms: unknown, caller: string): void {
	if (typeof cms === "object" && cms !== null) return;
	throw problemError({
		what: `${caller} got ${cms === undefined ? "undefined" : typeof cms} instead of the CMS instance`,
		where: "the import of `cms` at the top of this file",
		fix: 'import it from the config file, `import { cms } from "<path to>/monti.config"`, and make sure monti.config.ts exports it: `export const cms = defineConfig({ ... })`. `monti doctor` checks the three Next files',
	});
}
