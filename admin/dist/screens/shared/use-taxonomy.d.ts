/** Name of the record collection. Used for relation field options and adding. */
export type RecordCollection = string;
/** Taxonomy field name -> options of the collection the field points to. */
export type TaxonomyOptions = Readonly<Record<string, readonly TaxonomyOption[]>>;
export interface TaxonomyOption {
    id: string;
    title: string;
    slug: string | null;
}
/**
 * Reads options of a collection's taxonomy fields (tags, categories, etc.) per field name. Used by list filters, bulk actions and row menus.
 * Fields pointing to the same collection are read only once.
 */
export declare function useTaxonomyOptions(collection: string, enabled?: boolean): TaxonomyOptions;
