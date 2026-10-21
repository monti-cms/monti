import { readStoredDocument } from "../../doc/stored-document.js";
import { parseFile } from "../../front-matter.js";
import { readZipArchive } from "../zip.js";
import { importNotice } from "./notice.js";
/** What an uploaded archive may inflate to, in all. A small archive cannot expand without limit. */
export const MAX_IMPORT_INFLATED_BYTES = 256 * 1024 * 1024;
const decoder = new TextDecoder();
const isRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value) => typeof value === "string" ? value : typeof value === "number" ? String(value) : null;
const hasValue = (value) => value !== null && value !== undefined && value !== "" && !(Array.isArray(value) && value.length === 0);
/** The formats a text file can be read with, by file extension. Only formats that can read text (`import`) count. */
const importableByExtension = (registry) => {
    const byExtension = new Map();
    for (const format of registry.list()) {
        if (format.import && !byExtension.has(format.extension))
            byExtension.set(format.extension, format);
    }
    return byExtension;
};
const json = (data) => {
    if (!data)
        return undefined;
    try {
        return JSON.parse(decoder.decode(data));
    }
    catch {
        return undefined;
    }
};
/**
 * Reads an uploaded archive by the layout this version writes, whichever of the two kinds it is:
 * - an export (it has a `manifest.json`): the entries are those the manifest lists; each is read from its `published` copy, else from its `working` copy;
 * - a folder of `.md` / `.mdx` files with front matter.
 * Nothing is written. An archive that is neither is refused, and so is a text folder whose files no installed format can read.
 */
export function readImportArchive(bytes, options) {
    let files;
    try {
        files = new Map(readZipArchive(bytes, { maxTotalBytes: MAX_IMPORT_INFLATED_BYTES }).map((file) => [file.path, file.data]));
    }
    catch {
        throw importNotice("import.archive.unreadable");
    }
    const manifest = json(files.get("manifest.json"));
    if (isRecord(manifest) && Array.isArray(manifest.entries))
        return readExport(files, manifest.entries, options.formats);
    return readTextFolder(files, options);
}
function readExport(files, listed, registry) {
    const byExtension = importableByExtension(registry);
    const entries = [];
    const used = new Set(["manifest.json"]);
    for (const item of listed) {
        if (!isRecord(item))
            continue;
        const { id, collection, locale, translationGroupId } = item;
        if (typeof id !== "string" ||
            typeof collection !== "string" ||
            typeof locale !== "string" ||
            typeof translationGroupId !== "string")
            continue;
        const base = `entries/${collection}/${id}`;
        const state = item.hasPublished === true ? "published" : "working";
        const header = json(files.get(`${base}/${state}.json`));
        const entry = {
            key: id,
            collection,
            locale,
            group: translationGroupId,
            isSource: translationGroupId === id,
            title: null,
            published: item.status === "published" && item.hasPublished === true,
        };
        for (const path of files.keys())
            if (path.startsWith(`${base}/`))
                used.add(path);
        if (!isRecord(header)) {
            entries.push({ ...entry, slug: null, metadata: {}, body: null, problem: { code: "unreadable" } });
            continue;
        }
        entries.push({
            ...entry,
            slug: text(header.slug),
            metadata: isRecord(header.metadata) ? header.metadata : {},
            body: exportBody(files, base, state, header, byExtension),
        });
    }
    return { kind: "export", entries, otherFiles: files.size - used.size };
}
/**
 * The body of an exported entry. The text file in a format this site has installed comes first, because the links in it are written as paths and resolve to the
 * entries of this site when it is saved. Otherwise the stored document, whose links are by id and are changed to the new ids when the entries are created.
 */
function exportBody(files, base, state, header, byExtension) {
    for (const [extension, format] of byExtension) {
        const data = files.get(`${base}/${state}.${extension}`);
        if (data)
            return { kind: "text", format: format.name, text: decoder.decode(data) };
    }
    // The stored document is its own file in a backup, and part of the entry's file in a public archive.
    const doc = readStoredDocument(json(files.get(`${base}/${state}.doc.json`)) ?? header.doc);
    return doc ? { kind: "doc", doc } : null;
}
const TEXT_FILE = /\.(md|mdx)$/i;
function readTextFolder(files, options) {
    const byExtension = importableByExtension(options.formats);
    const entries = [];
    const missing = new Set();
    let otherFiles = 0;
    for (const [path, data] of files) {
        const segments = path.split("/");
        const name = segments.at(-1) ?? "";
        if (name === "" || segments.some((segment) => segment.startsWith(".") || segment === "__MACOSX"))
            continue;
        const extension = TEXT_FILE.exec(name)?.[1]?.toLowerCase();
        if (!extension) {
            otherFiles += 1;
            continue;
        }
        // Plain Markdown is read by a Markdown format if the site has one, else by the MDX format.
        const format = byExtension.get(extension) ?? (extension === "md" ? byExtension.get("mdx") : undefined);
        if (!format) {
            missing.add(extension);
            continue;
        }
        const parsed = parseFile(decoder.decode(data));
        const collection = segments.length > 1 ? (segments[0] ?? "") : "";
        const stem = name.replace(TEXT_FILE, "");
        const base = { key: path, collection, published: false, isSource: false };
        if (!parsed.ok) {
            entries.push({
                ...base,
                locale: options.site.DEFAULT_LOCALE,
                group: path,
                title: null,
                slug: stem,
                metadata: {},
                body: null,
                problem: {
                    code: "front_matter_invalid",
                    params: { message: parsed.message, ...(parsed.line === undefined ? {} : { line: parsed.line }) },
                },
            });
            continue;
        }
        const { title, slug, locale, ...rest } = parsed.data;
        const slugText = text(slug) ?? stem;
        const localeText = text(locale) ?? options.site.DEFAULT_LOCALE;
        entries.push({
            ...base,
            locale: localeText,
            // Files of one folder with one slug are the languages of one entry.
            group: `${collection}\u0000${slugText}`,
            isSource: localeText === options.site.DEFAULT_LOCALE,
            title: text(title),
            slug: slugText,
            metadata: rest,
            body: { kind: "text", format: format.name, text: parsed.body },
        });
    }
    if (missing.size > 0)
        throw importNotice("import.format.missing", { extension: [...missing].sort().join(", ") });
    if (entries.length === 0)
        throw importNotice("import.archive.unknown");
    return { kind: "markdown", entries, otherFiles };
}
/** The names of the values an entry holds besides the title, for the "fields not imported" list. A value with nothing in it is not a field the archive holds. */
export const heldFieldNames = (metadata, titleName) => Object.entries(metadata)
    .filter(([name, value]) => name !== titleName && hasValue(value))
    .map(([name]) => name);
