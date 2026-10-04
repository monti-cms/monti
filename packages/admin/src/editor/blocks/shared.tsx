"use client";

import { createTranslator } from "@monti-cms/core/client";
import type { Editor } from "@tiptap/core";
import type { Node as PmNode } from "@tiptap/pm/model";
import { NodeSelection, TextSelection } from "@tiptap/pm/state";
import { type NodeViewProps, useEditorState } from "@tiptap/react";
import { Settings2 } from "lucide-react";
import { type ComponentProps, type KeyboardEvent, type ReactNode, useEffect, useRef, useState } from "react";
import { cn } from "../../lib/utils/cn";
import { IconButton } from "../../ui/icon-button";
import { Popover, PopoverContent, PopoverTrigger } from "../../ui/popover";
import { blocksMessages } from "./messages";

const t = createTranslator(blocksMessages);

/** 고른 블록 테두리. 모든 블록이 같은 모양을 쓴다. */
export const SELECTED_RING = "ring-2 ring-cms-ring ring-offset-2 ring-offset-cms-background";

/** 블록 위에 뜨는 조작 도구 줄의 겉모양(블록 도구 줄·이미지·표가 같이 쓴다). */
export const BLOCK_TOOLBAR =
	"z-10 flex items-center gap-0.5 rounded-md border bg-cms-popover/95 p-0.5 text-cms-popover-foreground shadow-sm backdrop-blur";

export type ContainerValues = Record<string, string | boolean>;

export const valuesOf = (node: PmNode): ContainerValues => (node.attrs.values ?? {}) as ContainerValues;

/** 비운 값(빈 문자열·false)은 속성에서 뺀다. 남기면 원문에 없던 `title=""`가 저장된다. */
export const withValue = (values: ContainerValues, key: string, value: string | boolean): ContainerValues => {
	const { [key]: _removed, ...rest } = values;
	return value === "" || value === false ? rest : { ...rest, [key]: value };
};

export const useContainerValues = ({ node, updateAttributes }: Pick<NodeViewProps, "node" | "updateAttributes">) => {
	const values = valuesOf(node);
	const setValue = (key: string, value: string | boolean) =>
		updateAttributes({ values: withValue(values, key, value) });
	return [values, setValue] as const;
};

/**
 * 편집기를 고칠 수 있는가. 잠금(휴지통·원문 모드)이 바뀌면 다시 그린다.
 * 노드 뷰는 `editor.isEditable`을 그릴 때 한 번 읽으면 잠금이 바뀌어도 따라가지 않으므로 이것을 쓴다.
 */
export function useEditorEditable(editor: Editor | null | undefined): boolean {
	// 편집기 없이 그리는 경우(미리보기·테스트의 가짜 편집기)는 구독하지 않고 그때 값을 읽는다.
	const tracked = typeof editor?.on === "function" ? editor : null;
	const editable = useEditorState({
		editor: tracked,
		selector: ({ editor: current }) => current?.isEditable ?? true,
	});
	return tracked ? (editable ?? true) : (editor?.isEditable ?? true);
}

/** 부모 컨테이너 안 i번째 자식의 시작 위치. */
export const childPos = (parent: PmNode, parentPos: number, index: number) => {
	let offset = parentPos + 1;
	for (let i = 0; i < index; i += 1) offset += parent.child(i).nodeSize;
	return offset;
};

/**
 * 현재 선택이 이 컨테이너의 몇 번째 자식 안에 있는지. 밖이면 -1.
 * 편집기에 포커스가 없으면 -1이다 — 글을 처음 열 때 커서가 문서 맨 앞(첫 블록이 탭이면 그 첫 탭)에 있어도
 * 처음 열 탭·접힘 상태를 덮어쓰지 않는다.
 */
export const useSelectedChildIndex = (editor: Editor, getPos: NodeViewProps["getPos"]) =>
	useEditorState({
		editor,
		selector: ({ editor: current }) => {
			const pos = getPos();
			if (!current?.isFocused || typeof pos !== "number") return -1;
			const parent = current.state.doc.nodeAt(pos);
			const { from } = current.state.selection;
			if (!parent || from <= pos || from >= pos + parent.nodeSize) return -1;
			let offset = pos + 1;
			for (let i = 0; i < parent.childCount; i += 1) {
				const end = offset + parent.child(i).nodeSize;
				if (from >= offset && from < end) return i;
				offset = end;
			}
			return -1;
		},
	}) ?? -1;

/** 컨테이너 안(자식 index 또는 본문 시작)으로 커서를 옮긴다. */
export const focusInside = (editor: Editor, getPos: NodeViewProps["getPos"], index?: number) => {
	const pos = getPos();
	if (typeof pos !== "number") return;
	editor
		.chain()
		.focus()
		.command(({ tr }) => {
			const parent = tr.doc.nodeAt(pos);
			if (!parent) return false;
			const start = index === undefined ? pos + 1 : childPos(parent, pos, index) + 1;
			tr.setSelection(TextSelection.near(tr.doc.resolve(start)));
			return true;
		})
		.scrollIntoView()
		.run();
};

/** 컨테이너 전체를 선택한다(숨길 본문 안에 커서를 남기지 않을 때). */
export const selectContainer = (editor: Editor, getPos: NodeViewProps["getPos"]) => {
	const pos = getPos();
	if (typeof pos !== "number") return;
	editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, pos)));
};

/**
 * 속성(제목·탭 이름) 입력 칸. 한글 조합 중에는 문서에 넣지 않고 조합이 끝날 때 넣는다.
 * Enter는 본문으로, Escape는 편집기로 돌아간다.
 */
export function AttributeInput({
	value,
	onCommit,
	onEnter,
	onEscape,
	required = false,
	onBlur,
	className,
	...props
}: Omit<ComponentProps<"input">, "value" | "onChange" | "defaultValue"> & {
	value: string;
	onCommit: (value: string) => void;
	onEnter?: () => void;
	onEscape?: () => void;
	/** 비운 값을 넣지 않는다(탭 이름). 비운 채로 벗어나면 원래 값으로 돌린다. */
	required?: boolean;
}) {
	const [draft, setDraft] = useState(value);
	const composingRef = useRef(false);
	const focusedRef = useRef(false);
	// 입력할 때마다 문서에 넣으므로, Escape로 되돌릴 값은 입력 칸에 들어올 때 기억한다.
	const initialRef = useRef(value);
	// Escape 뒤 이어지는 blur가 방금 입력한 값을 다시 넣지 않게 한다(draft 상태는 아직 갱신 전이다).
	const escapingRef = useRef(false);

	// 마지막으로 문서에 넣은 값. 렌더가 따라오기 전에 이어서 넣어도(Escape 직후 등) 비교가 어긋나지 않는다.
	const committedRef = useRef(value);

	// 되돌리기처럼 바깥에서 값이 바뀌면 입력 중이 아닐 때만 따라간다.
	useEffect(() => {
		committedRef.current = value;
		if (!focusedRef.current) setDraft(value);
	}, [value]);

	const commit = (next: string) => {
		if (required && !next.trim()) return;
		if (next === committedRef.current) return;
		committedRef.current = next;
		onCommit(next);
	};

	return (
		<input
			{...props}
			value={draft}
			onFocus={() => {
				focusedRef.current = true;
				initialRef.current = committedRef.current;
			}}
			onBlur={(event) => {
				focusedRef.current = false;
				if (escapingRef.current) escapingRef.current = false;
				else commit(draft);
				if (required && !draft.trim()) setDraft(value);
				onBlur?.(event);
			}}
			onChange={(event) => {
				setDraft(event.target.value);
				if (!composingRef.current) commit(event.target.value);
			}}
			onCompositionStart={() => {
				composingRef.current = true;
			}}
			onCompositionEnd={(event) => {
				composingRef.current = false;
				commit(event.currentTarget.value);
			}}
			onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
				if (event.nativeEvent.isComposing || composingRef.current) return;
				if (event.key === "Enter") {
					event.preventDefault();
					commit(draft);
					onEnter?.();
				} else if (event.key === "Escape") {
					event.preventDefault();
					escapingRef.current = true;
					setDraft(initialRef.current);
					commit(initialRef.current);
					onEscape?.();
				}
			}}
			className={cn(
				"min-w-0 border-0 bg-transparent p-0 outline-none placeholder:text-current placeholder:opacity-50 focus-visible:ring-0",
				className,
			)}
		/>
	);
}

/** 컨테이너에 마우스를 올리거나 안에 커서가 있을 때만 보이는 조작 도구 줄. */
export function ContainerToolbar({
	visible,
	className,
	children,
	label,
}: {
	visible?: boolean;
	className?: string;
	children: ReactNode;
	label: string;
}) {
	return (
		<div
			role="toolbar"
			aria-label={label}
			contentEditable={false}
			className={cn(
				BLOCK_TOOLBAR,
				"absolute -top-3.5 right-2 transition-opacity",
				"opacity-0 group-focus-within/container:opacity-100 group-hover/container:opacity-100 has-aria-expanded:opacity-100",
				visible && "opacity-100",
				className,
			)}
		>
			{children}
		</div>
	);
}

/** 도구 줄의 아이콘 버튼. 이름은 마우스를 올리면 뜬다. */
export function ToolbarButton(props: ComponentProps<typeof IconButton>) {
	return <IconButton size="icon-xs" {...props} />;
}

/**
 * 블록 설정 버튼과 그 팝오버. 블록의 속성(너비·대체 텍스트·처음 상태 등)은 모두 여기에 둔다.
 * 안의 칸은 `BlockSettingsField`로 줄을 맞춘다.
 */
export function BlockSettings({
	label = t("settings.label"),
	open,
	onOpenChange,
	children,
}: {
	label?: string;
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	children: ReactNode;
}) {
	return (
		<Popover open={open} onOpenChange={onOpenChange}>
			<ToolbarButton label={label} trigger={(button) => <PopoverTrigger render={button} />}>
				<Settings2 aria-hidden />
			</ToolbarButton>
			<PopoverContent align="end" className="flex w-72 flex-col gap-3 p-3 text-xs">
				{children}
			</PopoverContent>
		</Popover>
	);
}

/** 설정 팝오버 안의 한 칸(이름 위, 입력 아래). */
export function BlockSettingsField({
	label,
	htmlFor,
	action,
	children,
}: {
	label: string;
	htmlFor?: string;
	/** 이름 오른쪽에 붙는 작은 버튼(AI 등). */
	action?: ReactNode;
	children: ReactNode;
}) {
	return (
		<div className="flex flex-col gap-1">
			<div className="flex min-h-6 items-center justify-between gap-2">
				<label htmlFor={htmlFor} className="text-cms-muted-foreground text-xs">
					{label}
				</label>
				{action}
			</div>
			{children}
		</div>
	);
}
