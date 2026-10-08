/** The Git sync screen: what each target did last, "Pull now", the conflicts with a diff, and the token and webhook secret. */
export declare function GitSyncPage(): import("react").JSX.Element;
/** The server text against the git text as a line diff: `-` lines are only on the server, `+` lines only in git. */
export declare function ConflictDiff({ serverText, gitText }: {
    serverText: string | null;
    gitText: string;
}): import("react").JSX.Element;
