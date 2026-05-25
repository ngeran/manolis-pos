export function formatPrice(cents: number): string {
  const euros = cents / 100;
  return euros.toLocaleString("el-GR", {
    style: "currency",
    currency: "EUR",
  });
}

export function calculateLineTotal(priceCents: number, quantityGrams: number): number {
  return Math.round((priceCents * quantityGrams) / 1000);
}

export function formatWeight(quantityGrams: number): string {
  const kg = quantityGrams / 1000;
  const formatted = parseFloat(kg.toFixed(3));
  return `${formatted} kg`;
}

export function kgToGrams(kg: number): number {
  return Math.round(kg * 1000);
}

export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(" ");
}
