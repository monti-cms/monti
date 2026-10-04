let language = "en";
let overrides;
/** Sets the UI language and the site's overridden messages. */
export function setMessageContext(next) {
    language = next.language;
    overrides = next.overrides;
}
const fillVars = (text, vars = {}) => text.replace(/\{(\w+)\}/g, (whole, name) => (name in vars ? String(vars[name]) : whole));
/** A translate function for one dictionary. It picks the current language on every call (it can be created before the config is read). */
export function lazyTranslator(bundle) {
    return (key, vars) => {
        const value = overrides?.[bundle.namespace]?.[key] ?? bundle.messages[language]?.[key] ?? bundle.messages.en[key] ?? key;
        return typeof value === "function" ? value(vars ?? {}) : fillVars(value, vars);
    };
}
