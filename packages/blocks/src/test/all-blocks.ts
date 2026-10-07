import { callout, chart, codeExplorer, codeRef, collapsible, color, columns, mermaid, tabs, tooltip } from "../index";

/**
 * Every block extension of the package, one call each, in the order the tests install them (inline marks: tooltip, then code ref, then text color).
 * Tests only: a site lists the ones it wants itself, one per line.
 */
export const allBlocks = () =>
	[
		callout(),
		collapsible(),
		tabs(),
		columns(),
		codeExplorer(),
		mermaid(),
		chart(),
		tooltip(),
		codeRef(),
		color(),
	] as const;
