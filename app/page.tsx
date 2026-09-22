import Explorer from "@/components/explorer";
import data from "@/public/data/manuscript.json";
import type { Dataset } from "@/lib/data";
export default function Home() {
  return <Explorer data={data as Dataset} />;
}
