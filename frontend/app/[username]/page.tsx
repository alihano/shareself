import { notFound } from "next/navigation";
import { getUserByUsernameFast } from "@/lib/onchain-data-fast";
import { UserProfile } from "@/components/user/UserProfile";

export default async function UsernamePage(props: PageProps<"/[username]">) {
  const { username } = await props.params;
  const user = await getUserByUsernameFast(username);

  if (!user) notFound();

  return <UserProfile address={user.address} username={user.username} />;
}
