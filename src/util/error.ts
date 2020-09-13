/** Error class adding an error code used for i18n. */
export class TopolaError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly args: {[key: string]: string} = {},
  ) {
    super(message);
  }
}
