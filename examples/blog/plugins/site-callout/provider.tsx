"use client";

import { type CmsAdminComponents, CmsAdminComponentsProvider } from "@monti-cms/admin";
import { AttributeInput, ContainerToolbar } from "@monti-cms/admin/blocks";
import { BlockFrame, Content, useBlockEditor } from "@monti-cms/admin/hooks";
import type { ReactNode } from "react";
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
						className="flex-1 font-medium"
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

const components: CmsAdminComponents = { blockViews: { callout: SiteCalloutView } };

/** Registers the view in the admin UI. Later providers win over the `callout()` plugin's own view. */
export function SiteCalloutProvider({ children }: { children: ReactNode }) {
	return <CmsAdminComponentsProvider components={components}>{children}</CmsAdminComponentsProvider>;
}
