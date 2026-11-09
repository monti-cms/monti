import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, type Plugin } from "vite";
import { fonts } from "../vitest";

type Site = { handle(request: Request): Promise<Response | null> };

/** The core's server-only modules, left out of the page as in Storybook (`packages/admin/.storybook/main.ts`); the server side keeps the real ones. */
function serverOnly(): Plugin {
	const stub = fileURLToPath(new URL("../../packages/admin/.storybook/node-stub.ts", import.meta.url));
	const modules = new Set(["pg", "node:fs/promises", "node:path"]);
	return {
		name: "monti-e2e-server-only",
		enforce: "pre",
		resolveId(id) {
			return this.environment.name === "client" && modules.has(id) ? stub : null;
		},
	};
}

/** Puts the site's server in front of Vite: what `handle` answers goes to it, the rest is the admin's page. */
function montiServer(): Plugin {
	return {
		name: "monti-e2e-server",
		configureServer(server) {
			const started = server
				.ssrLoadModule(fileURLToPath(new URL("./site.ts", import.meta.url)))
				.then((module) => (module.startSite as () => Promise<Site>)());
			server.middlewares.use((incoming, outgoing, next) => {
				void (async () => {
					const url = new URL(incoming.url ?? "/", `http://${incoming.headers.host}`);
					const hasBody = incoming.method !== "GET" && incoming.method !== "HEAD";
					const request = new Request(url, {
						method: incoming.method,
						headers: incoming.headers as Record<string, string>,
						...(hasBody ? { body: Readable.toWeb(incoming) as ReadableStream, duplex: "half" } : {}),
					});
					const site = await started;
					const answer = await site.handle(request);
					if (!answer) return next();
					outgoing.statusCode = answer.status;
					answer.headers.forEach((value, name) => {
						outgoing.appendHeader(name, value);
					});
					outgoing.end(Buffer.from(await answer.arrayBuffer()));
				})().catch(next);
			});
		},
	};
}

// `pnpm test:e2e` starts this; it is also the server the usability driver runs on (docs/plans/09-media.md, 1.4).
export default defineConfig({
	root: fileURLToPath(new URL(".", import.meta.url)),
	plugins: [serverOnly(), tailwindcss(), fonts(), montiServer()],
	server: { fs: { allow: [fileURLToPath(new URL("../..", import.meta.url))] } },
	optimizeDeps: { entries: ["main.tsx"], exclude: ["pg"] },
});
