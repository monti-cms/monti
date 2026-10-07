import { BlogListPage, generateBlogListMetadata } from "@/components/monti/blog-theme/blog-list";

export const generateMetadata = generateBlogListMetadata;

export default BlogListPage;

// The page waits for the request before anything is sent, so a missing post is a real 404; with cacheComponents that needs instant = false.
export const instant = false;
