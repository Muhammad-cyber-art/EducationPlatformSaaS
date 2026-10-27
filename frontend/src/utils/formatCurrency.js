export const formatCurrency = (val) => {
  return Number(val || 0).toLocaleString() + " UZS";
};
