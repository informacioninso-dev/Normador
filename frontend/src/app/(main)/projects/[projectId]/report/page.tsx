import { ProjectProgress } from "@/components/project-progress";

export default async function Page({ params, searchParams }: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ projectId }, query] = await Promise.all([params, searchParams]);
  return <ProjectProgress projectId={Number(projectId)} query={query} report />;
}
