"use client";

import { BlockFrame, Content, defineAdminPlugin, useBlockEditor } from "@monti-cms/admin";
import { AttributeInput, ContainerToolbar } from "@monti-cms/admin/blocks";
import { SiteCallout } from "../../components/callout";

const VARIANTS = ["note", "tip", "info", "warning", "danger"] as const;

/** The editing view of `callout`: the same `SiteCallout` as the public page, with an input for the title, the editable body in it and a type menu in the toolbar. */
function SiteCalloutView() {
	const block = useBlockEditor();
	const { values, editable } = block;
	const variant = typeof values.variant === "string" ? values.variant : "note";
	return (
		<BlockFrame>
			<SiteCallout
				variant={variant}
				title={
					<AttributeInput
						aria-label="Callout title"
						value={typeof values.title === "string" ? values.title : ""}
						placeholder={variant}
						readOnly={!editable}
						onCommit={(title) => block.setValue("title", title)}
						onEnter={() => block.focus()}
						onEscape={() => block.focus()}
						className="w-full font-medium"
					/>
				}
			>
				<Content />
			</SiteCallout>
			{editable ? (
				<ContainerToolbar label="Callout">
					<select
						aria-label="Callout type"
						value={variant}
						onChange={(event) => block.setValue("variant", event.target.value)}
					>
						{VARIANTS.map((item) => (
							<option key={item} value={item}>
								{item}
							</option>
						))}
					</select>
				</ContainerToolbar>
			) : null}
		</BlockFrame>
	);
}

/** The admin side of the site-callout plugin: its view of the `callout` block. A later plugin's view of a block wins, so this one replaces `callout()`'s own. */
export default defineAdminPlugin({ components: { blockViews: { callout: SiteCalloutView } } });
