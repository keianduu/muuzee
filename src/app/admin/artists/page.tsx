import { MasterIndexPage } from "@/components/admin/master-index-page";

export default function ArtistsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <MasterIndexPage entity="artists" searchParams={searchParams}/>;
}
