export const splitFirst = (str: string, delimiter: string, limit = 1) => {
  const splitStr: string[] = [];
  while (splitStr.length < limit) {
    const delimiterIndex = str.indexOf(delimiter);
    if (delimiterIndex >= 0) {
      splitStr.push(str.slice(0, delimiterIndex));
      str = str.slice(delimiterIndex + delimiter.length);
    } else {
      splitStr.push(str);
      str = "";
    }
  }
  splitStr.push(str);
  return splitStr;
};
