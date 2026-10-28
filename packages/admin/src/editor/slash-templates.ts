/**
 * The templates in the "/" menu. A chosen template goes in at the cursor, in the place of the typed `/`, as a copy with new block ids: ids are unique within a
 * body, and the translation and diff views pair blocks by them, so the template's own ids must not end up in many entries. Nothing around the cursor is replaced.
 */

import { regenerateBlockIds } from "@monti-cms/core/document";
import { type BodyTemplate, type Site, useTranslator } from "@monti-cms/core/site";
import { useQuery } from "@tanstack/react-query";
import type { JSONContent } from "@tiptap/core";
import { useCallback, useMemo, useState } from "react";
import { listTemplates, templatesKeys } from "../api/templates";
import { sectionsLine } from "../screens/templates/template-model";
import type { TranslatorFor } from "../translator";
import type { EditorAllowance } from "./allowed";
import { editorMessages } from "./messages";
import type { SlashCommandItem } from "./slash-command";
import { type BoxPreview, storedToTiptap } from "./tiptap-content";

type Translator = TranslatorFor<typeof editorMessages>;

/** Whether every block and mark of the content is one the body's allowed list lets a writer add. A template that is not left out of the menu: it would be refused whole. */
export function templateFits(content: readonly JSONContent[], allowance: EditorAllowance): boolean {
	return content.every((node) => {
		if (node.type && node.type !== "text" && !allowance.allowsNode(node.type)) return false;
		if (node.type === "heading" && !allowance.allowsHeading(Number(node.attrs?.level))) return false;
		if (node.attrs?.textAlign && !allowance.allowsBlock("text-align")) return false;
		if (node.marks?.some((mark) => !allowance.allowsEditorMark(mark.type))) return false;
		return templateFits(node.content ?? [], allowance);
	});
}

/** The menu rows of the templates the body can take: the name, its sections under it, found by the name or by the group's own words. */
export function templateCommands({
	site,
	t,
	templates,
	allowance,
	boxPreview,
}: {
	site: Site;
	t: Translator;
	templates: readonly BodyTemplate[];
	allowance: EditorAllowance;
	boxPreview: BoxPreview | undefined;
}): SlashCommandItem[] {
	const words = t("slash.templateWords")
		.split(",")
		.map((word) => word.trim());
	return templates.flatMap((template) => {
		const content = storedToTiptap(
			site,
			{ ...template.doc, content: regenerateBlockIds(template.doc.content) },
			{ boxPreview },
		).content;
		if (!content?.length || !templateFits(content, allowance)) return [];
		return [
			{
				id: `template:${template.id}`,
				group: "templates" as const,
				title: template.name,
				description: "",
				caption: sectionsLine(template.doc),
				keywords: [template.name, ...words],
				// The typed `/query` goes, the template's blocks take its place.
				action: (editor, range) => {
					editor.chain().focus().deleteRange(range).insertContent(content).run();
				},
			},
		];
	});
}

/**
 * The template rows for the menu. The list is asked for the first time the menu opens (`ask`), not when the editor does: most posts never use one.
 * The answer stays in the query cache, which the templates page shares.
 */
export function useSlashTemplates({
	enabled,
	site,
	allowance,
	boxPreview,
}: {
	enabled: boolean;
	site: Site;
	allowance: EditorAllowance;
	boxPreview: BoxPreview | undefined;
}) {
	const [asked, setAsked] = useState(false);
	const query = useQuery({
		queryKey: templatesKeys.list(),
		queryFn: ({ signal }) => listTemplates(site, signal),
		enabled: enabled && asked,
	});
	const t = useTranslator(editorMessages);
	const templates = query.data;
	const items = useMemo(
		() => (enabled && templates ? templateCommands({ site, t, templates, allowance, boxPreview }) : []),
		[enabled, templates, site, t, allowance, boxPreview],
	);
	const ask = useCallback(() => setAsked(true), []);
	return { items, ask };
}
