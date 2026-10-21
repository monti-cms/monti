import type { ImportRun } from "../../api/import.js";
/** What the import did, entry by entry: a link to every new entry, and the reason for each one that was skipped, failed or stayed a draft. */
export declare function ResultView({ result }: {
    result: ImportRun;
}): import("react").JSX.Element;
