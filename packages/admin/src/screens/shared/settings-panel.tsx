"use client";

import type { ReactNode } from "react";

/**
 * The body of one Settings tab: a slim toolbar (an item count shown dimmed on the left, actions on the right) over the content.
 * A tab with neither draws just the content. The Settings page already provides the frame (sidebar, title, tab bar), so a plugin page renders this, not `AdminShell`.
 */
export function SettingsPanel({
	count,
	actions,
	children,
}: {
	/** Item count shown dimmed in the toolbar. */
	count?: number;
	/** Buttons on the right of the toolbar. */
	actions?: ReactNode;
	children: ReactNode;
}) {
	const toolbar = count !== undefined || actions !== undefined;
	return (
		<div className="flex min-h-0 flex-1 flex-col overflow-hidden" data-testid="settings-panel">
			{toolbar && (
				<div className="flex min-h-12 shrink-0 items-center gap-3 border-b px-4 py-1.5 lg:px-5">
					<span className="tabular min-w-0 flex-1 text-cms-muted-foreground text-sm">{count}</span>
					<div className="flex items-center gap-2">{actions}</div>
				</div>
			)}
			{children}
		</div>
	);
}
