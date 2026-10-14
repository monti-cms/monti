import type { InitReport } from "./init-types.js";
/** The text of `monti init`: the progress line after the files are written, and the plain summary at the end. */
/** The progress line after the files are written: what was created and what was changed, since an edit of the person's own file is not a new file. */
export declare function writtenLine(report: Pick<InitReport, "created" | "overwritten" | "changed">): string;
/** Where Monti's files go and why, so the paths in the lists below make sense. */
export declare const placementLine: (src: boolean) => string;
/** The plain summary: what was done, then what is left, numbered. */
export declare function formatInitReport(report: InitReport): string;
