/** Serve the tool page at the site root. */
const nextConfig = {
  async rewrites() {
    return [{ source: "/", destination: "/app.html" }];
  },
};
export default nextConfig;
