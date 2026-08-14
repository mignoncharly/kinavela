import { z } from "zod";

import {
  supportCategories,
  supportContentTypes,
} from "@/lib/validation/support";

const supportReplySchema = z
  .object({
    reply_id: z.string().uuid(),
    body: z.string().min(2).max(1500),
    author_family_name: z.string().min(2).max(100),
    is_author: z.boolean(),
    created_at: z.string().datetime({ offset: true }),
  })
  .strict();

export const supportPostSchema = z
  .object({
    post_id: z.string().uuid(),
    content_type: z.enum(supportContentTypes),
    category: z.enum(supportCategories),
    title: z.string().min(5).max(120),
    body: z.string().min(10).max(2000),
    status: z.enum(["open", "resolved"]),
    author_family_name: z.string().min(2).max(100),
    is_author: z.boolean(),
    can_moderate: z.boolean(),
    reply_count: z.number().int().nonnegative(),
    replies: supportReplySchema.array(),
    resolved_at: z.string().datetime({ offset: true }).nullable(),
    created_at: z.string().datetime({ offset: true }),
  })
  .strict();

export type SupportPost = z.infer<typeof supportPostSchema>;

export const parseSupportPosts = (value: unknown) =>
  supportPostSchema.array().safeParse(value);
