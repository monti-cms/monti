"use client";

import type { ComponentProps } from "react";
import { Button } from "./button";
import { PageToolbar, PageToolbarEnd } from "./page-header";
import { Spark } from "./spark";
import { Text } from "./text";

/**
 * The toolbar over a grid while the assistant's proposals wait on its tiles (flow 6 · 25: the alt texts of media files): a spark and how many ("Proposals
 * 3") in the proposal blue, then discard all and accept all at the right. Accepting or discarding one, or asking again about it, is in the card its tile
 * opens.
 */
function ProposalBar({
	label,
	discardAllLabel,
	onDiscardAll,
	acceptAllLabel,
	onAcceptAll,
	...props
}: Omit<ComponentProps<typeof PageToolbar>, "children"> & {
	/** How many proposals wait ("Proposals 3"). */
	label: string;
	discardAllLabel: string;
	onDiscardAll: () => void;
	acceptAllLabel: string;
	onAcceptAll: () => void;
}) {
	return (
		<PageToolbar data-slot="proposal-bar" role="toolbar" aria-label={label} {...props}>
			<Text variant="note" tone="proposal" className="flex items-center gap-monti-6">
				<Spark className="size-monti-icon-sm" />
				{label}
			</Text>
			<PageToolbarEnd className="gap-x-monti-16">
				<Button variant="ghost" size="sm" onClick={onDiscardAll}>
					{discardAllLabel}
				</Button>
				<Button size="sm" onClick={onAcceptAll}>
					{acceptAllLabel}
				</Button>
			</PageToolbarEnd>
		</PageToolbar>
	);
}

export { ProposalBar };
