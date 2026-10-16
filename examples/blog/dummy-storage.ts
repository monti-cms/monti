import type { MediaAdapter, MediaStore } from "@monti-cms/core/adapters";

const DEMO_PUBLIC_BASE = "https://images.unsplash.com/";

/**
 * A dummy storage adapter for demo and preview purposes.
 * Enables the media library UI in the admin without requiring S3 credentials or upload buckets.
 * Serves preview media from public CDN URLs.
 */
export function dummyStorage(): MediaAdapter {
	return {
		name: "dummy",
		createStore: (): MediaStore => ({
			prepareUpload: async () => {
				throw new Error("File uploads are disabled in demo mode.");
			},
			headFile: async (input) => ({
				key: input.key,
				contentType: input.key.endsWith(".png") ? "image/png" : "image/jpeg",
				contentLength: 102400,
			}),
			readFile: async () => new Uint8Array(),
			promoteFile: async () => {
				throw new Error("File uploads are disabled in demo mode.");
			},
			deleteFile: async () => {},
			getPublicUrl: (key: string) => {
				if (key.startsWith("http://") || key.startsWith("https://")) return key;
				return `${DEMO_PUBLIC_BASE}${key}`;
			},
		}),
	};
}
