export const formatCompactNumber = (value: number): string => {
  if (!Number.isFinite(value) || value <= 0) {
    return "0";
  }

  if (value < 1000) {
    return value.toLocaleString("en-US");
  }

  if (value < 1_000_000) {
    const inThousands = value / 1000;
    const digits = inThousands >= 100 ? 0 : 1;
    return `${inThousands.toFixed(digits).replace(/\.0$/, "")}K`;
  }

  if (value < 1_000_000_000) {
    const inMillions = value / 1_000_000;
    const digits = inMillions >= 100 ? 0 : 1;
    return `${inMillions.toFixed(digits).replace(/\.0$/, "")}M`;
  }

  const inBillions = value / 1_000_000_000;
  const digits = inBillions >= 100 ? 0 : 1;
  return `${inBillions.toFixed(digits).replace(/\.0$/, "")}B`;
};
