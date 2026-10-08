const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const UUID = "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";
/** Compiles the path pattern of a target. `render` and `parse` are inverses for every path the pattern produces. */
export function createPathPattern({ target, locales, extension }) {
    const folder = target.folder ? `${target.folder}/` : "";
    const groups = [];
    let source = "";
    let last = 0;
    for (const match of target.path.matchAll(/\{([a-z]+)\}/g)) {
        source += escapeRegExp(target.path.slice(last, match.index));
        last = (match.index ?? 0) + match[0].length;
        const name = match[1] ?? "";
        groups.push(name);
        switch (name) {
            case "collection":
                source += `(${target.collections.map(escapeRegExp).join("|")})`;
                break;
            case "locale":
                source += `(${locales.map(escapeRegExp).join("|")})`;
                break;
            case "slug":
                source += "([^/]+?)";
                break;
            case "id":
                source += `(${UUID})`;
                break;
            case "ext":
                source += escapeRegExp(extension);
                groups.pop();
                break;
        }
    }
    source += escapeRegExp(target.path.slice(last));
    const regex = new RegExp(`^${escapeRegExp(folder)}${source}$`);
    return {
        render: (values) => `${folder}${target.path.replace(/\{([a-z]+)\}/g, (_all, name) => name === "ext" ? extension : (values[name] ?? ""))}`,
        parse: (path) => {
            const found = regex.exec(path);
            if (!found)
                return null;
            const parts = {};
            groups.forEach((name, index) => {
                const value = found[index + 1];
                if (value !== undefined && (name === "collection" || name === "slug" || name === "locale" || name === "id")) {
                    parts[name] = value;
                }
            });
            return parts;
        },
    };
}
