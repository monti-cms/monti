import Link from "next/link";

export default function Home() {
	return (
		<main style={{ padding: 32, fontFamily: "system-ui" }}>
			<h1>Example site</h1>
			<p>
				<Link href="/en/blog">Blog</Link>
			</p>
			<p>
				<Link href="/studio">관리자 화면</Link>
			</p>
		</main>
	);
}
