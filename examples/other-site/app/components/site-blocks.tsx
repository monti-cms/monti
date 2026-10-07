import type { DocumentComponentsOf } from "@monti-cms/core/render";
import type { cms } from "@/cms.server";

/**
 * Public components of the site blocks in `cms.config.ts`. `DocumentComponentsOf<typeof cms>` is typed from that instance's config, so each component's props come from its
 * block definition: `quote-card` gets `author` and `children`, and the `map` fence gets its text as `source`.
 */
export const siteComponents = {
	blocks: {
		"quote-card": ({ author, children }) => (
			<figure className="my-6 rounded-lg border-neutral-400 border-l-4 bg-neutral-100 px-5 py-3 dark:bg-neutral-800">
				<blockquote className="m-0">{children}</blockquote>
				{author ? <figcaption className="mt-2 text-sm opacity-70">— {author}</figcaption> : null}
			</figure>
		),
		map: ({ source }) => {
			const read = (key: string) => new RegExp(`^${key}\\s+(-?\\d+(?:\\.\\d+)?)`, "m").exec(source)?.[1] ?? "?";
			return (
				<div className="my-6 rounded-lg border border-neutral-400 p-4 text-sm">
					<p className="m-0 font-semibold">Map</p>
					<p className="m-0 opacity-70">
						lat {read("lat")}, lng {read("lng")}
					</p>
				</div>
			);
		},
	},
} satisfies DocumentComponentsOf<typeof cms>;
