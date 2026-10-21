import { type ImportMapping, type ImportPreview } from "../../api/import.js";
/** Archive collection → where it goes, as the preview says it goes now. */
export declare const mappingOf: (preview: ImportPreview) => ImportMapping;
/**
 * The state of one entry import: the file, the preview of what it holds (read again whenever a collection's target changes), the publish choice, and the run.
 * Choosing a file reads it at once; nothing is written until the run.
 */
export declare function useImportEntries(): {
    file: File | null;
    /** Takes a file: the previous preview, choices and result are dropped. */
    chooseFile: (next: File) => void;
    reset: () => void;
    limit: number | undefined;
    tooLarge: boolean;
    preview: ImportPreview | undefined;
    previewQuery: import("@tanstack/react-query").UseQueryResult<ImportPreview, Error>;
    /** Where an archive collection goes: a collection of this site, or `null` to skip it. */
    setTarget: (collection: string, target: string | null) => void;
    publish: boolean;
    setPublish: import("react").Dispatch<import("react").SetStateAction<boolean>>;
    isRunning: boolean;
    runError: unknown;
    result: import("../../api/import.js").ImportRun | undefined;
    start: () => void;
};
export type ImportForm = ReturnType<typeof useImportEntries>;
