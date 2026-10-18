import {
  CircleAlert,
  Construction,
  Droplets,
  Lightbulb,
  type LucideIcon,
  Siren,
  Trash2,
  TreePine,
  TrafficCone,
  UtilityPole,
  Waves,
} from "lucide-react";

/** Icons a Coordinator can choose for a Category. Keys are stored in categories.icon. */
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  "circle-alert": CircleAlert,
  construction: Construction,
  "utility-pole": UtilityPole,
  lightbulb: Lightbulb,
  waves: Waves,
  droplets: Droplets,
  "trash-2": Trash2,
  "tree-pine": TreePine,
  "traffic-cone": TrafficCone,
  siren: Siren,
};

export function CategoryIcon({ icon, ...props }: { icon: string } & React.ComponentProps<LucideIcon>) {
  const Icon = CATEGORY_ICONS[icon] ?? CircleAlert;
  return <Icon aria-hidden="true" {...props} />;
}
