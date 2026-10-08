import { defineBlock } from "@monti-cms/core";

/**
 * The block's data: its name, how it is stored, its attributes and how the editor offers it. Stored as MDX it is
 * `<Notice level="warn" title="Heads up">…</Notice>`, and with the directive notation `:::notice{level="warn"}`.
 */
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
		icon: "message-square",
		insert: { values: { level: "info" }, text: "Content" },
	},
	// Runs on the server for every notice, on every create, save, publish and bulk change. Its findings are warnings: they show under the block
	// in the editor and come back as `warnings` in the response, but they never block the save.
	validate: (node) =>
		node.attributes.level === "warn" && !String(node.attributes.title ?? "").trim()
			? [
					{
						code: "notice_warning_needs_title",
						message: "A warning notice needs a title, so readers see what it is about.",
					},
				]
			: [],
});
