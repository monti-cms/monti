import Link from "next/link";

export default function Home() {
	return (
		<main className="mx-auto max-w-2xl px-4 py-12">
			<h1 className="mb-6 font-bold text-3xl">Example blog</h1>
			<ul className="space-y-2">
				<li>
					<Link href="/ko/posts" className="underline">
						Posts (Korean)
					</Link>
				</li>
				<li>
					<Link href="/en/posts" className="underline">
						Posts (English)
					</Link>
				</li>
				<li>
					<Link href="/ko/memos" className="underline">
						Memos
					</Link>
				</li>
				<li>
					<Link href="/studio" className="underline">
						Admin
					</Link>
				</li>
			</ul>
		</main>
	);
}
