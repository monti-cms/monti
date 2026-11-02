import type { Site } from "@monti-cms/core/site";
import { type AiActionDefinition, type ResolvedAiAction, resolveAction } from "./action";
import { type AiActionView, viewOf } from "./action-view";
import { actionsMessages } from "./actions.messages";
import { AiError } from "./errors";
import { aiRegistryOf } from "./registry";

/** The actions of the site config (`ai({ actions })`): the quick tasks the admin runs. Used by the actions list and the run API. */

export type { AiActionView } from "./action-view";

const definitionOf = (site: Site, key: string): AiActionDefinition => {
	const definition = aiRegistryOf(site).actionDefinition(key);
	if (!definition) throw new AiError("not_found", site.createTranslator(actionsMessages)("unknownAction"));
	return definition;
};

/** One action of the site config, ready to run. */
export const getAction = (site: Site, key: string): ResolvedAiAction => resolveAction(key, definitionOf(site, key));

/** The actions of the site config, in config order. */
export const listActions = (site: Site): AiActionView[] =>
	Object.entries(aiRegistryOf(site).actions).map(([key, definition]) => viewOf(resolveAction(key, definition)));

/** The texts of the prompt snippets of the site config (`ai({ snippets })`), by key: what `{{snippet.key}}` in a prompt becomes. */
export const snippetTexts = (site: Site): Record<string, string> =>
	Object.fromEntries(Object.entries(aiRegistryOf(site).snippets).map(([key, snippet]) => [key, snippet.text]));
