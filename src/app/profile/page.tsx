import { buildPlayerProfile } from "@/lib/profile/build-profile";
import { ProfileView } from "@/components/profile/ProfileView";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const profile = await buildPlayerProfile();
  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="mb-1 text-2xl font-bold">Player Profile</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        Your strengths, weaknesses, and preferred archetypes — derived from your
        saved teams and match log (archetypes are classified automatically).
      </p>
      <ProfileView profile={profile} />
    </main>
  );
}
