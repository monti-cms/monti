const isNothing = (value) => value === undefined || value === null;
export const readAttributes = (definition, attrs) => {
    const props = {};
    const malformed = [];
    for (const [name, attribute] of Object.entries(definition.attributes)) {
        const value = attrs?.[name];
        if (attribute.type === "boolean") {
            if (value === true || value === "true")
                props[name] = true;
            else if (isNothing(value) || value === false || value === "false" || value === "") {
                props[name] = attribute.defaultValue === true && isNothing(value);
            }
            else {
                malformed.push(name);
                props[name] = false;
            }
            continue;
        }
        const fallback = typeof attribute.defaultValue === "string" ? attribute.defaultValue : undefined;
        if (isNothing(value)) {
            props[name] = fallback ?? (attribute.required && !attribute.options ? "" : undefined);
            continue;
        }
        if (typeof value !== "string" && typeof value !== "number") {
            malformed.push(name);
            props[name] = fallback;
            continue;
        }
        const text = String(value);
        if (attribute.options && !Object.hasOwn(attribute.options, text)) {
            // Not one of the choices (the pre-publish check reports it): the default, so the prop stays truthful.
            props[name] = fallback;
            continue;
        }
        props[name] = text;
    }
    return { props, malformed };
};
