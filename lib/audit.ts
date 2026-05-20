import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export async function logAudit(params: {
  hallId: string;
  userId: string;
  action: string;
  entityType: string;
  entityId?: string;
  diffJson?: Prisma.InputJsonValue;
}) {
  await prisma.auditLog.create({
    data: {
      hallId: params.hallId,
      userId: params.userId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      diffJson: params.diffJson,
    },
  });
}
