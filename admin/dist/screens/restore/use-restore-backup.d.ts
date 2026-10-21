/**
 * The state of one backup restore: whether the site is empty (read before a file is chosen), the file, the preview of what restoring it would do
 * (read at once; nothing is written), and the run. A restore changes everything the admin lists, so every cached read is refetched after it.
 */
export declare function useRestoreBackup(): {
    stateReady: boolean;
    /** Whether the site is empty, so a backup can be restored. Unknown counts as empty: the server checks again. */
    empty: boolean;
    file: File | null;
    /** Takes a file: the previous preview and result are dropped. */
    chooseFile: (next: File) => void;
    reset: () => void;
    limit: number | undefined;
    tooLarge: boolean;
    preview: import("../../api/restore.js").RestorePreview | undefined;
    previewQuery: import("@tanstack/react-query").UseQueryResult<import("../../api/restore.js").RestorePreview, Error>;
    isRunning: boolean;
    runError: unknown;
    result: import("../../api/restore.js").RestoreRun | undefined;
    start: () => void;
};
export type RestoreForm = ReturnType<typeof useRestoreBackup>;
