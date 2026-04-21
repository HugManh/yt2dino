import React, { useState, useCallback, useRef, useEffect } from 'react'
import VideoCard from './components/VideoCard'
import DownloadModal from './components/DownloadModal'

interface VideoResult {
    id: string
    title: string
    channel: string
    duration: string
    thumbnail: string
    views: number
    uploadedAt: string
    url: string
}

interface SelectedVideo {
    id: string
    title: string
    thumbnail: string
    url: string
    duration: string
    channel?: string
    uploadedAt?: string
}

function App(): React.JSX.Element {
    const [query, setQuery] = useState('')
    const [results, setResults] = useState<VideoResult[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [page, setPage] = useState(1)
    const [hasMore, setHasMore] = useState(true)
    const [searchDone, setSearchDone] = useState(false)
    const [selectedVideo, setSelectedVideo] = useState<SelectedVideo | null>(null)
    const [isReady, setIsReady] = useState(false)
    const [initError, setInitError] = useState('')
    const inputRef = useRef<HTMLInputElement>(null)

    // Check dependencies on mount
    useEffect(() => {
        window.api.checkDependencies()
            .then(success => {
                if (success) {
                    setIsReady(true)
                } else {
                    setInitError('Không thể tải yt-dlp. Vui lòng kiểm tra kết nối mạng.')
                }
            })
            .catch(err => {
                setInitError('Lỗi khởi tạo: ' + err.message)
            })
    }, [])

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

    const fetchResults = async (q: string, p: number, isNewSearch = false) => {
        if (!q) return
        setLoading(true)
        if (isNewSearch) setError('')

        try {
            const data = await window.api.search(q, p)
            setResults(data)
            setSearchDone(true)
            // youtube-sr doesn't give a clear "end of results", so we guess if we get less than requested limit (p * 20)
            setHasMore(data.length > (p - 1) * 20)
        } catch (err: any) {
            setError(err.message || 'Tìm kiếm thất bại. Vui lòng thử lại.')
            setSearchDone(true)
        } finally {
            setLoading(false)
        }
    }

    const handleSearch = useCallback(async () => {
        const q = query.trim()
        if (!q || loading) return
        setPage(1)
        setResults([])
        fetchResults(q, 1, true)
    }, [query, loading])

    // Debounced auto-search
    useEffect(() => {
        const q = query.trim()
        if (!q) {
            setResults([])
            setSearchDone(false)
            setError('')
            setPage(1)
            setHasMore(true)
            return
        }

        const timeoutId = setTimeout(() => {
            if (loading && page === 1) return
            setPage(1)
            setResults([])
            fetchResults(q, 1, true)
        }, 800)

        return () => clearTimeout(timeoutId)
    }, [query])

    // Fetch next page when 'page' state updates
    useEffect(() => {
        if (page > 1) {
            fetchResults(query.trim(), page, false)
        }
    }, [page])

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key === 'Enter') handleSearch()
        },
        [handleSearch]
    )

    const handleDownload = useCallback((video: SelectedVideo) => {
        setSelectedVideo(video)
    }, [])

    const handleCloseModal = useCallback(() => {
        setSelectedVideo(null)
    }, [])

    return (
        <div className="app-layout">
            {/* Titlebar */}
            <div className="titlebar">
                <div className="titlebar-logo">
                    <div className="logo-icon">▶</div>
                    <span className="logo-text">YT2 Downloader</span>
                </div>
                <div className="titlebar-controls">
                    <button className="titlebar-btn" onClick={() => window.api.minimize()} title="Thu nhỏ">─</button>
                    <button className="titlebar-btn" onClick={() => window.api.maximize()} title="Phóng to">□</button>
                    <button className="titlebar-btn close" onClick={() => window.api.close()} title="Đóng">✕</button>
                </div>
            </div>

            {/* Main Content */}
            <div className="main-content">
                {!isReady && !initError && (
                    <div className="empty-state">
                        <div className="spinner big-spinner" style={{ marginBottom: '20px' }} />
                        <h3>Đang khởi tạo hệ thống...</h3>
                        <p>Ứng dụng đang tải engine tìm kiếm (chỉ một lần đầu tiên).</p>
                    </div>
                )}
                {initError && (
                    <div className="empty-state">
                        <div className="empty-icon">❌</div>
                        <h3>Lỗi khởi động</h3>
                        <p>{initError}</p>
                    </div>
                )}

                {isReady && (
                    <>
                        {/* Search */}
                        <div className="search-section">
                            {!searchDone && !loading && (
                                <div className="search-label">
                                    <h1>YouTube Downloader</h1>
                                    <p>Tìm kiếm và tải video hoặc MP3 từ YouTube dễ dàng</p>
                                </div>
                            )}
                            <div className="search-bar">
                                <div className="search-input-wrapper">
                                    <span className="search-icon">🔍</span>
                                    <input
                                        ref={inputRef}
                                        className="search-input"
                                        type="text"
                                        placeholder="Tìm kiếm video YouTube..."
                                        value={query}
                                        onChange={(e) => setQuery(e.target.value)}
                                        autoFocus
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Status */}
                        {searchDone && !loading && !error && results.length > 0 && (
                            <div className="status-bar">
                                Tìm thấy <strong>{results.length}</strong> kết quả cho "<em>{query}</em>"
                            </div>
                        )}

                        {loading && results.length === 0 && (
                            <div className="loading-state">
                                <div className="spinner big-spinner" />
                                <span>Đang tìm kiếm...</span>
                            </div>
                        )}

                        {/* Error */}
                        {error && !loading && (
                            <div className="empty-state">
                                <div className="empty-icon">⚠️</div>
                                <h3>Đã xảy ra lỗi</h3>
                                <p>{error}</p>
                            </div>
                        )}

                        {/* Empty */}
                        {searchDone && !loading && !error && results.length === 0 && (
                            <div className="empty-state">
                                <div className="empty-icon">🎬</div>
                                <h3>Không tìm thấy kết quả</h3>
                                <p>Hãy thử từ khóa khác</p>
                            </div>
                        )}

                        {/* Welcome */}
                        {!searchDone && !loading && !error && (
                            <div className="empty-state">
                                <div className="empty-icon">🎵</div>
                                <h3>Bắt đầu tìm kiếm</h3>
                                <p>Nhập từ khóa để tự động tìm kiếm</p>
                            </div>
                        )}

                        {/* Results Grid */}
                        {results.length > 0 && (
                            <div className="results-grid">
                                {results.map((video) => (
                                    <VideoCard key={video.id} {...video} onDownload={handleDownload} />
                                ))}
                                {loading && results.length > 0 && (
                                    <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'center', padding: '20px' }}>
                                        <div className="spinner" />
                                    </div>
                                )}
                                <div ref={lastElementRef} style={{ height: '20px', gridColumn: '1 / -1' }} />
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Download Modal */}
            {selectedVideo && (
                <DownloadModal video={selectedVideo} onClose={handleCloseModal} />
            )}
        </div>
    )
}

export default App
