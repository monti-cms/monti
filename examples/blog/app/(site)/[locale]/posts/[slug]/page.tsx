import { BlogPostPage, generateBlogPostMetadata } from "@/components/monti/blog-theme/blog-post";

export const generateMetadata = generateBlogPostMetadata;

export default BlogPostPage;

// The page waits for the request before anything is sent, so a missing post is a real 404; with cacheComponents that needs instant = false.
export const instant = false;
