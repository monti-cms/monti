import { runMessages } from "./run.messages.js";
const matchesPattern = (pattern, value) => {
    try {
        return new RegExp(pattern, "u").test(value);
    }
    catch {
        return false;
    }
};
/** Does it pass one fixed check? Code checks are not looked at here (the runner calls them separately). */
function passes(check, value, env) {
    switch (check.kind) {
        case "pattern":
            return matchesPattern(check.pattern, value);
        case "maxLength":
            return Array.from(value).length <= check.max;
        case "exists":
            return env.options?.has(value) ?? false;
        case "oneOf":
            return check.items.includes(value);
        case "code":
            return true;
    }
}
export function checkCandidates(checks, raw, env) {
    const current = new Set(Array.isArray(env.current) ? env.current : env.current ? [env.current] : []);
    const seen = new Set();
    const items = [];
    for (const value of raw.map((text) => text.trim())) {
        if (!value || seen.has(value) || current.has(value))
            continue;
        seen.add(value);
        if (checks.some((check) => check.enabled && !passes(check, value, env)))
            continue;
        items.push({ value, label: env.options?.get(value) ?? value });
    }
    return items;
}
/** Check for long-text results. Returns the reason if it fails. */
export function checkText(site, checks, text) {
    const t = site.createTranslator(runMessages);
    if (!text.trim())
        return t("emptyResult");
    for (const check of checks) {
        if (!check.enabled)
            continue;
        if (check.kind === "pattern" && !matchesPattern(check.pattern, text.trim()))
            return t("check.format");
        if (check.kind === "maxLength" && Array.from(text.trim()).length > check.max)
            return t("check.maxLength", { max: check.max });
        if (check.kind === "oneOf" && !check.items.includes(text.trim()))
            return t("check.oneOf");
    }
    return null;
}
