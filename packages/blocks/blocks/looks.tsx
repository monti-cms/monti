/// <reference path="./css.d.ts" />
/**
 * The site's looks of the blocks the reference screens draw (a callout, a formula, a diagram, a chart), in one import, for a page that shows them outside a site: the
 * admin's reference screens. A site loads each block's own look itself (doc 18); this file is not copied by `monti add`.
 */
import "./base.css";
import "./callout/callout.css";
import "./chart/chart.css";
import "./math/math.css";
import "./mermaid/mermaid.css";
