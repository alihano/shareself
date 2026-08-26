import { notFound } from "next/navigation";
import { getUserByUsername } from "@/lib/onchain-data";
import { UserProfile } from "@/components/user/UserProfile";

export default async function UsernamePage(props: PageProps<"/[username]">) {
  const { username } = await props.params;
  const user = await getUserByUsername(username);

  if (!user) notFound();

  return <UserProfile address={user.address} username={user.username} />;
}
