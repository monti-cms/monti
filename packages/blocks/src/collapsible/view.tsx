"use client";

import {
	AttributeInput,
	BlockSettings,
	ContainerToolbar,
	focusInside,
	SELECTED_RING,
	selectContainer,
	useContainerValues,
	useSelectedChildIndex,
} from "@monti-cms/admin/blocks";
import { cn, Switch } from "@monti-cms/admin/kit";
import { createTranslator } from "@monti-cms/core/client";
import { NodeViewContent, type NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { ChevronRight } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { collapsibleMessages } from "./messages";

const t = createTranslator(collapsibleMessages);

/**
 * 접기 편집 화면(테마 색). 처음 모습은 `defaultOpen`을 따르고, 제목 옆 화살표로 편집 중에도 여닫는다.
 * 커서가 안으로 들어오면(방향키·되돌리기·찾기) 저절로 펼친다.
 */
export function CollapsibleNodeView(props: NodeViewProps) {
	const { selected, editor, getPos } = props;
	const [values, setValue] = useContainerValues(props);
	const defaultOpen = values.defaultOpen === true;
	const [open, setOpen] = useState(defaultOpen);
	const selectionInside = useSelectedChildIndex(editor, getPos) !== -1;
	const editable = editor.isEditable;
	const defaultOpenId = useId();

	useEffect(() => {
		if (selectionInside) setOpen(true);
	}, [selectionInside]);

	const toggle = () => {
		if (open) {
			// 숨길 본문 안에 커서를 남기면 보이지 않는 곳에 글자가 들어간다. 접기 블록 전체를 선택해 둔다.
			if (selectionInside) selectContainer(editor, getPos);
			setOpen(false);
		} else {
			setOpen(true);
			focusInside(editor, getPos);
		}
	};

	return (
		<NodeViewWrapper
			data-cms-container-node="cmsCollapsible"
			data-cms-framed
			className={cn("group/container relative my-6 rounded-md border bg-cms-background", selected && SELECTED_RING)}
		>
			<div
				contentEditable={false}
				className={cn(
					"not-prose flex w-full items-center gap-2 rounded-md px-3 py-2 font-medium text-cms-foreground text-sm",
					open && "bg-cms-muted",
				)}
			>
				<button
					type="button"
					aria-expanded={open}
					aria-label={open ? t("toggle.close") : t("toggle.open")}
					onClick={toggle}
					className="-m-1 rounded p-1 hover:bg-cms-accent"
				>
					<ChevronRight
						className={cn("size-4 shrink-0 text-cms-muted-foreground transition-transform", open && "rotate-90")}
					/>
				</button>
				<AttributeInput
					aria-label={t("title.aria")}
					value={typeof values.title === "string" ? values.title : ""}
					placeholder={t("title.placeholder")}
					readOnly={!editable}
					onCommit={(title) => setValue("title", title)}
					onEnter={() => {
						setOpen(true);
						focusInside(editor, getPos);
					}}
					className="flex-1"
				/>
			</div>
			<NodeViewContent
				className={cn(
					"px-3 pt-2 pb-3 text-cms-foreground",
					// 안쪽 첫·끝 블록의 prose 여백이 상자 안쪽 여백에 더해지지 않게 0으로 둔다(중첩 커스텀 블록은 react-renderer 안 래퍼가 여백을 가진다).
					"[&>[data-node-view-content-react]>:first-child]:mt-0 [&>[data-node-view-content-react]>:last-child]:mb-0",
					"[&>[data-node-view-content-react]>:first-child>[data-node-view-wrapper]]:mt-0 [&>[data-node-view-content-react]>:last-child>[data-node-view-wrapper]]:mb-0",
					!open && "hidden",
				)}
				// 읽기 전용 원문 보기는 접힌 본문도 펼쳐 보인다(`data-cms-collapsed`).
				data-cms-collapsed={open ? undefined : ""}
			/>
			{editable ? (
				<ContainerToolbar label={t("toolbar")}>
					<BlockSettings>
						<label htmlFor={defaultOpenId} className="flex items-center justify-between gap-2">
							<span className="text-cms-muted-foreground">{t("defaultOpen.label")}</span>
							<Switch
								id={defaultOpenId}
								size="sm"
								checked={defaultOpen}
								onCheckedChange={(checked) => setValue("defaultOpen", checked)}
							/>
						</label>
					</BlockSettings>
				</ContainerToolbar>
			) : null}
		</NodeViewWrapper>
	);
}
