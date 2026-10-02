// Owner-only pages and APIs (lib/adminAuth.js): never indexed, and never
// leak their URL (the /admin one carries the key) to another site.
const PRIVATE = [
  '/admin',
  '/insights',
  '/moderate',
  '/create/admin',
  '/api/admin/:path*',
  '/api/analytics',
  '/api/feedback/moderate',
  '/api/feedback/export',
  '/api/create/codes',
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return PRIVATE.map((source) => ({
      source,
      headers: [
        { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        { key: 'Referrer-Policy', value: 'no-referrer' },
      ],
    }));
  },
};
export default nextConfig;
