export const LB_PER_KG = 2.2046226218;
export const CM_PER_IN = 2.54;

export const kgToLb = (kg: number) => kg * LB_PER_KG;
export const lbToKg = (lb: number) => lb / LB_PER_KG;

export const ftInToCm = (ft: number, inches: number) => (ft * 12 + inches) * CM_PER_IN;

export function cmToFtIn(cm: number): { ft: number; in: number } {
  const totalIn = Math.round(cm / CM_PER_IN);
  return { ft: Math.floor(totalIn / 12), in: totalIn % 12 };
}

export const mlToFlOz = (ml: number) => ml / 29.5735;

export function formatWeight(kg: number, system: "metric" | "imperial"): string {
  return system === "metric"
    ? `${round1(kg)} kg`
    : `${round1(kgToLb(kg))} lb`;
}

export function formatHeight(cm: number, system: "metric" | "imperial"): string {
  if (system === "metric") return `${Math.round(cm)} cm`;
  const { ft, in: inches } = cmToFtIn(cm);
  return `${ft}′ ${inches}″`;
}

export function formatWater(ml: number, system: "metric" | "imperial"): string {
  return system === "metric"
    ? `${+(ml / 1000).toFixed(2)} L`
    : `${Math.round(mlToFlOz(ml))} fl oz`;
}

export const round1 = (n: number) => Math.round(n * 10) / 10;
