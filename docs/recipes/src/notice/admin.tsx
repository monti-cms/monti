"use client";

import { BlockFrame, Content, defineAdminPlugin, useBlockEditor } from "@monti-cms/admin";

function NoticeView() {
	const block = useBlockEditor<{ level: string; title: string }>();
	const level = block.values.level === "warn" ? "warn" : "info";
	return (
		<BlockFrame>
			<div contentEditable={false}>
				<button type="button" onClick={() => block.setValue("level", level === "warn" ? "info" : "warn")}>
					{level}
				</button>
				<input
					aria-label="Title"
					value={block.values.title ?? ""}
					onChange={(e) => block.setValue("title", e.target.value)}
				/>
			</div>
			<Content />
		</BlockFrame>
	);
}

export default defineAdminPlugin({ components: { blockViews: { notice: NoticeView } } }); // by block name
