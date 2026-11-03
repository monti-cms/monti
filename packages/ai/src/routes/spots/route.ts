import { adminRoute, ok, parseWith, readJsonBody } from "@monti-cms/core/server";
import { z } from "zod";
import { editorProposalViews } from "../../agent/entry-proposals";
import { askAtSelection } from "../../agent/spot";
import { loadAgentRuntime } from "../../settings";
import { aiStoreFor } from "../../store";

const spotBodySchema = z.object({
	entry: z.string().min(1),
	words: z.string().trim().min(1).max(2000),
	text: z.string().trim().min(1).max(2000),
});

/**
 * A request on words selected in the editor: the assistant writes the block that holds them again, as a proposal of its own. Answers with the change as the
 * editor draws it (`item: null` when the answer was the block as it is).
 */
export const POST = adminRoute(async ({ request, cms, auth }) => {
	const { entry, words, text } = parseWith(spotBodySchema, await readJsonBody(request));
	const store = aiStoreFor(cms);
	const runtime = await loadAgentRuntime(cms.site, store);
	const { proposal, itemId } = await askAtSelection({
		cms,
		auth,
		store: store.proposals,
		model: runtime.model,
		entryId: entry,
		words,
		text,
		rules: await store.getWritingRules(),
		recordUsage: runtime.recordUsage,
		signal: request.signal,
	});
	const item = itemId ? (editorProposalViews([proposal], entry).find((view) => view.id === itemId) ?? null) : null;
	return ok({ item });
});
