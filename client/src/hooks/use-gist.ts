import { useQuery } from "@tanstack/react-query";
import type { Gist, Thread, TimelineEntry } from "@shared/schema";

export function useGist(slug: string | undefined) {
  return useQuery<Gist & { threads?: Thread[]; timelineEntries?: TimelineEntry[] }>({
    queryKey: ["/api/g", slug],
    enabled: !!slug,
  });
}

export function useAuthorGists() {
  return useQuery<Gist[]>({
    queryKey: ["/api/gists"],
  });
}

export function useGistTimeline(slug: string | undefined) {
  return useQuery<TimelineEntry[]>({
    queryKey: ["/api/g", slug, "timeline"],
    enabled: !!slug,
  });
}
