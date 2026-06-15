export function paginate<T>(items: T[], page: number, limit: number): T[] {
    const safePage = Math.max(1, page);
    const start = (safePage - 1) * limit;
    return items.slice(start, start + limit);
}

export function paginationMeta(total: number, page: number, limit: number) {
    const totalPages = Math.max(1, Math.ceil(total / limit));
    return {
        total,
        totalPages,
        page: Math.min(page, totalPages),
        limit,
    };
}
