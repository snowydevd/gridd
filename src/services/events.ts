import { api } from "@/lib/convex";
import { usePaginatedQuery } from "convex/react";

const PAGE_SIZE = 5

export function useUpcomingEvents(){
    const {results, status, loadMore} = usePaginatedQuery(
        api.events.listUpcoming, 
        {}, 
        { initialNumItems: PAGE_SIZE }
    )

    return{
        events: results ?? [],
        isLoading: status === "LoadingFirstPage",
        canLoadMore: status === "CanLoadMore",
        loadMore: () => loadMore(PAGE_SIZE)
    }
}   




