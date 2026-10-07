import { problemText } from "../core/problem";
import { ServiceError } from "../core/types";
import type { FormatRegistry } from "./registry";

/** The plugin each well-known format comes from, to name it in the message. */
const PROVIDERS: Readonly<Record<string, string>> = {
	mdx: "mdx() from @monti-cms/mdx",
};

/**
 * The error for a `format` option that names a format no plugin provides (the code stays `unknown_format`; the message says which plugin to add and which
 * formats this site has).
 */
export function unknownFormatError(name: string, registry: Pick<FormatRegistry, "list">): ServiceError {
	const available = registry.list().map((format) => format.name);
	const provider = PROVIDERS[name];
	return new ServiceError(
		"unknown_format",
		[{ code: "unknown_format", message: name, params: { format: name } }],
		problemText({
			what: `The format "${name}" is not available on this site, because no plugin provides it`,
			where: "`plugins` in monti.config.ts",
			fix: `${provider ? `add ${provider} to the list (install the package first)` : "add the plugin that provides it to the list"}${
				available.length > 0
					? `, or use one of the formats this site has: ${available.join(", ")}`
					: ", or leave `format` out"
			}`,
		}),
	);
}
