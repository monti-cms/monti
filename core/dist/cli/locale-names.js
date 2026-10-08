/** Reading languages out of file and folder names (`hello.ko.mdx`, `ko/hello.mdx`), for `monti init` (which languages the site has). */
/**
 * Whether a name is the code of a real language, as a file or folder name writes it: two letters (`ko`, `pt-BR`). Three-letter codes are left out on purpose, because
 * too many of them are also ordinary words in a file name (`min`, `dev`, `ref`).
 */
export function isLanguageCode(value) {
    const [primary = "", ...region] = value.split(/[-_]/);
    if (!/^[A-Za-z]{2}$/.test(primary) || region.some((part) => !/^[A-Za-z0-9]{2,8}$/.test(part)))
        return false;
    const code = primary.toLowerCase();
    try {
        const name = new Intl.DisplayNames(["en"], { type: "language" }).of(code);
        return name !== undefined && name.toLowerCase() !== code;
    }
    catch {
        return false;
    }
}
/** A language code the way a site writes it: the language in lower case, the rest as given, joined with `-` (`pt_BR` -> `pt-BR`). */
export function normalizeLanguageCode(value) {
    const [primary = "", ...rest] = value.split(/[-_]/);
    return [primary.toLowerCase(), ...rest].join("-");
}
/**
 * Puts the default language first: the one whose files have no pair (a blog written in one language with some posts translated has its originals there), the
 * one with the most such files when several have; with no unpaired files, or a tie, the first one. The rest keep their order.
 */
export function defaultFirst(locales) {
    let best = locales[0];
    for (const locale of locales)
        if (best && locale.unpaired > best.unpaired)
            best = locale;
    return best ? [best, ...locales.filter((locale) => locale !== best)] : [];
}
const SUFFIXED = /^(.+)\.([A-Za-z]{2}(?:[-_][A-Za-z0-9]{2,8})*)\.(?:md|mdx)$/i;
const PLAIN = /^(.+)\.(?:md|mdx)$/i;
/**
 * The languages named by the suffixes of the files of one folder (`hello.ko.mdx` and `hello.en.mdx`), default first, or `undefined` when fewer than two files carry one
 * (a lone `notes.it.md` is more likely a name than a language).
 */
export function localesFromFileNames(names) {
    const groups = new Map();
    let suffixed = 0;
    for (const name of [...names].sort()) {
        const match = SUFFIXED.exec(name);
        const code = match?.[2];
        if (match && code && isLanguageCode(code)) {
            suffixed++;
            const base = match[1] ?? name;
            groups.set(base, (groups.get(base) ?? new Set()).add(normalizeLanguageCode(code)));
        }
        else {
            // A file with no suffix is the post in the language of the site; it pairs with a suffixed file of the same name.
            const base = PLAIN.exec(name)?.[1];
            if (base)
                groups.set(base, (groups.get(base) ?? new Set()).add(""));
        }
    }
    if (suffixed < 2)
        return undefined;
    const tally = new Map();
    for (const members of groups.values()) {
        for (const code of members) {
            if (code === "")
                continue;
            const entry = tally.get(code) ?? { files: 0, unpaired: 0 };
            entry.files++;
            if (members.size === 1)
                entry.unpaired++;
            tally.set(code, entry);
        }
    }
    return defaultFirst([...tally].map(([code, counts]) => ({ code, ...counts })));
}
