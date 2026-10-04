"use client";

import { createTranslator } from "@monti-cms/core/client";
import type { Editor } from "@tiptap/core";
import { X } from "lucide-react";
import { type FormEvent, type ReactNode, useCallback, useEffect, useId, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Textarea } from "../ui/textarea";
import { Toggle } from "../ui/toggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { collapseToEnd, PopoverFormError, PopoverFormFooter, submitOnEnter } from "./link-form";
import { editorMessages } from "./messages";

const t = createTranslator(editorMessages);

/**
 * 글자에 붙는 꾸밈 중 글 속성 하나를 가진 것(본문 툴팁 `content`, 코드 안 툴팁 등)을 넣고·고치고·해제하는 입력 폼과 팝오버.
 * 꾸밈 이름과 문구를 받아 그린다. 본체 코드 블록의 글자 툴팁과 블록 확장의 본문 툴팁이 함께 쓴다.
 */

/** 폼 문구. */
export interface MarkTextLabels {
	/** 꾸밈 이름(예: `툴팁`). 버튼 이름·제목("툴팁 넣기"/"툴팁 수정")·해제 버튼("툴팁 해제")에 쓴다. */
	readonly name: string;
	/** 입력 칸 이름(예: `설명`). */
	readonly field: string;
	/** 비워서 보낼 때의 안내(예: `설명을 입력하세요.`). */
	readonly empty: string;
}

export interface MarkTextFormProps {
	editor: Editor;
	/** 편집기 마크 이름. */
	mark: string;
	/** 글을 담는 마크 속성 이름. */
	attribute: string;
	labels: MarkTextLabels;
	/** 커서·선택이 이미 이 꾸밈 안이면 true. 글을 고치고 해제할 수 있다. */
	active: boolean;
	initial: string;
	/** 고칠 꾸밈의 범위. 주면 현재 선택 대신 이 범위를 고친다(인라인 버블에서 커서가 꾸밈 경계에 있을 때). */
	range?: { from: number; to: number };
	onDone: () => void;
}

/** 꾸밈 글 입력 폼. 서식 도구의 팝오버와 인라인 버블이 함께 쓴다. */
export function MarkTextForm({ editor, mark, attribute, labels, active, initial, range, onDone }: MarkTextFormProps) {
	const id = useId();
	const [value, setValue] = useState(initial);
	const [error, setError] = useState<string | null>(null);
	const current = () => ({ [attribute]: editor.getAttributes(mark)[attribute] });

	const handleApply = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const trimmed = value.trim();
		if (!trimmed) {
			setError(labels.empty);
			return;
		}
		const command = editor.chain().focus();
		if (range) command.setTextSelection(range).setMark(mark, { [attribute]: trimmed });
		else if (active) command.extendMarkRange(mark, current()).setMark(mark, { [attribute]: trimmed });
		else command.setMark(mark, { [attribute]: trimmed });
		collapseToEnd(command).run();
		onDone();
	};

	const handleRemove = () => {
		const { from, to } = editor.state.selection;
		const command = editor.chain().focus();
		if (range) command.setTextSelection(range);
		else command.extendMarkRange(mark, current());
		command.unsetMark(mark).setTextSelection({ from, to }).run();
		onDone();
	};

	return (
		<form onSubmit={handleApply} onKeyDown={submitOnEnter} className="grid gap-3">
			<p className="font-medium">
				{active ? t("markText.edit", { name: labels.name }) : t("markText.add", { name: labels.name })}
			</p>
			<label htmlFor={`${id}-content`} className="grid gap-1.5 text-xs">
				{labels.field}
				<Textarea
					id={`${id}-content`}
					value={value}
					rows={2}
					aria-invalid={!!error || undefined}
					aria-describedby={error ? `${id}-error` : undefined}
					onChange={(event) => {
						setValue(event.target.value);
						setError(null);
					}}
					className="min-h-0"
					autoFocus
				/>
			</label>
			{error && <PopoverFormError id={`${id}-error`}>{error}</PopoverFormError>}
			<PopoverFormFooter
				removeLabel={t("markText.remove", { name: labels.name })}
				removeIcon={<X aria-hidden />}
				onRemove={active ? handleRemove : undefined}
				onCancel={onDone}
			/>
		</form>
	);
}

export interface MarkTextPopoverProps {
	editor: Editor;
	mark: string;
	attribute: string;
	labels: MarkTextLabels;
	icon: ReactNode;
	/** 이 이름의 창 이벤트(`window.dispatchEvent(new CustomEvent(이름))`)를 받으면 연다(슬래시 메뉴 등). */
	openEvent?: string;
}

/**
 * 서식 도구의 꾸밈 글 팝오버. 선택이 비어 있고 꾸밈 안이 아니면 끈다. 커서가 꾸밈 안이면 눌린 상태이고 글을 고치거나 해제한다.
 * Enter는 한글 조합 중 무시한다.
 */
export function MarkTextPopover({ editor, mark, attribute, labels, icon, openEvent }: MarkTextPopoverProps) {
	const [open, setOpen] = useState(false);
	const [value, setValue] = useState("");

	const isActive = editor.isActive(mark);
	const disabled = !editor.isEditable || (editor.state.selection.empty && !isActive);
	const existing = useCallback(() => String(editor.getAttributes(mark)[attribute] ?? ""), [editor, mark, attribute]);

	const handleOpenChange = useCallback(
		(nextOpen: boolean) => {
			if (disabled && nextOpen) return;
			if (nextOpen) setValue(existing());
			setOpen(nextOpen);
		},
		[disabled, existing],
	);

	useEffect(() => {
		if (!openEvent) return;
		const onOpen = () => {
			if (!editor.isEditable) return;
			if (editor.state.selection.empty && !editor.isActive(mark)) return;
			setValue(existing());
			setOpen(true);
		};
		window.addEventListener(openEvent, onOpen);
		return () => window.removeEventListener(openEvent, onOpen);
	}, [editor, mark, existing, openEvent]);

	return (
		<Popover open={open} onOpenChange={handleOpenChange}>
			<Tooltip>
				<TooltipTrigger
					render={
						<PopoverTrigger
							render={
								<Toggle
									size="sm"
									pressed={isActive}
									disabled={disabled}
									aria-label={labels.name}
									onMouseDown={(event) => event.preventDefault()}
									className="size-8 p-0"
								/>
							}
						>
							{icon}
						</PopoverTrigger>
					}
				/>
				<TooltipContent side="bottom">{labels.name}</TooltipContent>
			</Tooltip>
			<PopoverContent align="center" className="w-80 p-3 text-xs">
				<MarkTextForm
					key={String(open)}
					editor={editor}
					mark={mark}
					attribute={attribute}
					labels={labels}
					active={isActive}
					initial={value}
					onDone={() => setOpen(false)}
				/>
			</PopoverContent>
		</Popover>
	);
}
