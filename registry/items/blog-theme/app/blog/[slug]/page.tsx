import { BlogPostPage, generateBlogPostMetadata } from "@/registry/monti/blog-theme/blog-post";

export const generateMetadata = generateBlogPostMetadata;

export default BlogPostPage;

// Only valid with cacheComponents: `monti add` keeps this line when next.config turns it on and drops it otherwise.
export const instant = false; // monti:cache-components
