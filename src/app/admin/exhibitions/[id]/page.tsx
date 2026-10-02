import { redirect } from "next/navigation";
import { legacyDetailDestination } from "@/lib/admin/master-list-state";

export default async function ExhibitionDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ returnTo?: string }> }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  redirect(legacyDetailDestination("/admin/exhibitions", id, query.returnTo));
}
