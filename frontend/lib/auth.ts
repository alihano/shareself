import type { NextAuthOptions } from "next-auth";
import TwitterProvider from "next-auth/providers/twitter";

// Arena-style registration (train.md): a user's X handle becomes their
// on-chain username directly (SocialFiPlatform.registerUser(username) is
// called with the verified handle) — no separate free-text username field.
// This is OAuth 2.0 "Sign in with X" purely to prove handle ownership before
// that on-chain call; no X data is persisted server-side beyond the session.
export const authOptions: NextAuthOptions = {
  providers: [
    TwitterProvider({
      clientId: process.env.AUTH_TWITTER_ID!,
      clientSecret: process.env.AUTH_TWITTER_SECRET!,
      version: "2.0",
      // Least-privilege: we only need to read the handle once, never call
      // the X API again afterward, so no offline.access (refresh token).
      authorization: { params: { scope: "users.read tweet.read" } },
      profile(profile: { data: { id: string; name: string; username: string; profile_image_url?: string } }) {
        return {
          id: profile.data.id,
          name: profile.data.name,
          username: profile.data.username,
          image: profile.data.profile_image_url ?? null,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) token.username = (user as { username?: string }).username;
      return token;
    },
    session({ session, token }) {
      if (session.user) session.user.username = token.username as string | undefined;
      return session;
    },
  },
};
