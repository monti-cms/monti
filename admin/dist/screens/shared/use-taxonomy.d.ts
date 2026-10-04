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
 * Record options like tags and categories shared by the edit screen, bulk actions and list filters.
 * New items are created in the taxonomy add slot (`useRecordCreator`), and the created item is shown right away with `remember`.
 */
export declare function useTaxonomy(collection: RecordCollection, enabled?: boolean): {
    options: TaxonomyOption[];
    error: string | null;
    reload: () => Promise<void>;
    remember: (option: TaxonomyOption) => void;
};
/**
 * Reads options of a collection's taxonomy fields (tags, categories, etc.) per field name. Used by list filters, bulk actions and row menus.
 * Fields pointing to the same collection are read only once.
 */
export declare function useTaxonomyOptions(collection: string, enabled?: boolean): TaxonomyOptions;
