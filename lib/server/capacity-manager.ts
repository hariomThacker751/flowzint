import { getDatabase } from "./database";

export type CapacityRecord = {
  id: string;
  date: string;
  size_inches: number;
  grammage: number;
  planned_kg: number;
  booked_kg: number;
  available_kg: number;
  created_at: string;
  updated_at: string;
};

export function checkDeliveryFeasibility(
  sizeInches: number,
  grammage: number,
  quantityKg: number,
  startDate?: string
): { feasible: boolean; earliestDate: string | null; availableKg: number } {
  const db = getDatabase();
  
  const start = startDate || new Date().toISOString().split("T")[0];
  const endDate = new Date(start);
  endDate.setDate(endDate.getDate() + 90); // Check next 90 days
  
  const capacities = db.prepare(`
    SELECT * FROM production_capacity
    WHERE size_inches = ? AND grammage = ? AND date >= ? AND date <= ?
    ORDER BY date ASC
  `).all(sizeInches, grammage, start, endDate.toISOString().split("T")[0]) as CapacityRecord[];
  
  for (const capacity of capacities) {
    if (capacity.available_kg >= quantityKg) {
      return {
        feasible: true,
        earliestDate: capacity.date,
        availableKg: capacity.available_kg,
      };
    }
  }
  
  return {
    feasible: false,
    earliestDate: null,
    availableKg: 0,
  };
}

export function allocateCapacity(
  date: string,
  sizeInches: number,
  grammage: number,
  quantityKg: number
): boolean {
  const db = getDatabase();
  
  // Get current capacity
  const capacity = db.prepare(`
    SELECT * FROM production_capacity
    WHERE date = ? AND size_inches = ? AND grammage = ?
  `).get(date, sizeInches, grammage) as CapacityRecord | undefined;
  
  if (!capacity) {
    return false;
  }
  
  if (capacity.available_kg < quantityKg) {
    return false;
  }
  
  // Update booked and available
  db.prepare(`
    UPDATE production_capacity
    SET booked_kg = booked_kg + ?,
        available_kg = available_kg - ?,
        updated_at = datetime('now')
    WHERE date = ? AND size_inches = ? AND grammage = ?
  `).run(quantityKg, quantityKg, date, sizeInches, grammage);
  
  return true;
}

export function getCapacityForDate(date: string): CapacityRecord[] {
  const db = getDatabase();
  return db.prepare(`
    SELECT * FROM production_capacity
    WHERE date = ?
    ORDER BY size_inches, grammage
  `).all(date) as CapacityRecord[];
}

export function updateCapacity(
  date: string,
  sizeInches: number,
  grammage: number,
  plannedKg: number
): string {
  const db = getDatabase();
  
  // Check if record exists
  const existing = db.prepare(`
    SELECT id, booked_kg FROM production_capacity
    WHERE date = ? AND size_inches = ? AND grammage = ?
  `).get(date, sizeInches, grammage) as { id: string; booked_kg: number } | undefined;
  
  const availableKg = plannedKg - (existing?.booked_kg || 0);
  
  if (existing) {
    // Update existing
    db.prepare(`
      UPDATE production_capacity
      SET planned_kg = ?, available_kg = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(plannedKg, availableKg, existing.id);
    return existing.id;
  } else {
    // Create new
    const id = crypto.randomUUID();
    db.prepare(`
      INSERT INTO production_capacity (id, date, size_inches, grammage, planned_kg, booked_kg, available_kg)
      VALUES (?, ?, ?, ?, ?, 0, ?)
    `).run(id, date, sizeInches, grammage, plannedKg, availableKg);
    return id;
  }
}

export function getCapacityRange(startDate: string, endDate: string): CapacityRecord[] {
  const db = getDatabase();
  return db.prepare(`
    SELECT * FROM production_capacity
    WHERE date >= ? AND date <= ?
    ORDER BY date, size_inches, grammage
  `).all(startDate, endDate) as CapacityRecord[];
}
