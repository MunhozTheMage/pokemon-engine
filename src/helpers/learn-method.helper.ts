export const decodeLevelLearnMethod = (encoded: string) => {
  const [gen, level] = encoded.split("L").map(Number);

  return gen !== undefined &&
    level !== undefined &&
    !isNaN(gen) &&
    !isNaN(level)
    ? level
    : undefined;
};
