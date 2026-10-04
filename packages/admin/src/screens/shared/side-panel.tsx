"use client";

import { createTranslator } from "@monti-cms/core/client";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../lib/utils/cn";
import { IconButton } from "../../ui/icon-button";
import { sharedMessages } from "./messages";

const t = createTranslator(sharedMessages);

/** 오른쪽 칸(분류 편집·미디어 상세·글 속성) 너비. 모든 오른쪽 칸이 같은 너비다. */
export const SIDE_PANEL_WIDTH = "w-[22rem]";

/**
 * 목록 옆에 여는 오른쪽 칸의 자리(분류 편집·미디어 상세). 좁은 화면은 목록 위에 덮고,
 * 넓은 화면은 목록 옆에 `SIDE_PANEL_WIDTH`와 같은 폭으로 둔다(Tailwind가 읽도록 글자 그대로 적는다).
 */
export const SIDE_PANEL_DOCK =
	"absolute inset-y-0 right-0 z-20 w-full shadow-lg sm:w-[22rem] lg:static lg:shrink-0 lg:shadow-none";

/** 목록에서 지금 연 항목(오른쪽 칸·편집 칸에 열린 것)의 배경. */
export const OPEN_ITEM = "bg-cms-accent text-cms-accent-foreground";

/** 오른쪽 칸 머리. 제목과 닫기 버튼(이름은 늘 "닫기")이다. */
export function SidePanelHeader({
	title,
	onClose,
	className,
	children,
}: {
	title?: ReactNode;
	onClose: () => void;
	className?: string;
	/** 제목 대신(또는 옆에) 둘 내용(탭 등). */
	children?: ReactNode;
}) {
	return (
		<div className={cn("flex h-11 shrink-0 items-center gap-1 border-b pr-2 pl-4", className)}>
			{title !== undefined && <h2 className="min-w-0 flex-1 truncate font-medium text-sm">{title}</h2>}
			{children}
			<IconButton label={t("panel.close")} side="bottom" onClick={onClose}>
				<X aria-hidden />
			</IconButton>
		</div>
	);
}
