import { adminRoute, ok, parseWith, readJsonBody } from "@monti-cms/core/server";
import { z } from "zod";
import { editorProposalViews } from "../../../../../../agent/entry-proposals";
import { askAtSpot } from "../../../../../../agent/spot";
import { loadAgentRuntime } from "../../../../../../settings";
import { aiStoreFor } from "../../../../../../store";

const askBodySchema = z.object({ text: z.string().trim().min(1).max(2000) });

/**
 * A request in the card of one body change: the assistant writes that block again. Answers with the change that took its place, as the editor draws it
 * (`item: null` when the assistant's answer was the block as it is, so nothing is proposed there any more).
 */
export const POST = adminRoute<{ id: string; itemId: string }>(async ({ request, params, cms, auth }) => {
	const { text } = parseWith(askBodySchema, await readJsonBody(request));
	const store = aiStoreFor(cms);
	const runtime = await loadAgentRuntime(cms.site, store);
	const { proposal, itemId } = await askAtSpot({
		cms,
		auth,
		store: store.proposals,
		model: runtime.model,
		proposalId: params.id,
		itemId: params.itemId,
		text,
		rules: await store.getWritingRules(),
		recordUsage: runtime.recordUsage,
		signal: request.signal,
	});
	const entryId = proposal.items.find((item) => item.id === itemId)?.target.id ?? "";
	const item = editorProposalViews([proposal], entryId).find((view) => view.id === itemId) ?? null;
	return ok({ item });
});
