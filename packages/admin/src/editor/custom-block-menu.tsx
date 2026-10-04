"use client";

import { createTranslator } from "@monti-cms/core/client";
import type { Editor } from "@tiptap/core";
import { Puzzle } from "lucide-react";
import { useIconByName } from "../screens/shared/collection-icon";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu";
import { IconButton } from "../ui/icon-button";
import { editorMessages } from "./messages";
import { buildBlockSlashCommands } from "./slash-command";

const t = createTranslator(editorMessages);

const CUSTOM_BLOCKS = buildBlockSlashCommands();

/** 커스텀 컴포넌트 목록. 컴포넌트 메뉴와 툴바 "더보기" 메뉴가 함께 쓴다. 슬래시 메뉴처럼 이름 아래 설명을 둔다. */
export function CustomBlockMenuItems({ editor }: { editor: Editor }) {
	const iconByName = useIconByName();
	return CUSTOM_BLOCKS.map((block) => {
		// 블록 정의의 아이콘(`editor.icon`). 없으면 퍼즐 아이콘을 쓴다.
		const Icon = (typeof block.icon === "string" ? iconByName(block.icon) : block.icon) ?? Puzzle;
		return (
			<DropdownMenuItem
				key={block.id ?? block.title}
				disabled={!editor.isEditable}
				// 슬래시 메뉴용 액션이라 지울 글자가 없는 빈 범위를 커서 자리에 넘긴다.
				onClick={() => {
					const { from } = editor.state.selection;
					block.action(editor, { from, to: from });
				}}
			>
				<Icon aria-hidden className="size-4" />
				<span className="min-w-0 flex-1">
					<span className="block truncate">{block.title}</span>
					<span className="block truncate text-cms-muted-foreground text-xs">{block.description}</span>
				</span>
			</DropdownMenuItem>
		);
	});
}

/** 툴바에서 커스텀 컴포넌트(블록)를 커서 위치에 넣는다. */
export function CustomBlockMenu({ editor }: { editor: Editor }) {
	return (
		<DropdownMenu>
			<IconButton
				label={t("customBlockMenu.label")}
				side="bottom"
				disabled={!editor.isEditable}
				onMouseDown={(event) => event.preventDefault()}
				trigger={(button) => <DropdownMenuTrigger render={button} />}
			>
				<Puzzle className="size-4" aria-hidden />
			</IconButton>
			<DropdownMenuContent align="start" className="w-64">
				<CustomBlockMenuItems editor={editor} />
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
