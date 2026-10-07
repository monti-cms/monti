"use client";

import { useTranslator } from "@monti-cms/core/client";
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
			data-cms-block-issues=""
			aria-label={t("issues.label")}
			className="not-prose m-0 list-none space-y-1 border-amber-500/40 border-t bg-amber-500/10 px-3 py-2 cms-dark:text-amber-400 text-amber-800 text-xs"
		>
			{texts.map((text) => (
				<li key={text} className="flex items-start gap-1.5">
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
						className="mt-0.5 size-3.5 shrink-0"
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
