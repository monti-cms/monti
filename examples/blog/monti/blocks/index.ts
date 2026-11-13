// The site's blocks and marks (doc 18). `monti add` adds to these lists, and the site may add its own.
// monti.config.ts and the site's renderDocument read them; the admin page reads them through admin.ts.
import type { AnyBlockDefinition, MarkDefinition } from "@monti-cms/core";
import { callout } from "./callout/callout";
import { chart } from "./chart/chart";
import { codeExplorer } from "./code-explorer/code-explorer";
import { collapsible } from "./collapsible/collapsible";
import { color } from "./color/color";
import { column, columns } from "./columns/columns";
import { math } from "./math/math";
import { mermaid } from "./mermaid/mermaid";
import { tab, tabs } from "./tabs/tabs";
import { tooltip } from "./tooltip/tooltip";

export const blocks: AnyBlockDefinition[] = [
	callout,
	tabs,
	tab,
	columns,
	column,
	collapsible,
	codeExplorer,
	math,
	mermaid,
	chart,
];

export const marks: MarkDefinition[] = [tooltip, color];
