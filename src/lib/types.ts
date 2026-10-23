// Row shapes for the tables in supabase/migrations. Regenerate with
// `supabase gen types typescript` once a project is linked, if you prefer generated types.

export type ReportStatus = "pending_review" | "rejected" | "published" | "forwarded" | "resolved" | "reopened";
/** An area of the Volunteer console, as a row of the permission matrix. */
export type PermissionArea = "reports" | "digests" | "categories" | "offices" | "users" | "roles";
/** A column of the permission matrix. Review and Send are the two verbs only one area has. */
export type PermissionAction = "view" | "add" | "edit" | "delete" | "archive" | "print" | "export" | "review" | "send";
export type Permission =
  | "reports.view"
  | "reports.review"
  | "reports.edit"
  | "reports.archive"
  | "reports.export"
  | "digests.view"
  | "digests.add"
  | "digests.edit"
  | "digests.delete"
  | "digests.send"
  | "digests.print"
  | "digests.export"
  | "categories.view"
  | "categories.add"
  | "categories.edit"
  | "categories.archive"
  | "offices.view"
  | "offices.add"
  | "offices.edit"
  | "offices.archive"
  | "users.view"
  | "users.add"
  | "users.edit"
  | "users.archive"
  | "users.export"
  | "roles.view"
  | "roles.add"
  | "roles.edit"
  | "roles.delete";
export type QuestionKind = "text" | "yes_no" | "choice";
export type OfficeScope = "citywide" | "per_barangay";
export type DigestChannel = "letter" | "text_line" | "email" | "in_person" | "other";
export type ReportEventKind =
  | "submitted"
  | "status_changed"
  | "office_changed"
  | "category_changed"
  | "misrouted"
  | "note";

export const PUBLIC_STATUSES: ReportStatus[] = ["published", "forwarded", "resolved", "reopened"];
export const OPEN_STATUSES: ReportStatus[] = ["published", "forwarded", "reopened"];

export type Locale = "fil" | "en";

export interface ResponsibleOffice {
  id: string;
  short_name: string;
  name_en: string;
  name_fil: string;
  scope: OfficeScope;
  channel: string;
  letter_addressee: string | null;
  letter_attention: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  active: boolean;
}

export interface Category {
  id: string;
  slug: string;
  name_en: string;
  name_fil: string;
  description_en: string | null;
  description_fil: string | null;
  icon: string;
  urgent_notice_en: string | null;
  urgent_notice_fil: string | null;
  default_office_id: string | null;
  sort_order: number;
  active: boolean;
}

export interface ChoiceOption {
  value: string;
  label_en: string;
  label_fil: string;
}

export interface CategoryQuestion {
  id: string;
  category_id: string;
  prompt_en: string;
  prompt_fil: string;
  kind: QuestionKind;
  choices: ChoiceOption[];
  required: boolean;
  sort_order: number;
  active: boolean;
}

export interface Barangay {
  id: number;
  name: string;
  psgc: string | null;
}

export interface Volunteer {
  user_id: string;
  display_name: string;
  role_id: string | null;
  active: boolean;
  created_at: string;
}

export interface PermissionInfo {
  key: Permission;
  resource: PermissionArea;
  action: PermissionAction;
  label: string;
  description: string;
  sort_order: number;
}

export interface Role {
  id: string;
  name: string;
  description: string | null;
  permissions: Permission[];
}

/** An account as returned by `list_users`: a Reporter account, or a Volunteer with their role. */
export interface UserAccount {
  user_id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  display_name: string | null;
  role_id: string | null;
  role_name: string | null;
  active: boolean;
  total: number;
}

export interface VolunteerInvitation {
  email: string;
  role_id: string;
  display_name: string | null;
  created_at: string;
}

/** A Report as read through the `reports_view` view (location flattened to lat/lng). */
export interface Report {
  id: string;
  public_code: string;
  category_id: string;
  lat: number;
  lng: number;
  barangay_id: number | null;
  title: string | null;
  landmark: string | null;
  description: string | null;
  status: ReportStatus;
  suggested_office_id: string | null;
  office_id: string | null;
  rejection_reason: string | null;
  me_too_count: number;
  created_at: string;
  updated_at: string;
  reviewed_at: string | null;
  published_at: string | null;
  first_forwarded_at: string | null;
  resolved_at: string | null;
  reopened_at: string | null;
  last_activity_at: string;
}

export interface ReportPhoto {
  id: string;
  report_id: string;
  kind: "evidence" | "after";
  original_path: string;
  public_path: string | null;
  hidden: boolean;
  sort_order: number;
}

export interface ReportAnswer {
  report_id: string;
  question_id: string | null;
  prompt_en: string;
  prompt_fil: string;
  value: string;
  sort_order: number;
}

export interface ReportEvent {
  id: number;
  report_id: string;
  kind: ReportEventKind;
  from_status: ReportStatus | null;
  to_status: ReportStatus | null;
  office_id: string | null;
  previous_office_id: string | null;
  actor_id: string | null;
  note: string | null;
  created_at: string;
}

export interface Digest {
  id: string;
  office_id: string;
  barangay_id: number | null;
  created_by: string | null;
  created_at: string;
  sent_at: string | null;
  sent_by: string | null;
  channel: DigestChannel | null;
  channel_detail: string | null;
  proof_photo_path: string | null;
  notes: string | null;
}
