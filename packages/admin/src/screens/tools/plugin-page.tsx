"use client";

import { useTranslator } from "@monti-cms/core/site";
import { Box } from "@monti-cms/ui";
import type { AdminPlugin } from "../../plugins";
import { EmptyState } from "../shared/empty-state";
import { toolsMessages } from "./messages";

/** Draws a plugin's page for a `nav` path. The declaration is read here, in the browser: the server may only refer to a `"use client"` admin module. */
export function PluginToolPage({
	plugin,
	name,
	path,
}: {
	readonly plugin: AdminPlugin | undefined;
	readonly name: string;
	readonly path: string;
}) {
	const t = useTranslator(toolsMessages);
	const Page = plugin?.pages?.[path];
	if (Page) return <Page />;
	return (
		<Box paddingX={32}>
			<EmptyState title={t("missingTitle")} description={t("missingBody", { plugin: name, path })} />
		</Box>
	);
}
