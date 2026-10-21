import type { BodyTemplate, SkippedTemplate } from "../store/types.js";
/**
 * Which templates of a backup a restore adds. The site keeps the templates it was seeded with, so a template whose id the site already has is skipped, and so is
 * one whose name it has (names are unique, ignoring case); the first of two archive templates with one name wins. Both the preview and the store use this, so they agree.
 */
export declare function splitTemplates(existing: readonly {
    readonly id: string;
    readonly name: string;
}[], incoming: readonly BodyTemplate[]): {
    add: BodyTemplate[];
    skipped: SkippedTemplate[];
};
