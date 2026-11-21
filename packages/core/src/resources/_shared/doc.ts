import { MontiError } from "../../engine/errors";
import type { ReadContext } from "../../engine/types";
import type { Block, Doc } from "../../rich-text/types";
import { validateDoc } from "../../rich-text/validate-doc";

/** The body checked against the config's blocks and marks; rejects it with every problem in `details`. */
export function docOf(body: unknown, ctx: ReadContext): Doc {
	const issues = validateDoc(body, ctx.config);
	if (issues.length > 0) throw new MontiError("BAD_REQUEST", "The body is not a valid document", issues);
	return body as Doc;
}

/** 블록과 그 자식들이 `attrs.mediaId`나 `attrs.mediaIds`로 참조하는 모든 미디어 `id`. 소문자로, 한 번씩. */
export function mediaIdsOf(blocks: readonly Block[], ids = new Set<string>()): Set<string> {
	for (const block of blocks) {
		const { mediaId, mediaIds } = block.attrs ?? {};
		if (typeof mediaId === "string") ids.add(mediaId.toLowerCase());
		// 본문은 `validateDoc`을 통과해 `mediaIds`가 UUID 문자열 배열이다.
		if (Array.isArray(mediaIds)) for (const id of mediaIds as string[]) ids.add(id.toLowerCase());
		mediaIdsOf(block.children ?? [], ids);
	}
	return ids;
}
