const isEmpty = (value) => value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);
/**
 * Checks transforms against the schema they run under (`site`: the schema after the change). A transform that would be wrong is a problem, so it never runs:
 * a field that is not there to rename to, a `dropField` of a field the schema still has (it would delete live data), a `mapOption` to something that is not an
 * option, a default that is not valid for its field.
 */
export function checkTransforms(site, transforms) {
    const problems = [];
    const problem = (id, message) => problems.push({ id, message });
    for (const [index, item] of transforms.entries()) {
        const at = `${item.collection}`;
        if (!site.isCollection(item.collection)) {
            problem(item.id, `collection "${item.collection}" is not in the schema`);
            continue;
        }
        const stored = (name) => site.storedField(item.collection, name);
        switch (item.op) {
            case "renameField": {
                if (item.from === item.to)
                    problem(item.id, `${at}: "${item.from}" renamed to itself`);
                else if (stored(item.from)) {
                    problem(item.id, `${at}.${item.from} is still a field of the schema; remove it there (or use another transform)`);
                }
                // A rename may point at a name a later rename moves on (a chain).
                const chained = transforms
                    .slice(index + 1)
                    .some((later) => later.op === "renameField" && later.collection === item.collection && later.from === item.to);
                if (!stored(item.to) && !chained)
                    problem(item.id, `${at}.${item.to} is not a field of the schema`);
                break;
            }
            case "mapOption": {
                const field = stored(item.field)?.field;
                if (field?.kind !== "select")
                    problem(item.id, `${at}.${item.field} is not a select field of the schema`);
                else {
                    if (!Object.hasOwn(field.options, item.to))
                        problem(item.id, `${at}.${item.field} has no option "${item.to}"`);
                    if (Object.hasOwn(field.options, item.from)) {
                        problem(item.id, `${at}.${item.field} still has the option "${item.from}"; remove it there first`);
                    }
                }
                break;
            }
            case "dropField": {
                if (stored(item.field)) {
                    problem(item.id, `${at}.${item.field} is still a field of the schema; remove it there first (a drop deletes stored values)`);
                }
                break;
            }
            case "setDefault": {
                const field = stored(item.field)?.field;
                if (field?.kind !== "text" && field?.kind !== "select") {
                    problem(item.id, `${at}.${item.field} is not a text or select field of the schema`);
                }
                else if (item.value === "")
                    problem(item.id, `${at}.${item.field} would get an empty default`);
                else if (field.kind === "select" && !Object.hasOwn(field.options, item.value)) {
                    problem(item.id, `${at}.${item.field} has no option "${item.value}"`);
                }
                else if (field.kind === "text" && field.max !== undefined && [...item.value].length > field.max) {
                    problem(item.id, `${at}.${item.field} allows ${field.max} characters at most`);
                }
                break;
            }
        }
    }
    return problems;
}
/** Which collections a list of transforms touches. */
export const transformCollections = (transforms) => [
    ...new Set(transforms.map((item) => item.collection)),
];
/**
 * Runs the transforms (in order) on the metadata of one stored body of `collection`. The input is not changed. `isTranslation`: the body belongs to a
 * translation, which holds only per-language values.
 */
export function applyTransforms(site, transforms, body, metadata) {
    let current = { ...metadata };
    const changedBy = [];
    const conflicts = [];
    const changed = (id, next) => {
        current = next;
        changedBy.push(id);
    };
    for (const item of transforms) {
        if (item.collection !== body.collection)
            continue;
        switch (item.op) {
            case "renameField": {
                if (!Object.hasOwn(current, item.from))
                    break;
                if (Object.hasOwn(current, item.to) && !isEmpty(current[item.to])) {
                    conflicts.push({ id: item.id, from: item.from, to: item.to });
                    break;
                }
                const { [item.from]: value, ...rest } = current;
                changed(item.id, { ...rest, [item.to]: value });
                break;
            }
            case "mapOption": {
                const value = current[item.field];
                if (typeof value === "string" && value === item.from)
                    changed(item.id, { ...current, [item.field]: item.to });
                else if (Array.isArray(value) && value.includes(item.from)) {
                    const mapped = value.map((entry) => (entry === item.from ? item.to : entry));
                    changed(item.id, { ...current, [item.field]: mapped.filter((entry, at) => mapped.indexOf(entry) === at) });
                }
                break;
            }
            case "dropField": {
                if (!Object.hasOwn(current, item.field))
                    break;
                const { [item.field]: _dropped, ...rest } = current;
                changed(item.id, rest);
                break;
            }
            case "setDefault": {
                if (!isEmpty(current[item.field]))
                    break;
                const stored = site.storedField(item.collection, item.field);
                if (!stored)
                    break;
                // A translation holds per-language values only; a shared value lives on the source.
                if (body.isTranslation && !("localized" in stored.field && stored.field.localized))
                    break;
                // A field in a conditional branch only gets a value where the branch shows.
                if (stored.when && current[stored.when.field] !== stored.when.value)
                    break;
                changed(item.id, { ...current, [item.field]: item.value });
                break;
            }
        }
    }
    return { metadata: current, changedBy, conflicts };
}
/**
 * The transforms that fit a change, for a screen to offer. A removed field offers a drop (and a rename to each field that looks like it was renamed, see
 * `SchemaDiff.renameHints`, when `renameTo` lists candidates); a removed option offers a mapping to each option that is left; a field that became required
 * offers a default. Nothing is offered for a change data does not follow from.
 */
export function suggestTransforms(change, context = {}) {
    switch (change.kind) {
        case "field_removed":
            return [
                ...(context.renameTo ?? []).map((to) => ({ op: "renameField", collection: change.collection, from: change.field, to })),
                { op: "dropField", collection: change.collection, field: change.field },
            ];
        case "option_removed":
            return (context.options ?? [])
                .filter((to) => to !== change.option)
                .map((to) => ({
                op: "mapOption",
                collection: change.collection,
                field: change.field,
                from: change.option,
                to,
            }));
        case "field_required_changed":
        case "field_added": {
            if (!change.required)
                return [];
            // A select offers each option; a text field offers a template with an empty value the screen fills in.
            const values = context.options && context.options.length > 0 ? context.options : [""];
            return values.map((value) => ({
                op: "setDefault",
                collection: change.collection,
                field: change.field,
                value,
            }));
        }
        default:
            return [];
    }
}
