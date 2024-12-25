export const range = (start: number, end?: number, step = 1) => {
  if (end === undefined) {
    end = start;
    start = 0;
  }
  const result = [];
  for (; start <= end; start += step) {
    result.push(start);
  }
  return result;
};
