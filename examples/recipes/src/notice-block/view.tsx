"use client";

import { BlockFrame, Content, useBlockEditor } from "@monti-cms/admin/hooks";

/** The editor view of a notice: the level is a button, the title an input, and `<Content />` is the editable body inside. A view takes no props. */
export function NoticeView() {
	const block = useBlockEditor<{ level: string; title: string }>();
	const level = block.values.level === "warn" ? "warn" : "info";
	return (
		<BlockFrame>
			<div data-notice-level={level} className="rounded-lg border p-3">
				<div contentEditable={false} className="flex gap-2">
					<button
						type="button"
						disabled={!block.editable}
						onClick={() => block.setValue("level", level === "warn" ? "info" : "warn")}
					>
						{level === "warn" ? "Warning" : "Info"}
					</button>
					<input
						aria-label="Title"
						value={block.values.title ?? ""}
						readOnly={!block.editable}
						onChange={(event) => block.setValue("title", event.target.value)}
					/>
				</div>
				<Content />
			</div>
		</BlockFrame>
	);
}
