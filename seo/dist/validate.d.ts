import { type ConfigIssue, type PluginConfigView } from "@monti-cms/core";
/**
 * Checks that SEO roles are attached to fields of the right kind (`validate` of `seo()`). Title, description and canonical URL must be text, the share image media,
 * and hiding a select field that has a `noindex` option.
 */
export declare function checkSeoFields({ collections }: Pick<PluginConfigView, "collections">): ConfigIssue[];
