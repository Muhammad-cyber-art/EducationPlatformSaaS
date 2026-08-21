import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../../../tokenUpdater/updater";
import toast from "react-hot-toast";

const fetchArchiveData = async ({ pageParam = 1, queryKey }) => {
  const [_key, type, search] = queryKey;
  const res = await api.get(`/archive/${type}/?search=${search}&page=${pageParam}`);
  return res.data;
};

export const useArchive = (debouncedSearch, activeBranchId) => {
  const queryClient = useQueryClient();

  const createArchiveQuery = (type) => {
    return useInfiniteQuery({
      queryKey: [`archived-${type}`, type, debouncedSearch],
      queryFn: fetchArchiveData,
      initialPageParam: 1,
      getNextPageParam: (lastPage) => {
        if (lastPage.next) {
          const url = new URL(lastPage.next);
          return url.searchParams.get('page');
        }
        return undefined;
      },
      select: (data) => {
        // Flatten pages and filter by branchId if necessary
        const allItems = data.pages.flatMap(page => page.results || []);
        if (!activeBranchId) return allItems;
        return allItems.filter(item => {
          if (type === 'staff') {
            return item.branch_id === activeBranchId || item.metadata?.branch === activeBranchId;
          }
          if (type === 'lids') {
            return item.metadata?.branch_id === activeBranchId || item.metadata?.branch === activeBranchId;
          }
          return item.metadata?.branch === activeBranchId;
        });
      }
    });
  };

  const studentsQuery = createArchiveQuery("students");
  const staffQuery = createArchiveQuery("staff");
  const groupsQuery = createArchiveQuery("groups");
  const lidsQuery = createArchiveQuery("lids");

  // Mutations
  const restoreMutation = useMutation({
    mutationFn: ({ type, id }) => api.post(`/archive/${type}/${id}/restore/`),
    onSuccess: (_, { type }) => {
      queryClient.invalidateQueries([`archived-${type}`]);
      toast.success("Muvaffaqiyatli tiklandi.");
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || "Tiklashda xatolik!");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: ({ type, id }) => api.delete(`/archive/${type}/${id}/`),
    onSuccess: (_, { type }) => {
      queryClient.invalidateQueries([`archived-${type}`]);
      toast.success("Butunlay o'chirildi.");
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || "O'chirishda xatolik!");
    }
  });

  const bulkRestoreMutation = useMutation({
    mutationFn: ({ type, ids }) => api.post(`/archive/${type}/bulk-restore/`, { ids }),
    onSuccess: (_, { type }) => {
      queryClient.invalidateQueries([`archived-${type}`]);
      toast.success("Tanlanganlar tiklandi.");
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || "Xatolik yuz berdi!");
    }
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: ({ type, ids }) => api.post(`/archive/${type}/bulk-delete/`, { ids }),
    onSuccess: (_, { type }) => {
      queryClient.invalidateQueries([`archived-${type}`]);
      toast.success("Tanlanganlar butunlay o'chirildi.");
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || "Xatolik yuz berdi!");
    }
  });

  return {
    studentsQuery,
    staffQuery,
    groupsQuery,
    lidsQuery,
    restoreMutation,
    deleteMutation,
    bulkRestoreMutation,
    bulkDeleteMutation
  };
};
