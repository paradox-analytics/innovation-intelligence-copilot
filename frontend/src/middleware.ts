import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/login",
  },
});

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - / (landing page)
     * - /login
     * - /api/auth/* (NextAuth routes)
     * - /_next/* (Next.js internals)
     * - /favicon.ico, /robots.txt, /sitemap.xml (static files)
     */
    "/((?!$|login|api/auth|_next|favicon\\.ico|robots\\.txt|sitemap\\.xml).*)",
  ],
};
