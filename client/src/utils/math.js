/**
 * Precise decimal-safe financial calculations for wholesale market billing.
 * Prevents IEEE-754 floating point arithmetic inaccuracies.
 */

export const round2 = (val) => {
  if (val === null || val === undefined || isNaN(val)) return 0;
  const num = Number(val);
  return Math.round((num + Number.EPSILON) * 100) / 100;
};

export const add2 = (a, b) => {
  const centsA = Math.round((Number(a) || 0) * 100);
  const centsB = Math.round((Number(b) || 0) * 100);
  return (centsA + centsB) / 100;
};

export const sub2 = (a, b) => {
  const centsA = Math.round((Number(a) || 0) * 100);
  const centsB = Math.round((Number(b) || 0) * 100);
  return (centsA - centsB) / 100;
};

export const mul2 = (a, b) => {
  const numA = Number(a) || 0;
  const numB = Number(b) || 0;
  return round2(numA * numB);
};

export const formatCurrency = (val) => {
  const num = round2(val);
  return num.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export const formatNumber = (val) => {
  if (val === null || val === undefined || isNaN(val)) return '0';
  const num = Number(val);
  // Show decimals only if exists (e.g. 5.5 kg or 5 bags)
  return num % 1 === 0 ? num.toString() : num.toFixed(2);
};
