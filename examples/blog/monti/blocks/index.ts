// The site's blocks and marks (doc 18). `monti add` adds to these lists, and the site may add its own.
// monti.config.ts and the site's renderDocument read them; the admin page reads them through admin.ts.
import type { AnyBlockDefinition, MarkDefinition } from "@monti-cms/core";
import { callout } from "./callout";
import { chart } from "./chart";
import { codeExplorer } from "./code-explorer";
import { collapsible } from "./collapsible";
import { color } from "./color";
import { column, columns } from "./columns";
import { math } from "./math";
import { mermaid } from "./mermaid";
import { tab, tabs } from "./tabs";
import { tooltip } from "./tooltip";

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
