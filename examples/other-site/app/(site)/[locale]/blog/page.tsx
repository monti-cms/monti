import { isLocale } from "@monti-cms/core/client";
import { listEntries } from "@monti-cms/core/read";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

/** 글 목록(발행일 최신순). 주소·관계 이름은 읽기 API가 붙여 준다. */
export default async function BlogPage({
	params,
	searchParams,
}: {
	params: Promise<{ locale: string }>;
	searchParams: Promise<{ page?: string }>;
}) {
	const { locale } = await params;
	if (!isLocale(locale)) notFound();
	const page = Math.max(1, Number((await searchParams).page ?? 1) || 1);
	const { items, total, pageSize } = await listEntries({ collection: "article", locale, page, pageSize: 10 });
	return (
		<main className="mx-auto max-w-2xl px-4 py-12">
			<h1 className="mb-8 font-bold text-3xl">Blog</h1>
			<ul className="space-y-6">
				{items.map((entry) => (
					<li key={entry.id}>
						<Link href={entry.path ?? "#"} className="font-semibold text-xl hover:underline">
							{entry.title}
						</Link>
						<p className="text-sm opacity-70">
							{entry.publishedAt?.toISOString().slice(0, 10)}
							{entry.relations.topicIds?.length
								? ` · ${entry.relations.topicIds.map((topic) => topic.title).join(", ")}`
								: ""}
						</p>
						{entry.metadata.excerpt ? <p className="mt-1">{entry.metadata.excerpt}</p> : null}
					</li>
				))}
			</ul>
			{items.length === 0 ? <p>No posts yet.</p> : null}
			{page * pageSize < total ? (
				<Link href={`?page=${page + 1}`} className="mt-8 inline-block underline">
					Older posts
				</Link>
			) : null}
		</main>
	);
}
