export class AppError extends Error {
  constructor(
    public code: string,
    public userMessage: string,
    public devMessage: string,
    public httpStatus: number,
  ) {
    super(devMessage);
    this.name = this.constructor.name;
    // Capture stack trace
    Error.captureStackTrace(this, this.constructor);
  }
}

export class AuthError extends AppError {
  constructor(code: string, userMessage: string, devMessage: string, httpStatus = 401) {
    super(code, userMessage, devMessage, httpStatus);
  }
}

export class ValidationError extends AppError {
  constructor(code: string, userMessage: string, devMessage: string, httpStatus = 400) {
    super(code, userMessage, devMessage, httpStatus);
  }
}

export class TradeStateError extends AppError {
  constructor(code: string, userMessage: string, devMessage: string, httpStatus = 409) {
    super(code, userMessage, devMessage, httpStatus);
  }
}

export class NotFoundError extends AppError {
  constructor(code: string, userMessage: string, devMessage: string, httpStatus = 404) {
    super(code, userMessage, devMessage, httpStatus);
  }
}

export class RateLimitError extends AppError {
  constructor(code: string, userMessage: string, devMessage: string, httpStatus = 429) {
    super(code, userMessage, devMessage, httpStatus);
  }
}

export class UpstreamError extends AppError {
  constructor(code: string, userMessage: string, devMessage: string, httpStatus = 502) {
    super(code, userMessage, devMessage, httpStatus);
  }
}
