import { BlogListPage, generateBlogListMetadata } from "@/registry/monti/blog-theme/blog-list";

export const generateMetadata = generateBlogListMetadata;

export default BlogListPage;

// Only valid with cacheComponents: `monti add` keeps this line when next.config turns it on and drops it otherwise.
export const instant = false; // monti:cache-components
