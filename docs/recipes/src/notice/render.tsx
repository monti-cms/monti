import { type BlockProps, defineRender } from "@monti-cms/core/render";
import type { noticeBlock } from "./block";

function Notice({ level, title, children }: BlockProps<typeof noticeBlock>) {
	return (
		<aside role={level === "warn" ? "alert" : "note"}>
			{title ? <strong>{title}</strong> : null}
			{children}
		</aside>
	);
}

export default defineRender({ blocks: { notice: Notice } });
