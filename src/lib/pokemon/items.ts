/**
 * Item lookup utilities.
 */
import { defaultGen } from "./generations";

export interface ItemData {
  name: string;
  description: string;
}

/**
 * Get item data by name. Returns null if not found.
 */
export function getItem(name: string): ItemData | null {
  const item = defaultGen.items.get(name);
  if (!item) return null;

  return {
    name: item.name,
    description: item.shortDesc || item.desc,
  };
}

/**
 * Get all items in the current generation.
 */
export function getAllItems(): ItemData[] {
  const results: ItemData[] = [];
  for (const item of defaultGen.items) {
    results.push({
      name: item.name,
      description: item.shortDesc || item.desc,
    });
  }
  return results;
}
