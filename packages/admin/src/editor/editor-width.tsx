"use client";

import { createTranslator } from "@monti-cms/core/client";
import { MoveHorizontal } from "lucide-react";
import { useEffect, useState } from "react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { IconButton } from "../ui/icon-button";
import { editorMessages } from "./messages";

const t = createTranslator(editorMessages);

/**
 * 편집기 본문 폭. 편집할 때 보이는 폭만 바꾸고 저장되는 글·공개 화면과는 상관없다.
 * 브라우저에는 단계 이름만 기억하므로 폭 값은 여기서만 바꾸면 된다.
 */
export const EDITOR_WIDTHS = {
	/** 읽기 좋은 글 본문 폭(Tailwind `max-w-2xl`과 같은 42rem). */
	narrow: "42rem",
	normal: "48rem",
	wide: "64rem",
	full: "none",
} as const;

export type EditorWidth = keyof typeof EDITOR_WIDTHS;

const LABELS: Record<EditorWidth, string> = {
	narrow: t("editorWidth.narrow"),
	normal: t("editorWidth.normal"),
	wide: t("editorWidth.wide"),
	full: t("editorWidth.full"),
};
const STORAGE_KEY = "cms:editor-width";
const isEditorWidth = (value: unknown): value is EditorWidth =>
	typeof value === "string" && Object.hasOwn(EDITOR_WIDTHS, value);

/** 고른 본문 폭. 이 브라우저에 기억하고, 저장소를 못 쓰면 보통 폭으로 시작한다. */
export function useEditorWidth(): [EditorWidth, (width: EditorWidth) => void] {
	const [width, setWidth] = useState<EditorWidth>("normal");
	useEffect(() => {
		try {
			const stored = window.localStorage.getItem(STORAGE_KEY);
			if (isEditorWidth(stored)) setWidth(stored);
		} catch {
			// 저장소를 쓸 수 없으면 기본 폭을 쓴다.
		}
	}, []);
	const change = (next: EditorWidth) => {
		setWidth(next);
		try {
			window.localStorage.setItem(STORAGE_KEY, next);
		} catch {
			// 기억하지 못해도 폭은 바뀐다.
		}
	};
	return [width, change];
}

/** 툴바 오른쪽 끝의 본문 폭 메뉴. */
export function EditorWidthMenu({ value, onChange }: { value: EditorWidth; onChange: (width: EditorWidth) => void }) {
	return (
		<DropdownMenu>
			<IconButton
				label={t("editorWidth.label")}
				side="bottom"
				className="text-cms-muted-foreground"
				onMouseDown={(event) => event.preventDefault()}
				trigger={(button) => <DropdownMenuTrigger render={button} />}
			>
				<MoveHorizontal aria-hidden className="size-4" />
			</IconButton>
			<DropdownMenuContent align="end" className="w-36">
				<DropdownMenuRadioGroup
					aria-label={t("editorWidth.label")}
					value={value}
					onValueChange={(next) => isEditorWidth(next) && onChange(next)}
				>
					{(Object.keys(EDITOR_WIDTHS) as EditorWidth[]).map((width) => (
						<DropdownMenuRadioItem key={width} value={width}>
							{LABELS[width]}
						</DropdownMenuRadioItem>
					))}
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
