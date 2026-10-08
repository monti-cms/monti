const isJsonArray = (value) => Array.isArray(value);
/** Copies a JSON value with object keys sorted at every depth (`undefined` members are dropped). */
export function sortKeys(value) {
    if (value === null || typeof value !== "object")
        return value;
    if (isJsonArray(value))
        return value.map(sortKeys);
    const record = value;
    return Object.keys(record)
        .sort()
        .reduce((acc, key) => {
        const member = record[key];
        if (member !== undefined)
            acc[key] = sortKeys(member);
        return acc;
    }, {});
}
