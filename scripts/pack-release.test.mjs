// The release bundle (docs/design/features/20-release.md): what `pack-release.mjs` makes of a small workspace, and what it refuses to make.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import {
	builtSideEffects,
	bundleReadme,
	packRelease,
	saysClient,
	tarballName,
	unwanted,
	withBundleAddresses,
} from "./pack-release.mjs";

/** A workspace of two packages, the second using the first, built by hand: `files` is what each one's `package.json` and folders hold. */
function workspace(change = {}) {
	const root = mkdtempSync(path.join(tmpdir(), "monti-pack-test-"));
	const write = (file, text) => {
		mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
		writeFileSync(path.join(root, file), text);
	};
	write("LICENSE", "MIT\n");
	write("pnpm-workspace.yaml", 'packages:\n  - "packages/*"\n');
	write("package.json", '{ "name": "fixture", "private": true }\n');
	const manifest = (name, more) =>
		JSON.stringify(
			{
				name: `@monti-cms/${name}`,
				version: "1.2.3",
				type: "module",
				files: ["dist", "README.md"],
				exports: { ".": "./src/index.ts" },
				publishConfig: { exports: { ".": { types: "./dist/index.d.ts", default: "./dist/index.js" } } },
				...more,
			},
			null,
			"\t",
		);
	write("packages/core/package.json", manifest("core", change.core));
	write("packages/core/README.md", "# core\n");
	write("packages/core/src/index.ts", "export const one = 1;\n");
	write("packages/core/src/index.test.ts", "// a test\n");
	write("packages/core/dist/index.js", "export const one = 1;\n");
	write("packages/core/dist/index.d.ts", "export declare const one = 1;\n");
	write(
		"packages/admin/package.json",
		manifest("admin", {
			dependencies: { "@monti-cms/core": "workspace:*" },
			exports: { ".": "./src/index.ts", "./styles.css": "./dist/styles.css" },
			publishConfig: {
				exports: {
					".": { types: "./dist/index.d.ts", default: "./dist/index.js" },
					"./styles.css": "./dist/styles.css",
				},
			},
			...change.admin,
		}),
	);
	write("packages/admin/src/index.ts", 'export { Screen } from "./screen";\n');
	write("packages/admin/src/screen.tsx", '// The screen.\n"use client";\nexport const Screen = () => null;\n');
	write("packages/admin/dist/index.js", 'export { Screen } from "./screen.js";\n');
	write("packages/admin/dist/index.d.ts", 'export { Screen } from "./screen.js";\n');
	write("packages/admin/dist/screen.js", change.screen ?? '"use client";\nexport const Screen = () => null;\n');
	write("packages/admin/dist/screen.d.ts", "export declare const Screen: () => null;\n");
	write("packages/admin/dist/styles.css", ".monti-admin{}\n");
	for (const [file, text] of Object.entries(change.files ?? {})) write(file, text);
	// The packages know each other (`workspace:*` is read from the installed workspace); nothing comes from a registry.
	execFileSync("pnpm", ["install", "--offline", "--ignore-scripts", "--silent"], { cwd: root, stdio: "ignore" });
	return root;
}

/** The files of a tarball, and its `package.json`. */
function opened(tarball) {
	const files = execFileSync("tar", ["-tzf", tarball], { encoding: "utf8" })
		.split("\n")
		.filter((file) => file && !file.endsWith("/"))
		.map((file) => file.replace(/^package\//, ""));
	const manifest = JSON.parse(execFileSync("tar", ["-xzOf", tarball, "package/package.json"], { encoding: "utf8" }));
	return { files, manifest };
}

const quiet = (run) => {
	const log = console.log;
	console.log = () => {};
	try {
		return run();
	} finally {
		console.log = log;
	}
};
const pack = (root, base) => {
	const out = path.join(root, "out");
	const made = quiet(() => packRelease({ root, out, base }));
	return { out, made };
};

test("20-1 a tarball holds every file its exports name, its license and readme, and no sources or tests", () => {
	const root = workspace();
	try {
		const { out, made } = pack(root);
		assert.deepEqual(readdirSync(out).sort(), ["README.md", "monti-cms-admin-1.2.3.tgz", "monti-cms-core-1.2.3.tgz"]);
		assert.equal(made.version, "1.2.3");
		const core = opened(path.join(out, "monti-cms-core-1.2.3.tgz"));
		assert.deepEqual(core.files.sort(), ["LICENSE", "README.md", "dist/index.d.ts", "dist/index.js", "package.json"]);
		// The exports are the built ones.
		assert.deepEqual(core.manifest.exports, { ".": { types: "./dist/index.d.ts", default: "./dist/index.js" } });
		const admin = opened(path.join(out, "monti-cms-admin-1.2.3.tgz"));
		assert.ok(admin.files.includes("dist/styles.css"));
		assert.deepEqual(unwanted(admin.files), []);
		// Nothing but the package's files: no `._name` entries of a Mac's tar.
		assert.deepEqual(
			[...core.files, ...admin.files].filter((file) => path.basename(file).startsWith("._")),
			[],
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("20-1 the bundle is not made when versions differ, when an export names a file that is not built, or when sources or stories got in", () => {
	const differing = workspace({ core: { version: "1.2.4" } });
	const unbuilt = workspace({
		core: {
			exports: { ".": "./src/index.ts", "./cli": "./src/cli.ts" },
			publishConfig: {
				exports: {
					".": { types: "./dist/index.d.ts", default: "./dist/index.js" },
					"./cli": { types: "./dist/cli.d.ts", default: "./dist/cli.js" },
				},
			},
		},
	});
	const sources = workspace({ core: { files: ["dist", "src", "README.md"] } });
	const stories = workspace({ files: { "packages/core/dist/button.stories.js": "export default {};\n" } });
	try {
		assert.throws(() => pack(differing), /versions differ: .*1\.2\.4/);
		assert.throws(() => pack(unbuilt), /@monti-cms\/core: the tarball has no dist\/cli\.d\.ts, dist\/cli\.js/);
		assert.throws(
			() => pack(sources),
			/@monti-cms\/core: the tarball holds src\/index\.test\.ts, src\/index\.ts|holds src\/index\.ts/,
		);
		assert.throws(() => pack(stories), /@monti-cms\/core: the tarball holds dist\/button\.stories\.js/);
	} finally {
		for (const root of [differing, unbuilt, sources, stories]) rmSync(root, { recursive: true, force: true });
	}
});

test("20-2 with a base the bundle's packages name each other by the bundle's address, and without one by the version", () => {
	const root = workspace();
	try {
		const plain = opened(path.join(pack(root).out, "monti-cms-admin-1.2.3.tgz"));
		assert.deepEqual(plain.manifest.dependencies, { "@monti-cms/core": "1.2.3" });
		const base = "https://example.dev/releases/v1.2.3/";
		const { out } = pack(root, base);
		const addressed = opened(path.join(out, "monti-cms-admin-1.2.3.tgz"));
		assert.deepEqual(addressed.manifest.dependencies, {
			"@monti-cms/core": "https://example.dev/releases/v1.2.3/monti-cms-core-1.2.3.tgz",
		});
		// The bundle's README gives the line to install by, with the same addresses: the core and the admin (this workspace has no adapter),
		// and nothing of what follows from them is asked of the person.
		const readme = readFileSync(path.join(out, "README.md"), "utf8");
		assert.match(
			readme,
			/npm install https:\/\/example\.dev\/releases\/v1\.2\.3\/monti-cms-core-1\.2\.3\.tgz https:\/\/example\.dev\/releases\/v1\.2\.3\/monti-cms-admin-1\.2\.3\.tgz\n/,
		);
		assert.match(readme, /the rest follow/);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("20-2 peer and optional packages of the bundle are addressed too, and the name of a tarball is npm's", () => {
	assert.equal(tarballName("@monti-cms/storage-s3", "0.2.0-next.1"), "monti-cms-storage-s3-0.2.0-next.1.tgz");
	assert.deepEqual(
		withBundleAddresses(
			{
				version: "2.0.0",
				dependencies: { zod: "^4" },
				peerDependencies: { "@monti-cms/core": "2.0.0", react: ">=19" },
				optionalDependencies: { "@monti-cms/ai": "2.0.0" },
			},
			"file:///tmp/bundle",
		),
		{
			version: "2.0.0",
			dependencies: { zod: "^4" },
			peerDependencies: { "@monti-cms/core": "file:///tmp/bundle/monti-cms-core-2.0.0.tgz", react: ">=19" },
			optionalDependencies: { "@monti-cms/ai": "file:///tmp/bundle/monti-cms-ai-2.0.0.tgz" },
		},
	);
});

test('20-14 a file whose source says "use client" starts with it in the tarball, or the bundle is not made', () => {
	const kept = workspace();
	const stripped = workspace({ screen: "export const Screen = () => null;\n" });
	try {
		assert.doesNotThrow(() => pack(kept));
		assert.throws(() => pack(stripped), /@monti-cms\/admin: "use client" is gone from dist\/screen\.js/);
	} finally {
		for (const root of [kept, stripped]) rmSync(root, { recursive: true, force: true });
	}
	// The line counts where a bundler reads it: first, after comments only.
	assert.equal(saysClient('"use client";\nexport {};'), true);
	assert.equal(saysClient("// A note.\n/* and another */\n'use client'\nexport {};"), true);
	assert.equal(saysClient('import x from "y";\n"use client";'), false);
	assert.equal(saysClient('const said = "use client";'), false);
});

test("20-2 without a base the install line names every tarball of the bundle, and with one only what a site uses itself", () => {
	const packages = ["admin", "ai", "core", "next", "ui"].map((short) => ({
		name: `@monti-cms/${short}`,
		tarball: `monti-cms-${short}-0.2.0.tgz`,
	}));
	const plain = bundleReadme({ version: "0.2.0", packages });
	// By version the packages are on no registry: the admin's `@monti-cms/ui@0.2.0` is found only if its tarball is installed with it.
	assert.match(
		plain,
		/npm install \.\/monti-cms-admin-0\.2\.0\.tgz \.\/monti-cms-ai-0\.2\.0\.tgz \.\/monti-cms-core-0\.2\.0\.tgz \.\/monti-cms-next-0\.2\.0\.tgz \.\/monti-cms-ui-0\.2\.0\.tgz\n/,
	);
	assert.doesNotMatch(plain, /the rest follow/);
	assert.match(plain, /install every tarball together/);
	const addressed = bundleReadme({ version: "0.2.0", packages, base: "https://example.dev/v0.2.0" });
	assert.match(
		addressed,
		/npm install https:\/\/example\.dev\/v0\.2\.0\/monti-cms-core-0\.2\.0\.tgz https:\/\/example\.dev\/v0\.2\.0\/monti-cms-admin-0\.2\.0\.tgz https:\/\/example\.dev\/v0\.2\.0\/monti-cms-next-0\.2\.0\.tgz\n/,
	);
	// After the install comes the command that sets the site up: the one the release's proof runs in a fresh site.
	for (const readme of [plain, addressed]) assert.match(readme, /\.tgz\nnpx monti init\n/);
});

test("20-1 a file named as having side effects is named by its built file in the tarball, with the stylesheets, and must be in it", () => {
	assert.deepEqual(builtSideEffects(["./src/admin.tsx"]), ["./dist/admin.js", "**/*.css"]);
	assert.deepEqual(builtSideEffects(["./src/a.ts", "./dist/styles.css"]), ["./dist/a.js", "./dist/styles.css"]);
	assert.equal(builtSideEffects(false), false);
	const named = workspace({ admin: { sideEffects: ["./src/screen.tsx"] } });
	const lost = workspace({ admin: { sideEffects: ["./src/nowhere.tsx"] } });
	try {
		const { out } = pack(named);
		assert.deepEqual(opened(path.join(out, "monti-cms-admin-1.2.3.tgz")).manifest.sideEffects, [
			"./dist/screen.js",
			"**/*.css",
		]);
		assert.throws(() => pack(lost), /@monti-cms\/admin: "sideEffects" names dist\/nowhere\.js/);
	} finally {
		for (const root of [named, lost]) rmSync(root, { recursive: true, force: true });
	}
});
