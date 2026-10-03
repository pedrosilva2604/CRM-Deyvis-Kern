import { Prisma, PrismaClient } from '@prisma/client';
import { ConflictError, DatabaseUnavailableError, NotFoundError } from '@/errors/app-errors';
import { LEAD_ERRORS, LEAD_IMPORT_ERRORS, PIPELINE_ERRORS, REQUEST_ERRORS, USER_ERRORS } from '@/errors/errors.constants';

const DATABASE_UNAVAILABLE_ERROR_CODES = new Set(['P1001', 'P1002', 'P1008', 'P1017', 'P2024']);
const UNIQUE_CONSTRAINT_VIOLATION_ERROR_CODE = 'P2002';
const RECORD_NOT_FOUND_ERROR_CODE = 'P2025';
const FOREIGN_KEY_VIOLATION_ERROR_CODE = 'P2003';

const NOT_FOUND_MESSAGE_BY_MODEL: Partial<Record<Prisma.ModelName, string>> = {
  Lead: LEAD_ERRORS.NOT_FOUND,
  LeadImport: LEAD_IMPORT_ERRORS.NOT_FOUND,
  User: USER_ERRORS.NOT_FOUND,
  Pipeline: PIPELINE_ERRORS.NOT_FOUND,
  Stage: PIPELINE_ERRORS.STAGE_NOT_FOUND,
  PipelineCard: PIPELINE_ERRORS.CARD_NOT_FOUND,
};

const CONFLICT_MESSAGE_BY_MODEL_FIELD: Partial<Record<Prisma.ModelName, Record<string, string>>> = {
  Lead: { phone: LEAD_ERRORS.PHONE_IN_USE, email: LEAD_ERRORS.EMAIL_IN_USE },
  LeadImport: {
    requestedById: LEAD_IMPORT_ERRORS.ALREADY_RUNNING,
    one_running_per_requester: LEAD_IMPORT_ERRORS.ALREADY_RUNNING,
  },
  User: { email: USER_ERRORS.EMAIL_IN_USE },
  PipelineMember: { pipelineId: PIPELINE_ERRORS.MEMBER_ALREADY_ADDED },
  PipelineCard: { pipelineId: PIPELINE_ERRORS.LEAD_ALREADY_IN_PIPELINE },
};

function hasPrismaErrorCode(error: unknown, errorCode: string): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === errorCode;
}

function isDatabaseUnavailable(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientInitializationError) return true;
  return error instanceof Prisma.PrismaClientKnownRequestError && DATABASE_UNAVAILABLE_ERROR_CODES.has(error.code);
}

function describeMissingRecord(model: string | undefined): string {
  return NOT_FOUND_MESSAGE_BY_MODEL[model as Prisma.ModelName] ?? REQUEST_ERRORS.RESOURCE_NOT_FOUND;
}

function describeDuplicatedRecord(model: string | undefined, error: Prisma.PrismaClientKnownRequestError): string {
  const violatedFields = String(error.meta?.target ?? '');
  const messageByField = CONFLICT_MESSAGE_BY_MODEL_FIELD[model as Prisma.ModelName] ?? {};
  const violatedField = Object.keys(messageByField).find((field) => violatedFields.includes(field));
  return violatedField ? messageByField[violatedField]! : REQUEST_ERRORS.RESOURCE_ALREADY_EXISTS;
}

function translateDatabaseError(error: unknown, model: string | undefined): never {
  if (hasPrismaErrorCode(error, RECORD_NOT_FOUND_ERROR_CODE)) throw new NotFoundError(describeMissingRecord(model));
  if (hasPrismaErrorCode(error, FOREIGN_KEY_VIOLATION_ERROR_CODE)) throw new ConflictError(REQUEST_ERRORS.RESOURCE_CHANGED_MEANWHILE);
  if (hasPrismaErrorCode(error, UNIQUE_CONSTRAINT_VIOLATION_ERROR_CODE)) {
    throw new ConflictError(describeDuplicatedRecord(model, error));
  }
  if (!isDatabaseUnavailable(error)) throw error;
  throw new DatabaseUnavailableError(REQUEST_ERRORS.SERVICE_UNAVAILABLE, error);
}

export function createDatabaseClient(databaseUrl: string) {
  return new PrismaClient({ datasourceUrl: databaseUrl }).$extends({
    query: {
      async $allOperations({ model, args, query }) {
        try {
          return await query(args);
        } catch (error) {
          return translateDatabaseError(error, model);
        }
      },
    },
  });
}

export type DatabaseClient = ReturnType<typeof createDatabaseClient>;

type InteractiveTransactionWork = Extract<Parameters<DatabaseClient['$transaction']>[0], (transaction: never) => unknown>;

export type DatabaseTransaction = Parameters<InteractiveTransactionWork>[0];
