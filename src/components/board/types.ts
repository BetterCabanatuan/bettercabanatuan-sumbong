import type { Barangay, Category, ResponsibleOffice } from "@/lib/types";

/** Reference data the board's client components need to label Reports. */
export interface BoardLookups {
  categories: Category[];
  barangays: Barangay[];
  offices: Pick<ResponsibleOffice, "id" | "short_name" | "name_en" | "name_fil">[];
}
