/** Writes a file: the data as front matter, then the body. A body with no text leaves the file as front matter only. */
export declare function composeFile(data: Readonly<Record<string, unknown>>, body: string): string;
export type ParsedFile = {
    readonly ok: true;
    readonly data: Record<string, unknown>;
    readonly body: string;
} | {
    readonly ok: false;
    readonly message: string;
    readonly line?: number;
};
/** Reads a file written by {@link composeFile} (or by hand). A file with no front matter has no data; a front matter that is not a YAML mapping is an error. */
export declare function parseFile(raw: string): ParsedFile;
