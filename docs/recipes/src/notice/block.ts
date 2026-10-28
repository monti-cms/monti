import { defineBlock } from "@monti-cms/core";

export const noticeBlock = defineBlock({
	name: "notice",
	label: "Notice",
	syntax: { kind: "container", directive: "notice" },
	component: "Notice", // the JSX name in MDX
	attributes: {
		level: { type: "string", label: "Level", options: { info: "Info", warn: "Warning" }, defaultValue: "info" },
		title: { type: "string", label: "Title", translatable: true },
	},
	translateInside: true,
	editor: {
		view: "node",
		insertable: true,
		icon: "chat",
		insert: { values: { level: "info" }, text: "Content" },
	},
	// Findings are warnings: they show under the block and come back as `warnings`, but never block the save.
	validate: (node) =>
		node.attributes.level === "warn" && !String(node.attributes.title ?? "").trim()
			? [{ code: "notice_warning_needs_title", message: "A warning notice needs a title." }]
			: [],
});
