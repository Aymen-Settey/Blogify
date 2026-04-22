/**
 * Minimal classname joiner. We intentionally avoid class-variance-authority
 * and tailwind-merge to keep the dependency surface tiny; primitives define
 * their own variant maps.
 */
export type ClassValue =
  | string
  | number
  | null
  | false
  | undefined
  | ClassValue[]
  | { [key: string]: unknown };

export function cn(...inputs: ClassValue[]): string {
  const out: string[] = [];
  const walk = (value: ClassValue) => {
    if (!value && value !== 0) return;
    if (typeof value === "string" || typeof value === "number") {
      out.push(String(value));
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    if (typeof value === "object") {
      for (const key of Object.keys(value)) {
        if ((value as Record<string, unknown>)[key]) out.push(key);
      }
    }
  };
  inputs.forEach(walk);
  return out.join(" ");
}
