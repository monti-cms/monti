"use client";

import { AttributeInput, ContainerToolbar, ToolbarButton } from "@monti-cms/admin/blocks";
import { BlockFrame, Content, useBlockEditor } from "@monti-cms/admin/hooks";
import {
	cn,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
} from "@monti-cms/admin/kit";
import { createTranslator } from "@monti-cms/core/client";
import { calloutBlock } from "./definition";
import { calloutMessages } from "./messages";
import { CALLOUT_BOX_CLASS, CALLOUT_ICON_BY_VARIANT, type CalloutVariant, getDefaultCalloutTitle } from "./style";

const t = createTranslator(calloutMessages);

const VARIANT_OPTIONS = calloutBlock.attributes.variant.options as Record<CalloutVariant, string>;
const isVariant = (value: unknown): value is CalloutVariant => typeof value === "string" && value in VARIANT_OPTIONS;

/** Callout editing view. The title is edited in place, the variant from the block toolbar menu. Colors derive from the theme colors (`styles.css`). */
export function CalloutNodeView() {
	const block = useBlockEditor();
	const { values, editable } = block;
	const setValue = block.setValue;
	const variant = isVariant(values.variant) ? values.variant : "note";
	const Icon = CALLOUT_ICON_BY_VARIANT[variant];

	return (
		<BlockFrame className="my-6 rounded-lg">
			<div data-slot="callout" data-variant={variant} role="note" className={cn(CALLOUT_BOX_CLASS, "not-prose w-full")}>
				<div className="flex items-center gap-2" contentEditable={false}>
					<Icon aria-hidden data-callout-icon className="size-4 shrink-0" />
					<AttributeInput
						aria-label={t("title.aria")}
						value={typeof values.title === "string" ? values.title : ""}
						placeholder={getDefaultCalloutTitle(variant)}
						readOnly={!editable}
						onCommit={(title) => setValue("title", title)}
						onEnter={() => block.focus()}
						onEscape={() => block.focus()}
						className="flex-1 font-medium tracking-tight"
					/>
				</div>
				{/* Set the first and last child margins to 0 so the vertical margins of inner blocks (custom blocks wrapped by react-renderer) do not add to the box padding. */}
				<Content className="mt-2 text-current text-sm [&>*>:first-child>[data-node-view-wrapper]]:mt-0 [&>*>:last-child>[data-node-view-wrapper]]:mb-0 [&_p]:m-0 [&_p]:leading-relaxed" />
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
		</BlockFrame>
	);
}
