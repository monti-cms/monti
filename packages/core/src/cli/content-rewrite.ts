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
	const cms = await loadApp(options);
	try {
		await cms.rewrite({ apply: options.apply, log: options.log ?? console.log });
		return true;
	} catch (error) {
		console.error("Rewrite failed:", error);
		return false;
	} finally {
		await cms.close();
	}
}
