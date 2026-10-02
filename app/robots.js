export default function robots() {
  return {
    rules: [
      // Private pages are not listed here (this file is public); they answer 404
      // without the owner session and carry noindex instead.
      { userAgent: '*', allow: '/' },
    ],
    sitemap: 'https://tralala.cards/sitemap.xml',
  };
}
