import { notFound } from "next/navigation";

// Every address no other route takes: not found, on the site's own page (`../not-found.tsx`) rather than Next's bare one. With two root
// layouts there is no `app/not-found.tsx` to do it.
export default function Page() {
	notFound();
}
