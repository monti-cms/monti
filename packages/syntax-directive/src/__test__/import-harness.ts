import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { crc32, deflateSync } from "node:zlib";
import { type CollectionSchema, defineCollection, defineSite, fields } from "@monti-cms/core";
import { type Cms, type CmsAuth, createCms, postgres } from "@monti-cms/core/server";
import { createIsolatedTestPool, dropIsolatedTestPool } from "@monti-cms/core/testing";
import { mdx } from "@monti-cms/mdx";
import { directiveSyntax } from "../index";

/**
 * A CMS for the `monti import` tests: a blog schema (posts with tags and a category, tags and categories as items), English and Korean, the `mdx` format with
 * the directive notation, Postgres in an isolated schema, and a media storage in memory that takes its uploads over a local HTTP server (the same presigned
 * `PUT` the S3 storage uses).
 */

const title = fields.text({ label: "Title", required: true, max: 200, localized: true });
const slug = fields.slug({ label: "Slug", from: "title", required: true, localized: "inherit" });

const post = defineCollection({
	label: "Post",
	kind: "document",
	path: "/posts/:slug",
	fields: {
		title,
		slug,
		summary: fields.text({ label: "Summary", multiline: true, localized: true, role: "summary", required: true }),
		tagIds: fields.relation({ label: "Tags", to: "tag", many: true }),
		categoryId: fields.relation({ label: "Category", to: "category" }),
	},
});
const tag = defineCollection({
	label: "Tag",
	kind: "item",
	fields: {
		title: fields.text({ label: "Name", required: true, max: 200, localized: true }),
		slug: fields.slug({ label: "Slug", from: "title", required: true }),
	},
});
const category = defineCollection({
	label: "Category",
	kind: "item",
	fields: {
		title: fields.text({ label: "Name", required: true, max: 200, localized: true }),
		slug: fields.slug({ label: "Slug", from: "title", required: true }),
	},
});

export const blogCollections: Record<string, CollectionSchema> = { post, tag, category };

export const blogConfig = (withMdx = true) =>
	defineSite({
		collections: { post, tag, category },
		locales: [
			{ code: "en", name: "English" },
			{ code: "ko", name: "한국어" },
		],
		defaultLocale: "en",
		plugins: withMdx ? [mdx({ syntax: [directiveSyntax()] })] : [],
	});

export const adminAuth = (): CmsAuth => ({
	basePath: "/api/cms/auth",
	handlers: { GET: async () => new Response("auth"), POST: async () => new Response("auth") },
	session: async () => ({ user: { id: "admin", accountId: "admin" } }),
	providers: [],
	signIn: async () => undefined,
	signOut: async () => undefined,
	isAdmin: (userId) => userId === "admin",
	devBypass: false,
	devUserId: "admin",
});

/** Media storage in memory. Uploads are `PUT`s to a local server; promoting moves the object from its staging key. */
export async function fakeMediaStorage() {
	const objects = new Map<string, { bytes: Buffer; contentType: string }>();
	const server: Server = createServer((request, response) => {
		const chunks: Buffer[] = [];
		request.on("data", (chunk: Buffer) => chunks.push(chunk));
		request.on("end", () => {
			const key = decodeURIComponent((request.url ?? "/").slice(1));
			objects.set(key, { bytes: Buffer.concat(chunks), contentType: String(request.headers["content-type"] ?? "") });
			response.statusCode = 200;
			response.end();
		});
	});
	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
	const port = (server.address() as { port: number }).port;
	const store = {
		prepareUpload: async (input: { stagingKey: string; contentType: string }) => ({
			url: `http://127.0.0.1:${port}/${encodeURIComponent(input.stagingKey)}`,
			method: "PUT" as const,
			requiredHeaders: { "content-type": input.contentType },
			expiresAt: new Date(Date.now() + 60_000),
		}),
		headFile: async ({ key }: { key: string }) => {
			const object = objects.get(key);
			return object
				? { key, contentType: object.contentType, contentLength: object.bytes.byteLength, etag: `etag-${key}` }
				: null;
		},
		readFile: async ({ key }: { key: string }) => {
			const object = objects.get(key);
			if (!object) throw new Error(`no object ${key}`);
			return new Uint8Array(object.bytes);
		},
		promoteFile: async (input: { stagingKey: string; finalKey: string; contentType: string }) => {
			const object = objects.get(input.stagingKey);
			if (!object) throw new Error(`no object ${input.stagingKey}`);
			objects.set(input.finalKey, { bytes: object.bytes, contentType: input.contentType });
			objects.delete(input.stagingKey);
			return {
				key: input.finalKey,
				contentType: input.contentType,
				contentLength: object.bytes.byteLength,
			};
		},
		deleteFile: async ({ key }: { key: string }) => {
			objects.delete(key);
		},
		getPublicUrl: (key: string) => `https://cdn.test/${key}`,
	};
	return {
		objects,
		store,
		close: () => new Promise<void>((resolve) => server.close(() => resolve())),
	};
}

export interface ImportHarness {
	readonly cms: Cms;
	/** A scratch project folder with the fixtures copied in. */
	readonly dir: string;
	readonly media: Awaited<ReturnType<typeof fakeMediaStorage>>;
	readonly schemaName: string;
	close(): Promise<void>;
}

/** A solid-colour PNG, so two images differ in their bytes. */
export function png(width: number, height: number, shade: number): Buffer {
	const chunk = (type: string, data: Buffer) => {
		const body = Buffer.concat([Buffer.from(type), data]);
		const out = Buffer.alloc(8 + data.length + 4);
		out.writeUInt32BE(data.length, 0);
		body.copy(out, 4);
		out.writeUInt32BE(crc32(body), 8 + data.length);
		return out;
	};
	const header = Buffer.alloc(13);
	header.writeUInt32BE(width, 0);
	header.writeUInt32BE(height, 4);
	header[8] = 8;
	header[9] = 0;
	const rows = Buffer.concat(
		Array.from({ length: height }, () => Buffer.concat([Buffer.from([0]), Buffer.alloc(width, shade)])),
	);
	return Buffer.concat([
		Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
		chunk("IHDR", header),
		chunk("IDAT", deflateSync(rows)),
		chunk("IEND", Buffer.alloc(0)),
	]);
}

/** A project folder with the import fixtures and the two images the posts point to. */
export function copyFixtures(): string {
	const dir = mkdtempSync(path.join(tmpdir(), "monti-import-"));
	cpSync(path.join(__dirname, "import-fixtures"), dir, { recursive: true });
	mkdirSync(path.join(dir, "contentlayer/public/images"), { recursive: true });
	writeFileSync(path.join(dir, "contentlayer/public/images/diagram.png"), png(4, 3, 90));
	mkdirSync(path.join(dir, "astro/src/assets"), { recursive: true });
	writeFileSync(path.join(dir, "astro/src/assets/cover.png"), png(5, 2, 200));
	return dir;
}

/** A CMS instance over the isolated schema `schemaName`, with the blog config; `media` is the storage in memory, or none. */
export function createImportCms(schemaName: string, media?: Awaited<ReturnType<typeof fakeMediaStorage>>): Cms {
	return createCms({
		config: blogConfig(true),
		server: {
			database: postgres({ connectionString: process.env.CMS_TEST_DATABASE_URL, schema: schemaName }),
			auth: { name: "test", create: adminAuth },
			secret: "a-long-test-secret-for-the-import-tests",
			...(media ? { media: { name: "fake", createStore: () => media.store as never } } : {}),
		},
	});
}

export async function createImportHarness(
	options: { withMdx?: boolean; withMedia?: boolean } = {},
): Promise<ImportHarness> {
	const media = await fakeMediaStorage();
	const { pool, schemaName } = await createIsolatedTestPool();
	const cms =
		options.withMdx === false
			? createCms({
					config: blogConfig(false),
					server: {
						database: postgres({ connectionString: process.env.CMS_TEST_DATABASE_URL, schema: schemaName }),
						auth: { name: "test", create: adminAuth },
						secret: "a-long-test-secret-for-the-import-tests",
					},
				})
			: createImportCms(schemaName, options.withMedia === false ? undefined : media);
	await cms.migrate({ log: () => undefined });
	const dir = copyFixtures();
	return {
		cms,
		dir,
		media,
		schemaName,
		async close() {
			await cms.close();
			await dropIsolatedTestPool(pool, schemaName);
			await media.close();
			rmSync(dir, { recursive: true, force: true });
		},
	};
}
