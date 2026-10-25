import { z } from "zod";
import { emailAddress } from "@/lib/report-schema";

/**
 * Inputs of the Reporter actions on a Report's page. The forms check them before calling
 * the action (src/app/actions/reporter.ts), and the action parses them again.
 */

const credentials = {
  token: z.string().max(100).nullish(),
  followerId: z.uuid().nullish(),
  signature: z.string().max(100).nullish(),
};

/** A Follower says a Resolved Report is not actually fixed. */
export const reopenInput = z.object({
  reportId: z.uuid(),
  note: z.string().trim().max(500).optional(),
  ...credentials,
});

/** A Reporter adds an email to follow their Report. */
export const followInput = z.object({
  reportId: z.uuid(),
  email: emailAddress,
  ...credentials,
});
