/**
 * Extract production speed data from fabric_data_extracted.json
 * and output a TypeScript-compatible lookup object.
 *
 * Usage: node scripts/extract-speeds.mjs > lib/server/production-speeds.ts
 */
import { readFileSync } from 'fs';

let raw = readFileSync('fabric_data_extracted.json', 'utf8');
// Python wrote NaN literals — replace with null for valid JSON
raw = raw.replace(/\bNaN\b/g, 'null');
const sheets = JSON.parse(raw);

const speeds = {};

// The file is an array of { sheet_name, data: [...] }
const sheetArray = Array.isArray(sheets) ? sheets : [sheets];

for (const sheet of sheetArray) {
  const quality = sheet.sheet_name;
  const rows = sheet.data;

  for (const row of rows) {
    const size = row['Unnamed: 0'];
    const grammageRaw = row['Unnamed: 1'];
    const mtrPerDay = row['TARGET PRODUCTION'];
    const kgPerDay = row['Unnamed: 8'];

    // Skip header rows (null size, or non-numeric)
    if (size === null || typeof size !== 'number' || isNaN(size)) continue;
    if (!grammageRaw || typeof grammageRaw !== 'string') continue;

    // Parse grammage: "3.0 gram" → 3.0
    const grammageMatch = grammageRaw.match(/(\d+\.?\d*)/);
    if (!grammageMatch) continue;
    const grammage = parseFloat(grammageMatch[1]);

    // Skip rows without production data
    if (mtrPerDay === null || typeof mtrPerDay !== 'number' || isNaN(mtrPerDay)) continue;
    if (kgPerDay === null || typeof kgPerDay !== 'number' || isNaN(kgPerDay)) continue;

    const key = `${size}_${grammage}_${quality}`.toLowerCase();
    speeds[key] = {
      size,
      grammage,
      quality,
      mtrPerDay,
      kgPerDay,
    };
  }
}

// Output as TypeScript
const entries = Object.entries(speeds).sort();
console.log(`// Auto-generated production speed lookup from fabric_data_extracted.json`);
console.log(`// Key format: "{size}_{grammage}_{quality}" (lowercase)`);
console.log(`// Total entries: ${entries.length}`);
console.log('');
console.log('export type ProductionSpeed = {');
console.log('  size: number;');
console.log('  grammage: number;');
console.log('  quality: string;');
console.log('  mtrPerDay: number;');
console.log('  kgPerDay: number;');
console.log('};');
console.log('');
console.log('export const PRODUCTION_SPEEDS: Record<string, ProductionSpeed> = {');
for (const [key, val] of entries) {
  console.log(`  "${key}": { size: ${val.size}, grammage: ${val.grammage}, quality: "${val.quality}", mtrPerDay: ${val.mtrPerDay}, kgPerDay: ${val.kgPerDay} },`);
}
console.log('};');
console.log('');
console.log('export function getProductionSpeed(sizeInches: number, grammage: number, quality: string): ProductionSpeed | null {');
console.log('  const key = `${sizeInches}_${grammage}_${quality}`.toLowerCase();');
console.log('  return PRODUCTION_SPEEDS[key] || null;');
console.log('}');
