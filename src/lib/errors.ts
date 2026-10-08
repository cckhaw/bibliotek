export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const notFound = (what: string) => new AppError("NOT_FOUND", `${what} not found`, 404);
export const forbidden = (msg = "You do not have permission to do that") => new AppError("FORBIDDEN", msg, 403);
export const conflict = (code: string, msg: string) => new AppError(code, msg, 409);
