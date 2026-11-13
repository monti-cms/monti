/**
 * Monti's blocks and marks (doc 18). A site does not import them from here: `monti add <name>` copies a block's folder into the site's
 * `monti/blocks/`, and from then on the site owns that source. This list is the same one `monti add` writes there, for this package's own tests.
 */
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

export { callout, chart, codeExplorer, collapsible, color, column, columns, math, mermaid, tab, tabs, tooltip };

export const blocks = [callout, tabs, tab, columns, column, collapsible, codeExplorer, math, mermaid, chart];
export const marks = [tooltip, color];
