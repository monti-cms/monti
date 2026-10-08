/**
 * Read-only notice listing the values of fields the site has removed. The values are kept with the entry and saved back unchanged,
 * but no input edits them, so the author is told they exist. Renders nothing when there are none.
 */
export declare function RemovedFieldsNotice({ collection, metadata, }: {
    collection: string;
    metadata: Readonly<Record<string, unknown>> | undefined;
}): import("react").JSX.Element | null;
