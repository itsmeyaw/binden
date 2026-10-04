import "server-only";

import { and, eq } from "drizzle-orm";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import type { GoogleProfile } from "better-auth/social-providers";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { z } from "zod";

import { db } from "@/lib/db";
import * as schema from "@/lib/schema";
import {
  hasReviewerRole,
  readWorkspaceProfile,
  validateIdentity,
  WorkspaceUnavailable,
} from "@/lib/workspace";

const googleKeys = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));
const config = z
  .object({
    BETTER_AUTH_URL: z.url(),
    BETTER_AUTH_SECRET: z.string().min(32),
    GOOGLE_CLIENT_ID: z.string().min(1),
    GOOGLE_CLIENT_SECRET: z.string().min(1),
    GOOGLE_WORKSPACE_DOMAIN: z.string().min(1),
    GOOGLE_REVIEWER_ROLE_ID: z.string().min(1),
  })
  .parse(process.env);

export const auth = betterAuth({
  appName: "Binden",
  baseURL: config.BETTER_AUTH_URL,
  secret: config.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: "pg", schema }),
  socialProviders: {
    google: {
      clientId: config.GOOGLE_CLIENT_ID,
      clientSecret: config.GOOGLE_CLIENT_SECRET,
      hd: config.GOOGLE_WORKSPACE_DOMAIN,
      scope: [
        "https://www.googleapis.com/auth/admin.directory.user.readonly",
        "https://www.googleapis.com/auth/admin.directory.rolemanagement.readonly",
      ],
      accessType: "offline",
      prompt: "select_account consent",
      includeGrantedScopes: false,
      disableIdTokenSignIn: true,
      getUserInfo: async (tokens) => {
        try {
          if (!tokens.idToken || !tokens.accessToken) return null;
          const { payload } = await jwtVerify(tokens.idToken, googleKeys, {
            algorithms: ["RS256"],
            issuer: ["https://accounts.google.com", "accounts.google.com"],
            audience: config.GOOGLE_CLIENT_ID,
            requiredClaims: ["sub", "iat", "exp", "email", "email_verified", "hd"],
            maxTokenAge: "1h",
          });
          const identity = validateIdentity(payload);
          await readWorkspaceProfile(tokens.accessToken, identity.sub, true);
          return {
            user: { name: "", email: `${identity.sub}@google.invalid`, emailVerified: true },
            data: { ...payload, ...identity } as GoogleProfile,
          };
        } catch {
          return null;
        }
      },
    },
  },
  account: {
    encryptOAuthTokens: true,
    storeStateStrategy: "database",
    accountLinking: { enabled: false, disableImplicitLinking: true },
  },
  session: { cookieCache: { enabled: false } },
  databaseHooks: {
    account: {
      create: { before: async (account) => ({ data: { ...account, idToken: null } }) },
      update: { before: async (account) => ({ data: { ...account, idToken: null } }) },
    },
  },
  onAPIError: { errorURL: "/login?error=sign-in" },
});

export async function getReviewAccess(headers: Headers) {
  try {
    const session = await auth.api.getSession({ headers });
    if (!session) return { status: "signed-out" } as const;
    const [account] = await db
      .select()
      .from(schema.account)
      .where(
        and(eq(schema.account.userId, session.user.id), eq(schema.account.providerId, "google")),
      );
    if (!account) throw new WorkspaceUnavailable(true);
    const token = await auth.api.getAccessToken({ headers, body: { accountId: account.id } });
    if (
      !token.accessToken ||
      (token.accessTokenExpiresAt && new Date(token.accessTokenExpiresAt).getTime() <= Date.now())
    )
      throw new WorkspaceUnavailable(true);
    const profile = await readWorkspaceProfile(token.accessToken, account.accountId);
    if (!(await hasReviewerRole(token.accessToken, profile.id, config.GOOGLE_REVIEWER_ROLE_ID)))
      return { status: "denied" } as const;
    return { status: "available", profile } as const;
  } catch (error) {
    return {
      status:
        error instanceof WorkspaceUnavailable && error.reconnect ? "reconnect" : "unavailable",
    } as const;
  }
}
