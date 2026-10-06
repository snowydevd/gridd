import Apple from "@auth/core/providers/apple";
import Google from "@auth/core/providers/google";
import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";
import type { DataModel } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { initNewUser } from "./lib/newUser";
import { ResendOTPPasswordReset } from "./lib/passwordReset";
import { resolveRedirect } from "./lib/redirect";
import { passwordProfile, validatePassword } from "./lib/validation";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Google,
    Apple({
      // Apple sólo manda el nombre la primera vez y devuelve `image: null`.
      profile: (appleInfo) => ({
        id: appleInfo.sub,
        name: appleInfo.user
          ? `${appleInfo.user.name.firstName} ${appleInfo.user.name.lastName}`
          : undefined,
        email: appleInfo.email,
      }),
    }),
    Password<DataModel>({
      profile: (params) => passwordProfile(params),
      validatePasswordRequirements: validatePassword,
      reset: ResendOTPPasswordReset,
    }),
  ],
  callbacks: {
    async redirect({ redirectTo }) {
      return resolveRedirect(redirectTo, {
        siteUrl: process.env.SITE_URL!,
        allowExpoGo: process.env.AUTH_ALLOW_EXPO_GO === "true",
      });
    },
    async afterUserCreatedOrUpdated(ctx, args) {
      await initNewUser(ctx as unknown as MutationCtx, args);
    },
  },
});
