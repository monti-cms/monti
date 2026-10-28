"use client";

import { useTranslator } from "@monti-cms/core/site";
import type { AdminPlugin } from "../../plugins";
import { EmptyState } from "../shared/empty-state";
import { toolsMessages } from "./messages";
import { ToolsFrame } from "./tools-frame";
import type { ToolsTab } from "./tools-tabs";

/**
 * A plugin's page as a tab of the tools page. The declaration is read here, in the browser: the server may only refer to a `"use client"` admin module.
 * The page draws its body, and any action it has, itself.
 */
export function PluginToolPage({ tab, plugin }: { readonly tab: ToolsTab; readonly plugin: AdminPlugin | undefined }) {
	const t = useTranslator(toolsMessages);
	const Page = plugin?.pages?.[tab.path];
	return (
		<ToolsFrame tab={tab.id}>
			{Page ? (
				<Page />
			) : (
				<EmptyState
					title={t("missingTitle")}
					description={t("missingBody", { plugin: tab.plugin ?? "", path: tab.path })}
				/>
			)}
		</ToolsFrame>
	);
}
