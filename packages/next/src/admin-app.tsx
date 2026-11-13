"use client";

import { type AdminBlockDefinition, type AdminPlugin, httpTransport, MontiAdmin } from "@monti-cms/admin";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

/**
 * The admin in the browser. It is drawn only there: its screens read the address, the window and what the browser keeps, which a server has none
 * of. Its API is `api` under the page's own address (the admin moves between screens by the address's `#`, so the path stays the page's).
 */
export function AdminApp({
	siteName,
	blocks,
	plugins,
}: {
	siteName: string;
	blocks?: AdminBlockDefinition[];
	plugins?: AdminPlugin[];
}) {
	const apiBase = `${usePathname().replace(/\/$/, "")}/api`;
	const transport = useMemo(() => httpTransport(apiBase), [apiBase]);
	const [denied, setDenied] = useState<string | null | undefined>(undefined);
	// The GitHub account that was turned away comes back in the address (`?denied=`).
	useEffect(() => setDenied(new URLSearchParams(window.location.search).get("denied")), []);
	if (denied === undefined) return null;
	return (
		<div className="monti-admin min-h-screen bg-monti-page text-monti-default">
			<MontiAdmin
				transport={transport}
				apiBase={apiBase}
				siteName={siteName}
				blocks={blocks}
				plugins={plugins}
				{...(denied ? { denied } : {})}
			/>
		</div>
	);
}
