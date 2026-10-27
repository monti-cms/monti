"use client";

import { useTranslator } from "@monti-cms/core/site";
import { useBlockIssues } from "./block-issues-context";
import { blocksMessages } from "./messages";

/** The warnings of a block, under it. Not editable text: it stays out of the document. */
export function BlockIssueNotice({ blockId }: { blockId: string | null }) {
	const t = useTranslator(blocksMessages);
	const texts = useBlockIssues(blockId);
	if (texts.length === 0) return null;
	return (
		<ul
			contentEditable={false}
			data-monti-block-issues=""
			aria-label={t("issues.label")}
			className="not-prose m-0 list-none space-y-monti-4 border-monti-warning/40 border-t bg-monti-warning-muted px-monti-12 py-monti-8 text-monti-caption text-monti-warning"
		>
			{texts.map((text) => (
				<li key={text} className="flex items-start gap-monti-8">
					{/* An inline icon, not lucide-react: block views are in the hooks graph, which stays free of icon and UI packages. */}
					{/* biome-ignore lint/a11y/noSvgWithoutTitle: decorative, hidden from assistive tech */}
					<svg
						aria-hidden
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
						className="mt-monti-2 size-3.5 shrink-0"
					>
						<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
						<path d="M12 9v4" />
						<path d="M12 17h.01" />
					</svg>
					<span className="min-w-0 break-words">{text}</span>
				</li>
			))}
		</ul>
	);
}
