import 'server-only';

export class RouteError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = 'RouteError';
    this.status = status;
    this.details = details;
  }
}
