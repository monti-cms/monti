import type { BlockProps, LooseDocumentComponents } from "@monti-cms/core/render";
import type { noticeBlock } from "./definition";

/** The public component. The block's attributes arrive as flat props, typed from the definition (`level` is `"info" | "warn"`). */
export function Notice({ level, title, children }: BlockProps<typeof noticeBlock>) {
	return (
		<aside data-notice-level={level} role={level === "warn" ? "alert" : "note"}>
			{title ? <strong>{title}</strong> : null}
			{children}
		</aside>
	);
}

/** What `renderDocument` and `<CmsContent />` read from a plugin's `render` module: the components by block name. */
export const documentComponents = (): LooseDocumentComponents => ({ blocks: { notice: Notice } });
