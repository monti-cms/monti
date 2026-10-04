import type { FieldViewProps } from "@monti-cms/admin";
import type { EntryData, EntryForm } from "@monti-cms/admin/kit";
import { type SchemaCollection } from "@monti-cms/core/client";
/**
 * Current value of a role field. In a translation, fields that are not per-language read the source value (the same as the properties panel showing the source value).
 */
export declare function seoRoleValue(collection: SchemaCollection, role: string, form: EntryForm, entry: Pick<EntryData, "source"> | null): string;
/** Title and description for the search result and share preview. Falls back to the title and summary when empty. */
export declare function seoPreviewText(collection: SchemaCollection, form: EntryForm, entry: Pick<EntryData, "source"> | null): {
    title: string;
    description: string;
};
/** Preview shaped like a search result and a share card. Values come from the field roles. */
export declare function SeoPreview({ collection, form, entry, }: {
    collection: SchemaCollection;
    form: EntryForm;
    entry: EntryData | null;
}): import("react").JSX.Element;
/** The view of the `search` view field. */
export declare function SeoPreviewView({ collection, form, entry }: FieldViewProps): import("react").JSX.Element | null;
