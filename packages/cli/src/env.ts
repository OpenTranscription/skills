/** API origin. Overridable so tests and staging never touch production. */
export const apiBaseUrl = (): string =>
  process.env.OT_API_URL ?? 'https://opentranscription.io';
