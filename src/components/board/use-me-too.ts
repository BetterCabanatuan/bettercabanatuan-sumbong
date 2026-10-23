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
      // Only the lists: cancelling the in-flight "my Me Toos" fetch would lose which ones are pressed.
      await queryClient.cancelQueries({ queryKey: boardKeys.lists });
      queryClient.setQueriesData<InfiniteData<BoardPage>>({ queryKey: boardKeys.lists }, (data) =>
        bumpCount(data, reportId, (n) => n + 1),
      );
      queryClient.setQueryData<Set<string>>(boardKeys.myMeToos, (mine) => new Set(mine).add(reportId));
    },
    // Undo only this Report's change, so a failure doesn't wipe another card's Me Too made meanwhile.
    onError: (_error, reportId) => {
      queryClient.setQueriesData<InfiniteData<BoardPage>>({ queryKey: boardKeys.lists }, (data) =>
        bumpCount(data, reportId, (n) => Math.max(n - 1, 0)),
      );
      queryClient.setQueryData<Set<string>>(boardKeys.myMeToos, (mine) => {
        if (!mine) return mine;
        const next = new Set(mine);
        next.delete(reportId);
        return next;
      });
      toast.error(t("meTooFailed"));
    },
    onSuccess: ({ reportId, count }) => {
      // The server's count is the truth (another resident may have said Me Too meanwhile).
      queryClient.setQueriesData<InfiniteData<BoardPage>>({ queryKey: boardKeys.lists }, (data) =>
        bumpCount(data, reportId, () => count),
      );
    },
  });
}
