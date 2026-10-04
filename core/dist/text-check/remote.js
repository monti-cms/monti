import { defineTextChecker } from "./types.js";
/**
 * A checker that goes through the site's server route. APIs that need a key (Bareun, LanguageTool etc.) are called from the server route,
 * and the browser sends only paragraphs through this checker. The server route is built with `textCheckRoute` from `@monti-cms/core/plugin/server`.
 */
export function remoteTextChecker({ url, headers, ...options }) {
    return defineTextChecker({
        ...options,
        check: async (segments, { signal }) => {
            const response = await fetch(url, {
                method: "POST",
                headers: { "content-type": "application/json", ...headers },
                credentials: "same-origin",
                body: JSON.stringify({ segments }),
                signal,
            });
            const body = (await response.json().catch(() => null));
            if (!response.ok) {
                // If it is the core API error shape (`{ code, message }`), use that message.
                const message = typeof body?.message === "string" ? body.message : `HTTP ${response.status}`;
                throw new Error(message);
            }
            if (!Array.isArray(body?.issues))
                throw new Error("Invalid text check response");
            return body.issues;
        },
    });
}
