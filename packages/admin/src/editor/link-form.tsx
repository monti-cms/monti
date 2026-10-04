"use client";

import { createTranslator } from "@monti-cms/core/client";
import type { ChainedCommands, Editor } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import { Unlink } from "lucide-react";
import { type FormEvent, type KeyboardEvent, type ReactNode, useId, useState } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { editorMessages } from "./messages";

const t = createTranslator(editorMessages);

export function normalizeLinkHref(value: string): string | null {
	const href = value.trim();
	if (!href || /\s/.test(href)) return null;
	if ((href.startsWith("/") && !href.startsWith("//")) || href.startsWith("#")) return href;
	if (/^mailto:[^@\s]+@[^@\s]+$/i.test(href)) return href;
	if (/^https?:\/\//i.test(href)) {
		try {
			return new URL(href).href;
		} catch {
			return null;
		}
	}
	if (/^[^/:?#\s]+\.[^/:?#\s]{2,}(?:[/?#].*)?$/i.test(href)) return `https://${href}`;
	return null;
}

/** Range where a link is inserted or edited. Captures the selection at the moment the form opens (kept even when focus moves to the input). */
export interface LinkDraft {
	from: number;
	to: number;
	existing: boolean;
	href: string;
}

export function linkDraftFromSelection(editor: Editor): LinkDraft {
	const { from, to } = editor.state.selection;
	const existing = editor.isActive("link");
	return { from, to, existing, href: existing ? String(editor.getAttributes("link").href ?? "") : "" };
}

/** Collapses the cursor to the end of the effect after applying it. With the cursor at the end of the effect, the inline bubble shows the applied result. */
export const collapseToEnd = (chain: ChainedCommands) =>
	chain.command(({ tr }) => {
		tr.setSelection(TextSelection.near(tr.doc.resolve(tr.selection.to), -1));
		return true;
	});

/** Whether this Enter finishes Korean composition. The form is not submitted then. */
export const isComposingKey = (event: KeyboardEvent) =>
	event.nativeEvent.isComposing || event.key === "Process" || event.keyCode === 229;

/**
 * Enter handling for popover input forms (link, tooltip). Enter during Korean composition is ignored, and Enter submits even in multi-line fields (Shift+Enter inserts a line break).
 * Attach it as `<form onKeyDown={submitOnEnter}>`.
 */
export function submitOnEnter(event: KeyboardEvent<HTMLFormElement>) {
	if (event.key !== "Enter") return;
	if (isComposingKey(event)) {
		event.preventDefault();
		return;
	}
	if (event.target instanceof HTMLTextAreaElement && !event.shiftKey) {
		event.preventDefault();
		event.currentTarget.requestSubmit();
	}
}

/** Button row below a popover input form: remove on the left, cancel and apply on the right. Shared by the link and tooltip forms. */
export function PopoverFormFooter({
	removeLabel,
	removeIcon,
	onRemove,
	onCancel,
}: {
	removeLabel: string;
	removeIcon: ReactNode;
	/** Passed only when editing an effect that is already applied. */
	onRemove?: () => void;
	onCancel: () => void;
}) {
	return (
		<div className="flex items-center gap-2">
			{onRemove && (
				<Button
					type="button"
					variant="ghost"
					size="sm"
					className="text-cms-destructive hover:bg-cms-destructive/10 hover:text-cms-destructive"
					onClick={onRemove}
				>
					{removeIcon}
					{removeLabel}
				</Button>
			)}
			<div className="ml-auto flex items-center gap-2">
				<Button type="button" variant="outline" size="sm" onClick={onCancel}>
					{t("popoverForm.cancel")}
				</Button>
				<Button type="submit" size="sm">
					{t("popoverForm.apply")}
				</Button>
			</div>
		</div>
	);
}

/** One-line red error of a popover input form. */
export function PopoverFormError({ id, children }: { id: string; children: ReactNode }) {
	return (
		<p id={id} role="alert" className="text-cms-destructive text-xs">
			{children}
		</p>
	);
}

interface LinkFormProps {
	editor: Editor;
	draft: LinkDraft;
	onDone: () => void;
}

/** Link address input form. Shared by the top formatting toolbar's popover and the inline bubble. */
export function LinkForm({ editor, draft, onDone }: LinkFormProps) {
	const id = useId();
	const [href, setHref] = useState(draft.href);
	const [text, setText] = useState(() =>
		draft.from === draft.to ? "" : editor.state.doc.textBetween(draft.from, draft.to),
	);
	const [error, setError] = useState<string | null>(null);
	const needsText = !draft.existing && draft.from === draft.to;

	const submit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const normalized = normalizeLinkHref(href);
		if (!normalized) {
			setError(t("link.invalid"));
			return;
		}
		const command = editor.chain().focus().setTextSelection({ from: draft.from, to: draft.to });
		if (draft.existing) collapseToEnd(command.extendMarkRange("link").setLink({ href: normalized })).run();
		else if (!needsText) collapseToEnd(command.setLink({ href: normalized })).run();
		else
			command
				.insertContent({
					type: "text",
					text: text.trim() || normalized,
					marks: [{ type: "link", attrs: { href: normalized } }],
				})
				.run();
		onDone();
	};

	const remove = () => {
		editor
			.chain()
			.focus()
			.setTextSelection({ from: draft.from, to: draft.to })
			.extendMarkRange("link")
			.unsetLink()
			.setTextSelection({ from: draft.from, to: draft.to })
			.run();
		onDone();
	};

	return (
		<form onSubmit={submit} onKeyDown={submitOnEnter} className="grid gap-3">
			<p className="font-medium">{draft.existing ? t("link.edit") : t("link.add")}</p>
			{needsText && (
				<label htmlFor={`${id}-text`} className="grid gap-1.5 text-xs">
					{t("link.text")}
					<Input
						id={`${id}-text`}
						value={text}
						onChange={(event) => setText(event.target.value)}
						placeholder={t("link.textPlaceholder")}
					/>
				</label>
			)}
			<label htmlFor={`${id}-href`} className="grid gap-1.5 text-xs">
				{t("link.href")}
				<Input
					id={`${id}-href`}
					autoFocus
					value={href}
					aria-invalid={!!error || undefined}
					aria-describedby={error ? `${id}-error` : undefined}
					onChange={(event) => {
						setHref(event.target.value);
						setError(null);
					}}
					placeholder="https://example.com"
				/>
			</label>
			{error && <PopoverFormError id={`${id}-error`}>{error}</PopoverFormError>}
			<PopoverFormFooter
				removeLabel={t("link.remove")}
				removeIcon={<Unlink aria-hidden />}
				onRemove={draft.existing ? remove : undefined}
				onCancel={onDone}
			/>
		</form>
	);
}
