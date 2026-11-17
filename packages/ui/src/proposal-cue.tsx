"use client";

import { useUiLabels } from "./labels";

/**
 * What a control with `proposal` says besides its blue: the words of `UiLabels.proposal` ("AI suggestion") as its accessible description.
 * Every control that has the `proposal` state gets it here, so none of them repeats it. For a control that is an input, a button or a switch;
 * a chip, which is only text, uses {@link ProposalNote}.
 */
export function useProposalDescription(proposal: boolean): string | undefined {
	const labels = useUiLabels();
	return proposal ? labels.proposal : undefined;
}

/** The same words as text for screen readers only, for a part that is not a control (a chip). Put it first inside the part. */
export function ProposalNote({ proposal }: { proposal: boolean }) {
	const labels = useUiLabels();
	return proposal ? <span className="sr-only">{labels.proposal}</span> : null;
}
