// Row shapes for the tables in supabase/migrations. Regenerate with
// `supabase gen types typescript` once a project is linked, if you prefer generated types.

export type ReportStatus = "pending_review" | "rejected" | "published" | "forwarded" | "resolved" | "reopened";
export type VolunteerRole = "volunteer" | "coordinator";
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
  role: VolunteerRole;
  active: boolean;
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
