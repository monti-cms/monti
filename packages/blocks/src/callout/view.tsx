"use client";

import {
	AttributeInput,
	BlockFrame,
	ContainerToolbar,
	Content,
	ToolbarButton,
	useBlockEditor,
	useTranslator,
} from "@monti-cms/admin";
import {
	cn,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
	Inline,
} from "@monti-cms/admin/kit";
import { calloutMessages } from "./messages";
import { CALLOUT_BOX_CLASS, CALLOUT_ICON_BY_VARIANT, type CalloutVariant, getDefaultCalloutTitle } from "./style";

const VARIANTS: readonly CalloutVariant[] = ["note", "tip", "info", "warning", "danger"];
const isVariant = (value: unknown): value is CalloutVariant =>
	typeof value === "string" && (VARIANTS as readonly string[]).includes(value);

/** Callout editing view. The title is edited in place, the variant from the block toolbar menu. Colors derive from the theme colors (`styles.css`). */
export function CalloutNodeView() {
	const t = useTranslator(calloutMessages);
	const VARIANT_OPTIONS = Object.fromEntries(VARIANTS.map((key) => [key, t(`option.${key}`)])) as Record<
		CalloutVariant,
		string
	>;
	const block = useBlockEditor();
	const { values, editable } = block;
	const setValue = block.setValue;
	const variant = isVariant(values.variant) ? values.variant : "note";
	const Icon = CALLOUT_ICON_BY_VARIANT[variant];

	return (
		<BlockFrame className="my-monti-24 rounded-monti-lg">
			<div data-slot="callout" data-variant={variant} role="note" className={cn(CALLOUT_BOX_CLASS, "not-prose w-full")}>
				<Inline gap={8} contentEditable={false}>
					<Icon aria-hidden data-callout-icon className="size-4 shrink-0" />
					<AttributeInput
						aria-label={t("title.aria")}
						value={typeof values.title === "string" ? values.title : ""}
						placeholder={getDefaultCalloutTitle(variant)}
						readOnly={!editable}
						onCommit={(title) => setValue("title", title)}
						onEnter={() => block.focus()}
						onEscape={() => block.focus()}
						className="w-full flex-1 font-medium"
					/>
				</Inline>
				{/* Set the first and last child margins to 0 so the vertical margins of inner blocks (custom blocks wrapped by react-renderer) do not add to the box padding. */}
				<Content className="mt-monti-8 text-current text-monti-body [&>*>:first-child>[data-node-view-wrapper]]:mt-0 [&>*>:last-child>[data-node-view-wrapper]]:mb-0 [&_p]:m-0" />
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
						<DropdownMenuContent align="end">
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
