import { redirect } from "next/navigation";

export default async function VenueDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ returnTo?: string }> }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const destination = query.returnTo?.startsWith("/admin/venues") ? new URL(query.returnTo, "http://admin.local") : new URL("/admin/venues", "http://admin.local");
  destination.searchParams.set("selected", id);
  redirect(`${destination.pathname}?${destination.searchParams}`);
}
