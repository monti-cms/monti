/**
 * Monti's blocks and marks (doc 18). A site does not import them from here: `monti add <name>` copies a block's folder into the site's
 * `monti/blocks/`, and from then on the site owns that source. This index is for this package's own tests and for trying them out.
 */
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

export { callout, chart, codeExplorer, collapsible, color, column, columns, math, mermaid, tab, tabs, tooltip };

export const blocks = [callout, tabs, tab, columns, column, collapsible, codeExplorer, math, mermaid, chart];
export const marks = [tooltip, color];
