let counter = 0;

export const v4 = (): string => {
  counter++;
  return `mock-uuid-${counter}`;
};
