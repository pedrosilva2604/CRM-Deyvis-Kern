import { Prisma, type Role } from '@prisma/client';
import type { DatabaseTransaction } from '@/repositories/database-client';

export async function lockAvailableUser(transaction: DatabaseTransaction, userId: string, requiredRole: Role | null): Promise<boolean> {
  const roleCondition = requiredRole === null ? Prisma.empty : Prisma.sql`AND "role" = ${requiredRole}::"Role"`;
  const lockedUsers = await transaction.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "User"
    WHERE "id" = ${userId}::uuid AND "active" = true AND "deletedAt" IS NULL ${roleCondition}
    FOR SHARE`;
  return lockedUsers.length === 1;
}
