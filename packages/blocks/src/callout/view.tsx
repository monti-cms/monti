"use client";

import {
	AttributeInput,
	ContainerToolbar,
	focusInside,
	SELECTED_RING,
	ToolbarButton,
	useContainerValues,
} from "@monti-cms/admin/blocks";
import {
	cn,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
} from "@monti-cms/admin/kit";
import { createTranslator } from "@monti-cms/core/client";
import { NodeViewContent, type NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { calloutBlock } from "./definition";
import { calloutMessages } from "./messages";
import { CALLOUT_BOX_CLASS, CALLOUT_ICON_BY_VARIANT, type CalloutVariant, getDefaultCalloutTitle } from "./style";

const t = createTranslator(calloutMessages);

const VARIANT_OPTIONS = calloutBlock.attributes.variant.options as Record<CalloutVariant, string>;
const isVariant = (value: unknown): value is CalloutVariant => typeof value === "string" && value in VARIANT_OPTIONS;

/** 콜아웃 편집 화면. 제목은 그 자리에서, 종류는 블록 도구 줄의 메뉴에서 바꾼다. 색은 테마 색에서 만든다(`styles.css`). */
export function CalloutNodeView(props: NodeViewProps) {
	const { selected, editor, getPos } = props;
	const [values, setValue] = useContainerValues(props);
	const variant = isVariant(values.variant) ? values.variant : "note";
	const Icon = CALLOUT_ICON_BY_VARIANT[variant];
	const editable = editor.isEditable;

	return (
		<NodeViewWrapper
			data-cms-container-node="cmsCallout"
			data-cms-framed
			className={cn("group/container relative my-6 rounded-lg", selected && SELECTED_RING)}
		>
			<div data-slot="callout" data-variant={variant} role="note" className={cn(CALLOUT_BOX_CLASS, "not-prose w-full")}>
				<div className="flex items-center gap-2" contentEditable={false}>
					<Icon aria-hidden data-callout-icon className="size-4 shrink-0" />
					<AttributeInput
						aria-label={t("title.aria")}
						value={typeof values.title === "string" ? values.title : ""}
						placeholder={getDefaultCalloutTitle(variant)}
						readOnly={!editable}
						onCommit={(title) => setValue("title", title)}
						onEnter={() => focusInside(editor, getPos)}
						onEscape={() => focusInside(editor, getPos)}
						className="flex-1 font-medium tracking-tight"
					/>
				</div>
				{/* 안쪽 블록(react-renderer로 감싸진 커스텀 블록)의 위아래 여백이 상자 안쪽 여백에 더해지지 않게 첫·끝 자식은 0으로 둔다. */}
				<NodeViewContent className="mt-2 text-current text-sm [&>[data-node-view-content-react]>:first-child>[data-node-view-wrapper]]:mt-0 [&>[data-node-view-content-react]>:last-child>[data-node-view-wrapper]]:mb-0 [&_p]:m-0 [&_p]:leading-relaxed" />
			</div>
			{editable ? (
				<ContainerToolbar label={t("toolbar")}>
					<DropdownMenu>
						<ToolbarButton
							label={t("variant.button", { variant: VARIANT_OPTIONS[variant] })}
							trigger={(button) => <DropdownMenuTrigger render={button} />}
						>
							<Icon aria-hidden />
						</ToolbarButton>
						<DropdownMenuContent align="end" className="w-40">
							<DropdownMenuRadioGroup value={variant} onValueChange={(next) => setValue("variant", String(next))}>
								{Object.entries(VARIANT_OPTIONS).map(([key, label]) => {
									const OptionIcon = CALLOUT_ICON_BY_VARIANT[key as CalloutVariant];
									return (
										<DropdownMenuRadioItem key={key} value={key}>
											<OptionIcon aria-hidden />
											{label}
										</DropdownMenuRadioItem>
									);
								})}
							</DropdownMenuRadioGroup>
						</DropdownMenuContent>
					</DropdownMenu>
				</ContainerToolbar>
			) : null}
		</NodeViewWrapper>
	);
}
