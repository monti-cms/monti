# Fill in alt text when an image goes in

Goal: when an editor drops, pastes or picks an image, its alt text is filled in from the image's file name (`team-photo_2024.jpg` becomes "team photo 2024"), without waiting and without ever writing over what the person typed. The same event is how `ai({ autoImageText: true })` fills alt text and caption with the AI plugin.

The code below is the recipe's own files in [`src/filename-alt/`](src/filename-alt/), type checked in CI.

## What you need to know

1. **`editor.imageInserted` is an admin event**: a plugin's admin side lists its subscribers in `defineAdminPlugin({ on: { editor: { imageInserted: [...] } } })`, the same shape as `on` on the server ("Admin events" in the [admin README](../../packages/admin/README.md)). It is past tense: the image is already in when it runs, and nothing it does can stop the insert.
2. **Drop, paste, the slash menu and the toolbar all insert through the image dialog**, so the event fires for each of them. While a plugin listens, the dialog lets the alt text be left empty.
3. **The image shows that its text is being written** while any subscriber runs. A subscriber that throws clears that state and shows a short notice; the image and the other subscribers are not affected.
4. **`fill({ alt, caption })` never overwrites.** It writes a field only while it is still empty and the person has not typed in it since the insert, and writes nothing once the image was removed (`signal` is aborted then). It returns whether it wrote anything.
5. **A subscriber is a client function**, so it goes in the plugin's `"use client"` admin module.

## The code

The admin module, with the subscriber and its declaration:

<!-- src/filename-alt/admin.tsx -->
```tsx
"use client";

import { adminFetch, defineAdminPlugin, type ImageInserted } from "@monti-cms/admin";

/** `team-photo_2024.jpg` becomes "team photo 2024". */
const textOfFilename = (filename: string) =>
	filename
		.replace(/\.[a-z0-9]+$/i, "")
		.replace(/[-_]+/g, " ")
		.trim();

/** Fills an empty alt text from the file name of the library image. `fill` writes only while the field is still empty and untouched. */
const altFromFilename: ImageInserted = async ({ image, site, signal, fill }) => {
	if (!image.mediaId || image.alt || image.decorative) return;
	const media = await adminFetch<{ filename: string }>(site, `/v1/media/${encodeURIComponent(image.mediaId)}`, {
		signal,
	});
	fill({ alt: textOfFilename(media.filename) });
};

export default defineAdminPlugin({ on: { editor: { imageInserted: [altFromFilename] } } });
```

The plugin (`plugins: [filenameAlt()]` in `monti.config.ts`):

<!-- src/filename-alt/index.ts -->
```ts
import { definePlugin } from "@monti-cms/core";

export const filenameAlt = () => definePlugin({ name: "filename-alt", admin: () => import("./admin") });
```

## How it behaves

- The image goes in at once with an empty alt text, shows "Writing the image text…" for as long as the request takes, then has its alt text.
- Typing in the alt field before the answer comes keeps what you typed: the answer is dropped.
- Removing the image before the answer comes aborts the request (`signal`) and writes nothing.
- An image that is not a library item (`image.src`) has no file name to read, so the subscriber leaves it alone.
