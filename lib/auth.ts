import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import FacebookProvider from "next-auth/providers/facebook";
import GoogleProvider from "next-auth/providers/google";
import { verifyPhoneOtp } from "./phoneAuth";

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
};
