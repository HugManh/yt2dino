import { useState, useCallback, useRef, useEffect } from 'react'
import type { VideoResult } from '../types'

export function useYouTubeSearch() {
    const [query, setQuery] = useState('')
    const [results, setResults] = useState<VideoResult[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [page, setPage] = useState(1)
    const [hasMore, setHasMore] = useState(true)
    const [searchDone, setSearchDone] = useState(false)

    const loadingRef = useRef(false)
    const inputRef = useRef<HTMLInputElement>(null)
    const latestQuery = useRef('')

    const fetchResults = useCallback(async (q: string, p: number, isNewSearch = false) => {
        if (!q) return
        latestQuery.current = q
        loadingRef.current = true
        setLoading(true)
        if (isNewSearch) setError('')

        try {
            const data = await window.api.search(q, p)
            // If the query has changed while fetching, ignore these results to prevent race conditions
            if (latestQuery.current !== q) return

            if (isNewSearch) {
                setResults(data)
                setSearchDone(true)
            } else {
                setResults(prev => {
                    const existingIds = new Set(prev.map(v => v.id))
                    const uniques = data.filter(v => !existingIds.has(v.id))
                    return [...prev, ...uniques]
                })
            }
            setHasMore(data.length > 0)
        } catch (err: any) {
            if (latestQuery.current !== q) return
            if (isNewSearch) {
                setError(err.message || 'Lỗi tìm kiếm')
                setResults([])
            }
        } finally {
            if (latestQuery.current === q) {
                setLoading(false)
                loadingRef.current = false
            }
        }
    }, [])

    const handleSearch = useCallback(async () => {
        const q = query.trim()
        if (!q) return
        setPage(1)
        setResults([])
        await fetchResults(q, 1, true)
    }, [query, fetchResults])

    // Debounced auto-search
    useEffect(() => {
        const q = query.trim()
        if (!q) {
            setResults([])
            setSearchDone(false)
            setError('')
            setPage(1)
            setHasMore(true)
            loadingRef.current = false
            setLoading(false)
            return
        }

        const timeoutId = setTimeout(() => {
            setPage(1)
            setResults([])
            fetchResults(q, 1, true)
        }, 800)

        return () => clearTimeout(timeoutId)
    }, [query, fetchResults])

    // Infinite scroll
    useEffect(() => {
        if (page > 1) {
            fetchResults(query.trim(), page, false)
        }
    }, [page, query, fetchResults])

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key === 'Enter') handleSearch()
        },
        [handleSearch]
    )

    const observer = useRef<IntersectionObserver | null>(null)
    const lastElementRef = useCallback((node: HTMLDivElement | null) => {
        if (loading) return
        if (observer.current) observer.current.disconnect()
        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && hasMore) {
                setPage(prevPage => prevPage + 1)
            }
        })
        if (node) observer.current.observe(node)
    }, [loading, hasMore])

    return {
        query, setQuery,
        results,
        loading,
        error,
        page,
        hasMore,
        searchDone,
        inputRef,
        lastElementRef,
        handleSearch,
        handleKeyDown
    }
}
