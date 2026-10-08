import type { BlockValidate } from "@monti-cms/core";
/** Checks the source of a chart with its own parser (`parseChartDsl`, `normalizeChartDsl`): one issue per syntax error, with the line it is on. */
export declare const validateChartBlock: BlockValidate;
