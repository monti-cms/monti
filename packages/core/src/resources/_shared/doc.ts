import { MontiError } from "../../engine/errors";
import type { ReadContext } from "../../engine/types";
import type { Doc } from "../../rich-text/types";
import { validateDoc } from "../../rich-text/validate-doc";

/** The body checked against the config's blocks and marks; rejects it with every problem in `details`. */
export function docOf(body: unknown, ctx: ReadContext): Doc {
	const issues = validateDoc(body, ctx.config);
	if (issues.length > 0) throw new MontiError("BAD_REQUEST", "The body is not a valid document", issues);
	return body as Doc;
}
