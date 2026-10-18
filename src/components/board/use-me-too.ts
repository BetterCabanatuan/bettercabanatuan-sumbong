"use client";

import { type InfiniteData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { addMeToo, getMyMeToos } from "@/app/actions/reporter";
import { type BoardPage, boardKeys } from "@/lib/board";

export function useMyMeToos() {
  return useQuery({
    queryKey: boardKeys.myMeToos,
    queryFn: async () => new Set(await getMyMeToos()),
    staleTime: 5 * 60_000,
  });
}

function bumpCount(data: InfiniteData<BoardPage> | undefined, reportId: string, count: (n: number) => number) {
  if (!data) return data;
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      items: page.items.map((item) => (item.id === reportId ? { ...item, me_too_count: count(item.me_too_count) } : item)),
    })),
  };
}

/**
 * "Ako rin" with an optimistic update: the count and the pressed state change at once,
 * and roll back if the server refuses (e.g. the Report was just resolved).
 */
export function useMeToo() {
  const queryClient = useQueryClient();
  const t = useTranslations("board");

  return useMutation({
    mutationFn: async (reportId: string) => {
      const result = await addMeToo(reportId);
      if (!result.ok) throw new Error(result.error);
      return { reportId, count: result.meTooCount ?? 0 };
    },
    onMutate: async (reportId) => {
      await queryClient.cancelQueries({ queryKey: boardKeys.all });
      const lists = queryClient.getQueriesData<InfiniteData<BoardPage>>({ queryKey: ["board", "list"] });
      const mine = queryClient.getQueryData<Set<string>>(boardKeys.myMeToos);

      queryClient.setQueriesData<InfiniteData<BoardPage>>({ queryKey: ["board", "list"] }, (data) =>
        bumpCount(data, reportId, (n) => n + 1),
      );
      queryClient.setQueryData<Set<string>>(boardKeys.myMeToos, new Set(mine).add(reportId));
      return { lists, mine };
    },
    onError: (_error, _reportId, context) => {
      context?.lists.forEach(([key, data]) => queryClient.setQueryData(key, data));
      queryClient.setQueryData(boardKeys.myMeToos, context?.mine);
      toast.error(t("meTooFailed"));
    },
    onSuccess: ({ reportId, count }) => {
      // The server's count is the truth (another resident may have voted meanwhile).
      queryClient.setQueriesData<InfiniteData<BoardPage>>({ queryKey: ["board", "list"] }, (data) =>
        bumpCount(data, reportId, () => count),
      );
    },
  });
}
