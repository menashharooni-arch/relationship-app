import UserDetailClient from "./UserDetailClient";

export const metadata = { title: "User — SwiftCard Admin" };

export default async function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <UserDetailClient userId={id} />;
}
