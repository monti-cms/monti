/** Reads JSON with comments and trailing commas (tsconfig). Leaves `//` and `/*` inside strings alone. `undefined` if it cannot be read. */
export function parseJsonc(text) {
    let out = "";
    let inString = false;
    for (let index = 0; index < text.length; index++) {
        const char = text[index];
        const next = text[index + 1];
        if (inString) {
            out += char;
            if (char === "\\") {
                out += next ?? "";
                index++;
            }
            else if (char === '"')
                inString = false;
            continue;
        }
        if (char === '"') {
            inString = true;
            out += char;
        }
        else if (char === "/" && next === "/") {
            while (index < text.length && text[index] !== "\n")
                index++;
            out += "\n";
        }
        else if (char === "/" && next === "*") {
            index += 2;
            while (index < text.length && !(text[index] === "*" && text[index + 1] === "/"))
                index++;
            index++;
        }
        else
            out += char;
    }
    try {
        return JSON.parse(out.replace(/,(\s*[}\]])/g, "$1"));
    }
    catch {
        return undefined;
    }
}
