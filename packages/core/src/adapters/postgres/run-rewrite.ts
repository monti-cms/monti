import { cmsServerConfig } from "../../server/resolved";
import { formatRewriteReport, rewriteContent } from "./store/rewrite";

/**
 * Rewrites the stored bodies with the site's configured syntax (`monti content:rewrite`). Prints one line per body and a summary; writes only with `apply`.
 * Returns `true` on success.
 */
export async function runRewrite(options: {
	readonly apply?: boolean;
	readonly log?: (message: string) => void;
}): Promise<boolean> {
	const log = options.log ?? console.log;
	const { database } = cmsServerConfig;
	try {
		const { pool, schema } = database.pluginDatabase();
		const report = await rewriteContent(pool, { apply: options.apply, schema });
		for (const line of formatRewriteReport(report)) log(line);
		return true;
	} catch (err) {
		console.error("Rewrite failed:", err);
		return false;
	} finally {
		await database.close?.();
	}
}
