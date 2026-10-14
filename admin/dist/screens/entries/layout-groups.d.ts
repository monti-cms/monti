import { type Site } from "@monti-cms/core/client";
/**
 * What the screens add to the panel's groups, which core works out (`site.panelGroupsOf`, `site.panelTabsOf`, `site.panelTabOf`): the words of the default tab. A tab
 * is its id everywhere in code ({@link DEFAULT_TAB} for the first one, the name a person wrote for the others), and this is the only place the id becomes text, so a
 * tab a person calls "Properties" is not the default tab.
 */
export declare const tabLabel: (site: Pick<Site, "createTranslator">, tab: string) => string;
