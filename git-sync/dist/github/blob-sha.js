import { createHash } from "node:crypto";
/** The sha git gives a blob with this text (`sha1("blob <bytes>\0" + content)`): what GitHub returns for a file with exactly this text, so no call is needed to know it. */
export const blobSha = (text) => {
    const bytes = Buffer.from(text, "utf8");
    return createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
};
