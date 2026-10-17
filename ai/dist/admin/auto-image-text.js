"use client";
import { AI_PLUGIN } from "../name.js";
import { runAiAction } from "./ai-slot-provider.js";
import { listAiActions } from "./api.js";
/** The actions `autoImageText` runs, and the field each one fills. */
const ACTIONS = [
    ["imageAlt", "alt"],
    ["imageCaption", "caption"],
];
const firstText = (result) => result.kind === "candidates" ? result.items[0]?.value : result.kind === "text" ? result.text : undefined;
/**
 * `editor.imageInserted` of the AI plugin: runs `imageAlt` and `imageCaption` on the inserted image and fills each
 * empty field with the first candidate. An action that is off or whose connection is not ready is skipped; a failure is the editor's notice.
 */
export async function autoImageText(event) {
    const { site, image, signal } = event;
    if (!image.mediaId && !image.src?.startsWith("/"))
        return;
    const wanted = ACTIONS.filter(([, field]) => !(field === "alt" ? image.alt || image.decorative : image.caption));
    if (wanted.length === 0)
        return;
    const { usable } = await listAiActions(site, { signal });
    const input = {
        image: { ...(image.mediaId ? { mediaId: image.mediaId } : { src: image.src }) },
        around: event.around,
    };
    await Promise.all(wanted
        .filter(([action]) => usable.includes(action))
        .map(async ([action, field]) => {
        const text = firstText(await runAiAction(site, action, input, { signal }));
        if (text)
            event.fill({ [field]: text });
    }));
}
/**
 * The AI plugin's admin events: `autoImageText` only with `ai({ autoImageText: true })`, so without it the image dialog still asks for alt text. A
 * function of a `"use client"` module, so the browser receives it.
 */
export const aiAdminEvents = (site) => site.pluginOptions(AI_PLUGIN)?.autoImageText ? { editor: { imageInserted: [autoImageText] } } : {};
