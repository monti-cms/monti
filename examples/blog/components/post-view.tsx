import type { ReadEntry } from "@monti-cms/core/read";
import Link from "next/link";
import { ArticleBody } from "@/components/article-body";
import { cms } from "@/monti.config";
import { PostMeta } from "./post-meta";

/** The newer and older post of `entry`, looked up among the 100 newest posts of its language. */
async function neighborsOf(entry: ReadEntry): Promise<{ newer?: ReadEntry; older?: ReadEntry }> {
	const { items } = await cms.read.listEntries({ collection: "post", locale: entry.locale, pageSize: 100 });
	const index = items.findIndex((item) => item.id === entry.id);
	return index === -1 ? {} : { newer: items[index - 1], older: items[index + 1] };
}

function Neighbor({ entry, label, align }: { entry: ReadEntry; label: string; align: "left" | "right" }) {
	return (
		<Link
			href={entry.path ?? `/${entry.locale}/posts/${entry.slug}`}
			className={`block rounded-lg border border-neutral-300 p-4 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900 ${align === "right" ? "text-right" : ""}`}
		>
			<span className="block text-neutral-600 text-xs dark:text-neutral-400">{label}</span>
			<span className="font-medium">{entry.title ?? entry.slug}</span>
		</Link>
	);
}

/** A post: title, byline, table of contents and body (`ArticleBody`), and the newer and older post. Shared by the post page and its draft preview. */
export async function PostView({ entry }: { entry: ReadEntry }) {
	const { newer, older } = await neighborsOf(entry);
	return (
		<main className="mx-auto max-w-2xl px-4 py-12">
			<Link
				href={cms.site.localizePath(entry.locale, "/posts")}
				className="text-neutral-600 text-sm hover:underline dark:text-neutral-400"
			>
				← Posts
			</Link>
			<h1 className="mt-4 mb-2 font-bold text-3xl">{entry.title ?? entry.slug}</h1>
			<div className="mb-8">
				<PostMeta entry={entry} />
			</div>
			<ArticleBody cms={cms} entry={entry} />
			{newer || older ? (
				<nav aria-label="More posts" className="mt-12 grid gap-4 sm:grid-cols-2">
					{older ? <Neighbor entry={older} label="Older post" align="left" /> : <span />}
					{newer ? <Neighbor entry={newer} label="Newer post" align="right" /> : <span />}
				</nav>
			) : null}
		</main>
	);
}
