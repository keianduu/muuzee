import { MasterIndexPage } from "@/components/admin/master-index-page";

export default function VenuesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <MasterIndexPage entity="venues" searchParams={searchParams}/>;
}
