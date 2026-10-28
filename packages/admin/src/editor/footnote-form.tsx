"use client";

import { Close } from "@carbon/icons-react";
import { useTranslator } from "@monti-cms/core/site";
import { Inline, Label, Stack, Text, Textarea } from "@monti-cms/ui";
import type { Editor } from "@tiptap/core";
import { type FormEvent, useId, useState } from "react";
import { FOOTNOTE_DEFINITION_NAME, FOOTNOTE_REFERENCE_NAME, footnoteKey, labelOf } from "./footnote-nodes";
import type { InlineBubbleTarget } from "./inline-marks";
import { PopoverFormError, PopoverFormFooter, submitOnEnter } from "./link-form";
import { editorMessages } from "./messages";

export interface FootnoteFormProps {
	editor: Editor;
	target: Extract<InlineBubbleTarget, { kind: "footnote" }>;
	onDone: () => void;
}

/** Updates the footnote definition block text for a given label in the editor document. */
export function setFootnoteDefinitionText(editor: Editor, label: string, text: string): boolean {
	const key = footnoteKey(label);
	const schema = editor.state.schema;
	const definitionType = schema.nodes[FOOTNOTE_DEFINITION_NAME];
	const paragraphType = schema.nodes.paragraph;
	if (!definitionType || !paragraphType) return false;

	const trimmed = text.trim();
	const lines = trimmed ? trimmed.split(/\n+/) : [];
	const paragraphs =
		lines.length > 0
			? lines.map((line) => (line ? paragraphType.create(null, schema.text(line)) : paragraphType.create()))
			: [paragraphType.create()];

	const newDefinition = definitionType.create({ label }, paragraphs);

	let defPos: number | null = null;
	let defNodeSize = 0;
	editor.state.doc.descendants((node, pos) => {
		if (node.type.name === FOOTNOTE_DEFINITION_NAME && footnoteKey(labelOf(node)) === key) {
			defPos = pos;
			defNodeSize = node.nodeSize;
			return false;
		}
	});

	return editor
		.chain()
		.focus()
		.command(({ tr }) => {
			if (defPos !== null) {
				tr.replaceWith(defPos, defPos + defNodeSize, newDefinition);
			} else {
				const last = tr.doc.lastChild;
				const at =
					last?.type.name === "paragraph" && last.content.size === 0 && tr.doc.childCount > 1
						? tr.doc.content.size - last.nodeSize
						: tr.doc.content.size;
				tr.insert(at, newDefinition);
			}
			return true;
		})
		.run();
}

/** Removes a footnote reference chip and its definition block if no other reference uses the label. */
export function removeFootnote(editor: Editor, target: { from: number; to: number; label: string }): boolean {
	const key = footnoteKey(target.label);
	return editor
		.chain()
		.focus()
		.command(({ tr }) => {
			tr.delete(target.from, target.to);

			let hasOtherRef = false;
			tr.doc.descendants((node) => {
				if (node.type.name === FOOTNOTE_REFERENCE_NAME && footnoteKey(labelOf(node)) === key) {
					hasOtherRef = true;
					return false;
				}
			});

			if (!hasOtherRef) {
				let defPos: number | null = null;
				let defSize = 0;
				tr.doc.descendants((node, pos) => {
					if (node.type.name === FOOTNOTE_DEFINITION_NAME && footnoteKey(labelOf(node)) === key) {
						defPos = pos;
						defSize = node.nodeSize;
						return false;
					}
				});
				if (defPos !== null) {
					tr.delete(defPos, defPos + defSize);
				}
			}
			return true;
		})
		.run();
}

export function FootnoteForm({ editor, target, onDone }: FootnoteFormProps) {
	const t = useTranslator(editorMessages);
	const id = useId();
	const [value, setValue] = useState(target.defText);
	const [error, setError] = useState<string | null>(null);

	const handleApply = (event: FormEvent<HTMLElement>) => {
		event.preventDefault();
		const trimmed = value.trim();
		if (!trimmed) {
			setError(t("inlineBubble.footnoteEmpty"));
			return;
		}
		setFootnoteDefinitionText(editor, target.label, trimmed);
		editor.chain().focus().setTextSelection(target.to).run();
		onDone();
	};

	const handleRemove = () => {
		removeFootnote(editor, target);
		onDone();
	};

	return (
		<Stack as="form" gap={12} onSubmit={handleApply} onKeyDown={submitOnEnter}>
			<Inline gap={8}>
				<Text variant="meta" tone="subtle">
					{target.badge}
				</Text>
				<Text weight="medium">{t("inlineBubble.footnotePanel")}</Text>
			</Inline>
			<Stack gap={8}>
				<Label htmlFor={`${id}-content`} size="caption">
					{t("inlineBubble.footnoteField")}
				</Label>
				<Textarea
					id={`${id}-content`}
					value={value}
					rows={3}
					placeholder={t("inlineBubble.footnotePlaceholder")}
					aria-invalid={!!error || undefined}
					aria-describedby={error ? `${id}-error` : undefined}
					onChange={(event) => {
						setValue(event.target.value);
						setError(null);
					}}
					autoFocus
				/>
			</Stack>
			{error && <PopoverFormError id={`${id}-error`}>{error}</PopoverFormError>}
			<PopoverFormFooter
				removeLabel={t("inlineBubble.footnoteRemove")}
				removeIcon={<Close aria-hidden />}
				onRemove={handleRemove}
				onCancel={onDone}
			/>
		</Stack>
	);
}
