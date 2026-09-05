import { MasterIndexPage } from "@/components/admin/master-index-page";

export default function WorksPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <MasterIndexPage entity="works" searchParams={searchParams}/>;
}
