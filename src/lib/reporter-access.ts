import "server-only";
import { getCurrentUser } from "@/lib/auth";
import { safeEqual, saltedHash, sha256 } from "@/lib/hashing";
import { createAdminClient } from "@/lib/supabase/admin";

export interface ReporterCredentials {
  /** Private tracking token shown once after submitting (`?t=`). */
  token?: string | null;
  /** Follower id + signature from a notification email (`?f=&s=`). */
  followerId?: string | null;
  signature?: string | null;
}

export async function followerSignature(followerId: string): Promise<string> {
  return saltedHash("follower", followerId);
}

/** Whether the visitor is this Report's Reporter or one of its Followers. */
export async function hasReporterAccess(reportId: string, credentials: ReporterCredentials): Promise<boolean> {
  const admin = createAdminClient();

  if (credentials.token) {
    const { data } = await admin
      .from("report_secrets")
      .select("tracking_token_hash")
      .eq("report_id", reportId)
      .maybeSingle<{ tracking_token_hash: string }>();
    if (data && safeEqual(data.tracking_token_hash, await sha256(credentials.token))) return true;
  }

  if (credentials.followerId && credentials.signature) {
    const expected = await followerSignature(credentials.followerId);
    if (safeEqual(expected, credentials.signature)) {
      const { data } = await admin
        .from("report_followers")
        .select("id")
        .eq("id", credentials.followerId)
        .eq("report_id", reportId)
        .maybeSingle();
      if (data) return true;
    }
  }

  const user = await getCurrentUser();
  if (user) {
    const { data } = await admin
      .from("report_followers")
      .select("id")
      .eq("report_id", reportId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (data) return true;
  }

  return false;
}
