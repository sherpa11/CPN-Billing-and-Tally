/**
 * Accurate financial arithmetic utilities with strict 2-decimal precision.
 * Avoids JavaScript IEEE-754 floating point precision errors.
 */

// Round to 2 decimal places using epsilon to prevent standard Math.round drift
const round2 = (value) => {
  if (value === null || value === undefined || isNaN(value)) return 0;
  const num = Number(value);
  return Math.round((num + Number.EPSILON) * 100) / 100;
};

// Precise addition
const add2 = (a, b) => {
  const centsA = Math.round((Number(a) || 0) * 100);
  const centsB = Math.round((Number(b) || 0) * 100);
  return (centsA + centsB) / 100;
};

// Precise subtraction
const sub2 = (a, b) => {
  const centsA = Math.round((Number(a) || 0) * 100);
  const centsB = Math.round((Number(b) || 0) * 100);
  return (centsA - centsB) / 100;
};

// Precise multiplication (e.g. rate * weight)
const mul2 = (a, b) => {
  const numA = Number(a) || 0;
  const numB = Number(b) || 0;
  return round2(numA * numB);
};

// Safe formatting as string '0.00'
const formatCurrency = (val) => {
  const num = round2(val);
  return num.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

module.exports = {
  round2,
  add2,
  sub2,
  mul2,
  formatCurrency,
};
