export class ParseError extends Error {
  constructor(
    message: string,
    public field = '',
    public code = 'missing_structure',
  ) {
    super(message);
  }
}
