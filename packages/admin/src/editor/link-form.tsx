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

/** 링크를 넣거나 고칠 범위. 폼을 여는 순간의 선택을 붙잡아 둔다(입력칸으로 초점이 옮겨 가도 유지). */
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

/** 효과를 적용한 뒤 커서를 그 끝으로 모은다. 커서가 효과 끝에 있으면 인라인 버블이 적용 결과를 보여 준다. */
export const collapseToEnd = (chain: ChainedCommands) =>
	chain.command(({ tr }) => {
		tr.setSelection(TextSelection.near(tr.doc.resolve(tr.selection.to), -1));
		return true;
	});

/** 한글 조합을 끝내는 Enter인가. 이때는 폼을 보내지 않는다. */
export const isComposingKey = (event: KeyboardEvent) =>
	event.nativeEvent.isComposing || event.key === "Process" || event.keyCode === 229;

/**
 * 팝오버 입력 폼(링크·툴팁)의 Enter 처리. 한글 조합 중 Enter는 무시하고, 여러 줄 칸에서도 Enter로 보낸다(Shift+Enter는 줄바꿈).
 * `<form onKeyDown={submitOnEnter}>`로 단다.
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

/** 팝오버 입력 폼 아래 버튼 줄: 왼쪽에 해제, 오른쪽에 취소·적용. 링크·툴팁 폼이 같이 쓴다. */
export function PopoverFormFooter({
	removeLabel,
	removeIcon,
	onRemove,
	onCancel,
}: {
	removeLabel: string;
	removeIcon: ReactNode;
	/** 이미 걸린 효과를 고칠 때만 준다. */
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

/** 팝오버 입력 폼의 빨간 한 줄 오류. */
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

/** 링크 주소 입력 폼. 상단 서식 도구의 팝오버와 인라인 버블이 함께 쓴다. */
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
