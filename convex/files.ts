import { mutation } from "./_generated/server";
import { requirePublisher } from "./lib/auth";

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requirePublisher(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});
