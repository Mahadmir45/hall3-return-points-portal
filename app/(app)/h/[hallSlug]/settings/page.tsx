import { requireHallAccess, canManageUsers } from "@/lib/auth";
import { prisma, getHallBySlug } from "@/lib/db";
import { AppShell, Breadcrumb } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChangePasswordForm } from "@/components/settings/change-password-form";
import { MyUploadsPanel } from "@/components/settings/my-uploads-panel";
import { SettingsNav } from "@/components/settings/settings-nav";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ hallSlug: string }>;
}) {
  const { hallSlug } = await params;
  const session = await requireHallAccess(hallSlug);
  const hall = await getHallBySlug(hallSlug);
  if (!hall) return null;

  const userId = session.user.id;

  const [ownedUploads, sharedUploads, hallUsers] = await Promise.all([
    prisma.upload.findMany({
      where: { hallId: hall.id, uploadedById: userId },
      orderBy: { uploadedAt: "desc" },
      include: {
        activity: { select: { name: true } },
      },
    }),
    prisma.upload.findMany({
      where: {
        hallId: hall.id,
        sharedWithUserIds: { has: userId },
      },
      orderBy: { uploadedAt: "desc" },
      include: {
        activity: { select: { name: true } },
        uploadedBy: { select: { name: true, email: true } },
      },
    }),
    prisma.user.findMany({
      where: { hallId: hall.id },
      select: { id: true, name: true, email: true },
      orderBy: { email: "asc" },
    }),
  ]);

  const uploads = [
    ...ownedUploads.map((u) => ({
      id: u.id,
      originalFilename: u.originalFilename,
      parseStatus: u.parseStatus,
      uploadedAt: u.uploadedAt.toISOString(),
      activityName: u.activity?.name ?? null,
      sharedWithUserIds: u.sharedWithUserIds,
      isOwner: true,
    })),
    ...sharedUploads.map((u) => ({
      id: u.id,
      originalFilename: u.originalFilename,
      parseStatus: u.parseStatus,
      uploadedAt: u.uploadedAt.toISOString(),
      activityName: u.activity?.name ?? null,
      sharedWithUserIds: u.sharedWithUserIds,
      isOwner: false,
    })),
  ];

  return (
    <AppShell hallName={hall.name} hallSlug={hallSlug} userName={session.user.name}>
      <div className="space-y-6">
        <Breadcrumb
          items={[
            { label: "Dashboard", href: `/h/${hallSlug}` },
            { label: "Settings" },
          ]}
        />
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Settings</h2>
          <p className="text-slate-600">
            Manage your account, security, and file access.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
          <SettingsNav
            hallSlug={hallSlug}
            role={session.user.role}
            active="account"
          />

          <div className="space-y-6">
            <Card id="account">
              <CardHeader>
                <CardTitle>Your account</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-slate-500">Name</p>
                    <p className="font-medium">{session.user.name ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Email</p>
                    <p className="font-medium">{session.user.email}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Role</p>
                    <p className="font-medium">{session.user.role}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Hall</p>
                    <p className="font-medium">{hall.name}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card id="security">
              <CardHeader>
                <CardTitle>Security</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-4 text-sm text-slate-600">
                  Change the password you use to sign in to this portal.
                </p>
                <ChangePasswordForm hallSlug={hallSlug} />
              </CardContent>
            </Card>

            <Card id="files">
              <CardHeader>
                <CardTitle>My files</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-4 text-sm text-slate-600">
                  Files you uploaded and files other tutors shared with you.
                  As the uploader, you can grant access to other hall tutors.
                </p>
                <MyUploadsPanel
                  hallSlug={hallSlug}
                  initialUploads={uploads}
                  hallUsers={hallUsers}
                  currentUserId={userId}
                />
              </CardContent>
            </Card>

            {canManageUsers(session.user.role) && (
              <Card>
                <CardHeader>
                  <CardTitle>Hall administration</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-slate-600">
                  <p>
                    Manage hall users, scoring rules, and other hall-wide
                    configuration in{" "}
                    <a
                      href={`/h/${hallSlug}/settings/hall`}
                      className="text-blue-600 hover:underline"
                    >
                      Hall administration
                    </a>
                    .
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
