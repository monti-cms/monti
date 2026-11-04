"use client";

import { useTranslator } from "@monti-cms/core/site";
import { Banner } from "@monti-cms/ui";
import { useBlockIssues } from "./block-issues-context";
import { blocksMessages } from "./messages";

/** The warnings of a block, under it. Not editable text: it stays out of the document. */
export function BlockIssueNotice({ blockId }: { blockId: string | null }) {
	const t = useTranslator(blocksMessages);
	const texts = useBlockIssues(blockId);
	if (texts.length === 0) return null;
	return (
		<Banner
			contentEditable={false}
			data-monti-block-issues=""
			aria-label={t("issues.label")}
			tone="warning"
			lines={texts}
		/>
	);
}
