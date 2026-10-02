export interface TechnicalErrorDescription {
  error: string;
  stack: string | undefined;
}

export function describeTechnicalError(failure: unknown): TechnicalErrorDescription {
  const technicalError = failure instanceof Error && failure.cause !== undefined ? failure.cause : failure;
  return {
    error: technicalError instanceof Error ? technicalError.message : String(technicalError),
    stack: technicalError instanceof Error ? technicalError.stack : undefined,
  };
}

export function logFailure(context: Record<string, unknown>, failure: unknown): void {
  console.error(JSON.stringify({ level: 'error', ...context, ...describeTechnicalError(failure) }));
}
