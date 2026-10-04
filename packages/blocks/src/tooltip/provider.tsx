"use client";

import { type CmsAdminComponents, CmsAdminComponentsProvider } from "@monti-cms/admin";
import {
	addedMarkName,
	allowsMark,
	BubbleButton,
	type EditorBubbleProps,
	type EditorMarkDetailProps,
	type EditorMarkExtension,
	MarkTextForm,
	type MarkTextLabels,
	MarkTextPopover,
	removeInlineMark,
} from "@monti-cms/admin/editor";
import { createTranslator } from "@monti-cms/core/client";
import type { Editor } from "@tiptap/core";
import { MessageSquareMore, Pencil, X } from "lucide-react";
import type { ReactNode } from "react";
import { keywordList } from "../shared/text";
import { tooltipBlock } from "./definition";
import { tooltipMessages } from "./messages";

const t = createTranslator(tooltipMessages);

/** 편집기 마크 이름(`cmsTooltip`). */
export const TOOLTIP_MARK = addedMarkName(tooltipBlock.name);
/** 슬래시 메뉴가 서식 도구의 툴팁 입력을 여는 창 이벤트. */
export const OPEN_TOOLTIP_EVENT = "cms:open-tooltip";

const LABELS: MarkTextLabels = { name: t("label"), field: t("content.label"), empty: t("field.empty") };
const ICON_CLASS = "size-4";

function TooltipToolbarButton({ editor }: { editor: Editor }) {
	return (
		<MarkTextPopover
			editor={editor}
			mark={TOOLTIP_MARK}
			attribute="content"
			labels={LABELS}
			icon={<MessageSquareMore className={ICON_CLASS} aria-hidden />}
			openEvent={OPEN_TOOLTIP_EVENT}
		/>
	);
}

/** 고친 범위(`range`)가 있으면 그 툴팁을, 없으면 지금 선택을 고치는 입력 칸을 버블에 펼친다. */
const openForm = (
	{ editor, openPanel, closePanel }: EditorBubbleProps,
	form: { active: boolean; initial: string; range?: { from: number; to: number } },
) =>
	openPanel({
		label: t("panel.label"),
		content: (
			<MarkTextForm
				editor={editor}
				mark={TOOLTIP_MARK}
				attribute="content"
				labels={LABELS}
				active={form.active}
				initial={form.initial}
				range={form.range}
				onDone={closePanel}
			/>
		),
	});

function TooltipBubbleButton(props: EditorBubbleProps) {
	const { editor } = props;
	// 코드 블록 안 글자 툴팁은 본체 코드 블록이 따로 준다.
	if (!allowsMark(editor.state, TOOLTIP_MARK)) return null;
	const active = editor.isActive(TOOLTIP_MARK);
	return (
		<BubbleButton
			label={active ? t("edit") : t("add")}
			onClick={() => openForm(props, { active, initial: String(editor.getAttributes(TOOLTIP_MARK).content ?? "") })}
		>
			<MessageSquareMore aria-hidden className={ICON_CLASS} />
		</BubbleButton>
	);
}

function TooltipDetail(props: EditorMarkDetailProps) {
	const { editor, mark, act } = props;
	const content = String(mark.attrs.content ?? "");
	return (
		<>
			<MessageSquareMore aria-hidden className="mx-1 size-4 shrink-0 text-cms-muted-foreground" />
			<span className="max-w-48 truncate px-1 text-cms-muted-foreground text-xs" title={content}>
				{content}
			</span>
			<BubbleButton label={t("edit")} onClick={() => openForm(props, { active: true, initial: content, range: mark })}>
				<Pencil aria-hidden className={ICON_CLASS} />
			</BubbleButton>
			<BubbleButton label={t("remove")} onClick={act(() => removeInlineMark(editor, mark))}>
				<X aria-hidden className={ICON_CLASS} />
			</BubbleButton>
		</>
	);
}

/** 툴팁 꾸밈의 편집기 등록. 점선 밑줄로 보이고, 툴팁 끝에 이어 친 글자도 툴팁에 든다. */
export const tooltipMarkExtension: EditorMarkExtension = {
	inclusive: true,
	render: () => ({ class: "underline decoration-dotted underline-offset-4" }),
	toolbar: { group: "link", Button: TooltipToolbarButton },
	bubble: { group: "link", order: -1, Button: TooltipBubbleButton },
	detail: TooltipDetail,
	insertActions: [
		{
			id: "tooltip",
			title: t("insert.title"),
			description: t("insert.description"),
			icon: MessageSquareMore,
			keywords: ["tooltip", ...keywordList(t("insert.keywords"))],
			run: (editor, range) => {
				// 슬래시는 빈 문단에서 입력하므로 선택 영역이 없다. 라벨 예시를 선택해 편집·설명 입력을 시작한다.
				const sample = t("insert.text");
				editor.chain().focus().deleteRange(range).insertContent(sample).run();
				const to = editor.state.selection.from;
				editor.commands.setTextSelection({ from: to - sample.length, to });
				window.dispatchEvent(new CustomEvent(OPEN_TOOLTIP_EVENT));
			},
		},
	],
};

const components: CmsAdminComponents = { marks: { [tooltipBlock.name]: tooltipMarkExtension } };

/** 툴팁 꾸밈의 편집기 표시·서식 도구·버블·슬래시 메뉴를 관리자 화면에 넣는다. */
export function TooltipProvider({ children }: { children: ReactNode }) {
	return <CmsAdminComponentsProvider components={components}>{children}</CmsAdminComponentsProvider>;
}
