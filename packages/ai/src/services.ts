import type { PluginKeyService } from "@monti-cms/core";
import type { Site } from "@monti-cms/core/site";
import { AiError } from "./errors";
import { providerMessages } from "./provider.messages";
import { type AiServiceId, serviceHeaders, serviceUrl } from "./service-models";
import { servicesMessages } from "./services.messages";

/** The key check and the add-dialog entries of the AI services (`keyServices`). Server only: it calls the services. */

/**
 * Asks the service for its model list with the key: a refusal (401, 403) means the key is wrong. A server that has no list (404) takes any key.
 * Anything else that goes wrong is a problem reaching the service, not a verdict on the key.
 */
async function checkKey(
	site: Pick<Site, "createTranslator">,
	service: AiServiceId,
	input: { url: string; value: string | null },
): Promise<"ok" | "rejected"> {
	const t = site.createTranslator(providerMessages);
	let response: Response;
	try {
		response = await fetch(`${serviceUrl(service, input.url)}/models`, {
			headers: serviceHeaders(service, input.value),
			signal: AbortSignal.timeout(15_000),
		});
	} catch {
		throw new AiError("upstream_failed", t("unreachable"));
	}
	if (response.status === 401 || response.status === 403) return "rejected";
	if (response.ok || response.status === 404) return "ok";
	throw new AiError("upstream_failed", t("unreachable"));
}

/** The services the AI plugin offers keys for (`keyServices`), in the order the add dialog lists them. */
export function aiKeyServices(site: Pick<Site, "createTranslator">): PluginKeyService[] {
	const t = site.createTranslator(servicesMessages);
	const check = (service: AiServiceId) => (input: { url: string; value: string | null }) =>
		checkKey(site, service, input);
	return [
		{ id: "anthropic", label: "Anthropic", group: "ai", keyPlaceholder: "sk-ant-…", check: check("anthropic") },
		{ id: "openai", label: "OpenAI", group: "ai", keyPlaceholder: "sk-…", check: check("openai") },
		{ id: "openrouter", label: "OpenRouter", group: "ai", keyPlaceholder: "sk-or-…", check: check("openrouter") },
		{ id: "google", label: "Google", group: "ai", keyPlaceholder: "AIza…", check: check("google") },
		{
			id: "openai-compatible",
			label: t("compatible"),
			group: "ai",
			hint: "Ollama",
			url: { placeholder: "http://localhost:11434/v1" },
			keyOptional: true,
			check: check("openai-compatible"),
		},
	];
}
