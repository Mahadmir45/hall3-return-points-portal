import { prisma } from "@/lib/db";
import { deleteLocalStorageFile } from "@/lib/admin/storageFiles";

export async function deleteUploadById(uploadId: string, hallId: string) {
  const upload = await prisma.upload.findFirst({
    where: { id: uploadId, hallId },
    select: { id: true, storageKey: true },
  });
  if (!upload) return null;

  await prisma.upload.delete({ where: { id: upload.id } });
  deleteLocalStorageFile(upload.storageKey);
  return upload.id;
}

export async function deleteActivityById(activityId: string, hallId: string) {
  const activity = await prisma.activity.findFirst({
    where: {
      id: activityId,
      category: { semester: { academicYear: { hallId } } },
    },
    select: {
      id: true,
      status: true,
      uploads: { select: { id: true, storageKey: true } },
      assets: { select: { storageKey: true } },
    },
  });
  if (!activity) return null;

  for (const u of activity.uploads) {
    await prisma.upload.delete({ where: { id: u.id } });
    deleteLocalStorageFile(u.storageKey);
  }

  for (const a of activity.assets) {
    deleteLocalStorageFile(a.storageKey);
  }

  await prisma.activity.delete({ where: { id: activity.id } });
  return activity.id;
}
