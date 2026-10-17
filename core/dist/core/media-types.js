import { checkKnownKeys, IssueList, pathOf } from "../config/check/issue.js";
/** Only the start of a text file is read to check it. */
export const TEXT_SNIFF_BYTES = 64 * 1024;
const startsWith = (bytes, signature) => signature.every((byte, index) => bytes[index] === byte);
/** Readable as UTF-8 with no NUL bytes (this stops binaries from being uploaded as text files). */
function looksLikeText(bytes) {
    if (bytes.includes(0))
        return false;
    try {
        // Only the start was read, so the last character may be cut off. Exclude the final 3 bytes from the check.
        const end = bytes.length >= TEXT_SNIFF_BYTES ? Math.max(0, bytes.length - 3) : bytes.length;
        new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(0, end));
        return true;
    }
    catch {
        return false;
    }
}
const CODE_EXTENSIONS = [
    "js",
    "mjs",
    "cjs",
    "jsx",
    "ts",
    "tsx",
    "py",
    "java",
    "kt",
    "c",
    "h",
    "cpp",
    "hpp",
    "cs",
    "go",
    "rs",
    "rb",
    "php",
    "swift",
    "dart",
    "scala",
    "css",
    "scss",
    "sass",
    "less",
    "vue",
    "svelte",
    "sql",
    "yml",
    "yaml",
    "toml",
    "ini",
    "env",
    "log",
    "diff",
    "patch",
    "gradle",
    "dockerfile",
];
/**
 * Every media format the core can identify, keyed by MIME type. This is the only place a format is listed: the supported
 * lists, the file key extension, the file name → type lookup and the content check all derive from it. The site config
 * `media.imageTypes` and `fileTypes` choose from these. Config validation (`config/define`) also reads this, so it does not
 * import other modules.
 *
 * - `extensions`: the first is the one used in the file key; all are accepted in a file name for an attachment.
 * - `sniff`: checks an attachment's actual bytes (`sniffBytes` of the start are read). Images have none here: their format,
 *   width and height are read together by `detectImageDimensionsAndType`.
 *
 * Executables and formats that run scripts when a browser opens them, such as HTML and SVG, are not accepted.
 */
export const MEDIA_TYPES = {
    "image/jpeg": { kind: "image", extensions: ["jpg", "jpeg"] },
    "image/png": { kind: "image", extensions: ["png"] },
    "image/webp": { kind: "image", extensions: ["webp"] },
    "image/gif": { kind: "image", extensions: ["gif"] },
    "image/avif": { kind: "image", extensions: ["avif"] },
    "application/pdf": {
        kind: "file",
        extensions: ["pdf"],
        sniffBytes: 8,
        sniff: (bytes) => startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d]), // %PDF-
    },
    "application/zip": {
        kind: "file",
        extensions: ["zip"],
        sniffBytes: 8,
        // Regular zip and empty zip.
        sniff: (bytes) => startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]) || startsWith(bytes, [0x50, 0x4b, 0x05, 0x06]),
    },
    // Source code is stored as a text file (browsers report code file MIME types inconsistently).
    "text/plain": {
        kind: "file",
        extensions: ["txt", ...CODE_EXTENSIONS],
        sniffBytes: TEXT_SNIFF_BYTES,
        sniff: looksLikeText,
    },
    "text/markdown": { kind: "file", extensions: ["md", "markdown"], sniffBytes: TEXT_SNIFF_BYTES, sniff: looksLikeText },
    "text/csv": { kind: "file", extensions: ["csv"], sniffBytes: TEXT_SNIFF_BYTES, sniff: looksLikeText },
    "application/json": { kind: "file", extensions: ["json"], sniffBytes: TEXT_SNIFF_BYTES, sniff: looksLikeText },
};
const mimesOfKind = (kind) => Object.keys(MEDIA_TYPES).filter((mime) => MEDIA_TYPES[mime].kind === kind);
export const SUPPORTED_IMAGE_MIME_TYPES = mimesOfKind("image");
export const SUPPORTED_FILE_MIME_TYPES = mimesOfKind("file");
/** Fixed fact: is this MIME type one of the image formats the core knows? Independent of any site's config. */
export const isImageType = (mimeType) => typeof mimeType === "string" &&
    Object.hasOwn(MEDIA_TYPES, mimeType) &&
    MEDIA_TYPES[mimeType].kind === "image";
/** The extension used in the file key for a type, not taken from the user-supplied filename. */
export const extensionFor = (mimeType) => MEDIA_TYPES[mimeType].extensions[0];
/** The attachment type a file name's extension stands for (any site), or `null`. */
export function fileTypeByExtension(filename) {
    if (!filename.includes("."))
        return null;
    const extension = filename.toLowerCase().split(".").pop() ?? "";
    return (SUPPORTED_FILE_MIME_TYPES.find((mime) => MEDIA_TYPES[mime].extensions.includes(extension)) ??
        null);
}
/** Checks that an attachment's actual bytes match its type. */
export function sniffFile(bytes, mimeType) {
    return MEDIA_TYPES[mimeType].sniff(bytes);
}
/** Defaults: images 10MB and 40 million pixels, attached files 50MB. */
export const DEFAULT_MEDIA_LIMITS = {
    maxImageBytes: 10 * 1024 * 1024,
    maxPixels: 40_000_000,
    maxFileBytes: 50 * 1024 * 1024,
};
const MEDIA_KEYS = ["maxImageBytes", "maxPixels", "maxFileBytes", "imageTypes", "fileTypes"];
/** Checks the media settings of the site config. */
export function checkMediaConfig(media) {
    if (!media)
        return [];
    const list = new IssueList();
    checkKnownKeys(list, "media", media, MEDIA_KEYS);
    for (const key of ["maxImageBytes", "maxPixels", "maxFileBytes"]) {
        const value = media[key];
        if (value !== undefined && (!Number.isInteger(value) || value <= 0)) {
            list.add(pathOf("media", key), "positive-integer", "must be a positive integer");
        }
    }
    const check = (key, supported) => {
        for (const [index, type] of (media[key] ?? []).entries()) {
            if (!supported.includes(type)) {
                list.add(pathOf("media", key, index), "unsupported", `"${type}" is not supported (supported: ${supported.join(", ")})`);
            }
        }
    };
    check("imageTypes", SUPPORTED_IMAGE_MIME_TYPES);
    check("fileTypes", SUPPORTED_FILE_MIME_TYPES);
    if (media.imageTypes?.length === 0)
        list.add("media.imageTypes", "empty", "must not be empty");
    return list.issues;
}
