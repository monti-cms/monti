import { type ChartDslParseResult, type NormalizeChartResult } from "./types.js";
export declare const parseChartDsl: (source: string) => ChartDslParseResult;
export declare const normalizeChartDsl: (parsed: ChartDslParseResult) => NormalizeChartResult;
