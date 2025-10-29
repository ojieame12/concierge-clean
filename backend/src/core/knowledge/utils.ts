const NON_ALNUM = /[^a-z0-9]+/g;

export const toAttributeId = (value: string) =>
  value
    .toLowerCase()
    .replace(NON_ALNUM, '_')
    .replace(/^_|_$/g, '');
