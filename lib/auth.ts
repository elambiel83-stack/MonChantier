import { timingSafeEqual, createHash } from "crypto";
import type { NextAuthOptions } from "next-auth";
import AppleProvider from "next-auth/providers/apple";
import CredentialsProvider from "next-auth/providers/credentials";
import FacebookProvider from "next-auth/providers/facebook";
import GoogleProvider from "next-auth/providers/google";
import { verifyPhoneOtp } from "./phoneAuth";
import { AppRole, DEFAULT_ROLE } from "./roles";
import { getStoredRole, isIdentityActive } from "./roleStore";
import { checkRateLimit } from "./rateLimit";
import { verifyAdminTotp } from './totp';

function safeEqual(a: string, b: string): boolean {
  const hashA = createHash("sha256").update(a).digest();
  const hashB = createHash("sha256").update(b).digest();
  return timingSafeEqual(hashA, hashB);
}

function getAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export async function resolveRole(identity: string | null): Promise<AppRole> {
  if (!identity) return DEFAULT_ROLE;
  if (!(await isIdentityActive(identity))) return DEFAULT_ROLE;

  if (identity.includes("@") && getAdminEmails().includes(identity)) {
    return "admin";
  }

  const stored = await getStoredRole(identity);
  return stored || DEFAULT_ROLE;
}

type TikTokProfile = {
  data?: {
    user?: {
      open_id?: string;
      display_name?: string;
      avatar_url?: string;
    };
  };
};

const tikTokProvider = {
  id: "tiktok",
  name: "TikTok",
  type: "oauth" as const,
  authorization: {
    url: "https://www.tiktok.com/v2/auth/authorize/",
    params: {
      scope: "user.info.basic",
      response_type: "code",
    },
  },
  token: "https://open.tiktokapis.com/v2/oauth/token/",
  userinfo: "https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url",
  clientId: process.env.TIKTOK_CLIENT_ID || "",
  clientSecret: process.env.TIKTOK_CLIENT_SECRET || "",
  profile(profile: TikTokProfile) {
    return {
      id: profile.data?.user?.open_id || "tiktok-user",
      name: profile.data?.user?.display_name || "TikTok User",
      image: profile.data?.user?.avatar_url,
      email: null,
    };
  },
};

const buildProviders = (): NextAuthOptions["providers"] => {
  const configuredProviders: NextAuthOptions["providers"] = [
    CredentialsProvider({
      id: "phone",
      name: "Phone",
      credentials: {
        phone: { label: "Phone", type: "text" },
        code: { label: "Code", type: "text" },
      },
      async authorize(credentials) {
        const phone = credentials?.phone?.trim() || "";
        const code = credentials?.code?.trim() || "";

        if (!phone || !code) return null;

        const isValid = await verifyPhoneOtp(phone, code);
        if (!isValid) return null;

        return {
          id: `phone:${phone}`,
          name: phone,
          email: null,
        };
      },
    }),
    CredentialsProvider({
      id: "admin-login",
      name: "Administrateur",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mot de passe", type: "password" },
        totp: { label: "Code MFA", type: "text" },
      },
      async authorize(credentials, req) {
        const expectedEmail = (process.env.ADMIN_LOGIN_EMAIL || "").trim().toLowerCase();
        const expectedPassword = process.env.ADMIN_LOGIN_PASSWORD || "";
        if (!expectedEmail || !expectedPassword) return null;

        const email = credentials?.email?.trim().toLowerCase() || "";
        const password = credentials?.password || "";
        const totp = credentials?.totp || "";
        if (!email || !password || !totp) return null;

        const forwardedFor = req?.headers?.["x-forwarded-for"];
        const ip = typeof forwardedFor === "string" ? forwardedFor.split(",")[0].trim() : "unknown";

        // Two independent buckets, as with OTP requests: per-email caps brute-forcing
        // the known admin password, per-IP caps a single source hammering many emails
        // and stops one attacker from locking the real admin out via the email bucket.
        const byEmail = checkRateLimit(`admin-login:email:${email}`, { max: 5, windowMs: 15 * 60 * 1000 });
        const byIp = checkRateLimit(`admin-login:ip:${ip}`, { max: 20, windowMs: 15 * 60 * 1000 });
        if (!byEmail.allowed || !byIp.allowed) return null;

        if (!safeEqual(email, expectedEmail) || !safeEqual(password, expectedPassword) || !verifyAdminTotp(totp)) {
          return null;
        }

        return {
          id: email,
          name: "Administrateur",
          email,
        };
      },
    }),
  ];

  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    configuredProviders.push(
      GoogleProvider({
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        // Endpoints fixes au lieu de la découverte OIDC dynamique (wellKnown) :
        // celle-ci fait un fetch réseau vers accounts.google.com avant même la
        // redirection, et échoue avec "OAuthSignin" sur les réseaux qui bloquent
        // ou ralentissent l'accès à ce endpoint spécifique.
        wellKnown: undefined,
        // Sans wellKnown, aucun jwks_uri n'est disponible pour vérifier l'id_token:
        // on désactive la vérification OIDC et on récupère le profil via l'endpoint
        // userinfo classique (OAuth2 pur) à la place.
        idToken: false,
        // Requis même sans wellKnown: Google renvoie un paramètre `iss` sur le
        // callback OAuth, qu'openid-client valide contre issuer.issuer — sans
        // cette valeur l'assertion échoue et le callback part en erreur.
        issuer: "https://accounts.google.com",
        authorization: {
          url: "https://accounts.google.com/o/oauth2/v2/auth",
          params: { scope: "openid email profile" },
        },
        token: "https://oauth2.googleapis.com/token",
        userinfo: "https://openidconnect.googleapis.com/v1/userinfo",
      })
    );
  }

  if (process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET) {
    configuredProviders.push(
      FacebookProvider({
        clientId: process.env.FACEBOOK_CLIENT_ID,
        clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
      })
    );
  }

  if (process.env.TIKTOK_CLIENT_ID && process.env.TIKTOK_CLIENT_SECRET) {
    configuredProviders.push(tikTokProvider);
  }

  if (process.env.APPLE_ID && process.env.APPLE_SECRET) {
    configuredProviders.push(
      AppleProvider({
        clientId: process.env.APPLE_ID,
        clientSecret: process.env.APPLE_SECRET,
      })
    );
  }

  return configuredProviders;
};

export const authOptions: NextAuthOptions = {
  providers: buildProviders(),
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/auth/signin",
  },
  callbacks: {
      async jwt({ token }) {
        const identity =
        typeof token.email === "string" && token.email
          ? token.email.toLowerCase()
          : typeof token.sub === "string"
          ? token.sub
          : null;

      token.identity = identity || undefined;
      token.role = await resolveRole(identity);
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.identity = token.identity || session.user.email || undefined;
        session.user.role = token.role;
      }
      return session;
    },
  },
};
