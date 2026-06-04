import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
    CredentialsProvider({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        fullName: { label: "Full Name", type: "text" },
        isSignUp: { label: "Sign Up", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        try {
          if (credentials.isSignUp === "true") {
            const registerRes = await fetch(`${API_URL}/auth/register`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                email: credentials.email,
                password: credentials.password,
                full_name: credentials.fullName || credentials.email.split("@")[0],
              }),
            });
            if (!registerRes.ok) {
              const err = await registerRes.json();
              throw new Error(err.detail || err.error?.message || "Registration failed");
            }
          }

          const loginRes = await fetch(`${API_URL}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: credentials.email,
              password: credentials.password,
            }),
          });

          if (!loginRes.ok) {
            throw new Error("Invalid email or password");
          }

          const loginData = await loginRes.json();
          const userData = loginData.data;

          return {
            id: userData.user_id || credentials.email,
            email: credentials.email,
            name: credentials.fullName || credentials.email.split("@")[0],
            accessToken: userData.access_token,
          };
        } catch (error) {
          throw error instanceof Error ? error : new Error("Authentication failed");
        }
      },
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email ?? "";
        token.accessToken = (user as unknown as Record<string, unknown>).accessToken as string | undefined;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
      }
      return session;
    },
  },
};

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email: string;
      image?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    email: string;
    accessToken?: string;
  }
}
