import { type AppOptions, loadApp } from "./app";

export interface ContentRewriteOptions extends AppOptions {
	/** Write the changes. Without it the command only reports what would change. */
	readonly apply?: boolean;
}

/**
 * `monti content:rewrite`: re-serializes every stored body (working, published, templates) with the site's configured syntax, so the stored text is one notation.
 * A dry run unless `apply` is set. Returns `true` on success (bodies that are skipped are reported, not failures).
 */
export async function contentRewrite(options: ContentRewriteOptions): Promise<boolean> {
	loadApp(options);
	const { runRewrite } = await import("../adapters/postgres/run-rewrite");
	return runRewrite({ apply: options.apply, log: options.log ?? console.log });
}
