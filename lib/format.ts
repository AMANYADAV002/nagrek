export function timeAgo(iso: string, now: Date = new Date()): string {
  const s = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export function toneLabel(tone: string): string {
  return tone === "professional" ? "Professional" : tone === "casual" ? "Casual" : "Any tone";
}

const DIET_LABELS: Record<string, string> = {
  veg: "Vegetarian",
  "non-veg": "Non-vegetarian",
  vegan: "Vegan",
  eggetarian: "Eggetarian",
  halal: "Halal",
  jain: "Jain",
};

export function dietaryLabel(diet: string): string {
  return DIET_LABELS[diet] ?? diet;
}

export function uid(prefix = "id"): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}
