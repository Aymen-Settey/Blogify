import { redirect } from "next/navigation";

type Params = Promise<{ username: string }>;

export default async function UserRedirect({ params }: { params: Params }) {
  const { username } = await params;
  redirect(`/profile/${username}`);
}
