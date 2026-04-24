import React, { useState, useCallback, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import VideoCard from './components/VideoCard'
import DownloadModal from './components/DownloadModal'
import DownloadTray from './components/DownloadTray'
import { useYouTubeSearch } from './hooks/useYouTubeSearch'
import { useDownloads } from './hooks/useDownloads'
import type { SelectedVideo } from './types'
import logoImg from './assets/logo.png'

function App(): React.JSX.Element {
    const {
        query, setQuery,
        results,
        loading,
        error,
        searchDone,
        inputRef,
        lastElementRef,
        handleSearch,
        handleKeyDown
    } = useYouTubeSearch()

    const {
        downloads,
        trayOpen, setTrayOpen,
        flyState,
        handleDownloadStart,
        handleDelete,
        handleClear,
        handleMarkDeleted
    } = useDownloads()

    const [selectedVideo, setSelectedVideo] = useState<SelectedVideo | null>(null)
    const [isReady, setIsReady] = useState(false)
    const [initError, setInitError] = useState('')

    // Check dependencies on mount
    useEffect(() => {
        window.api.checkDependencies()
            .then(success => {
                if (success) setIsReady(true)
                else setInitError('Không thể tải yt-dlp. Vui lòng kiểm tra kết nối mạng.')
            })
            .catch(err => setInitError('Lỗi khởi tạo: ' + err.message))
    }, [])

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
                    <img src={logoImg} className="logo-icon" alt="YT2" style={{ borderRadius: '4px', width: '16px', height: '16px', border: 'none', background: 'none' }} />
                    <span className="logo-text">YT2Dino</span>
                </div>
                <div className="titlebar-controls">
                    <button className="titlebar-btn" onClick={() => window.api.minimize()} title="Thu nhỏ">─</button>
                    <button className="titlebar-btn" onClick={() => window.api.maximize()} title="Phóng to">□</button>
                    <button className="titlebar-btn close" onClick={() => window.api.close()} title="Đóng">✕</button>
                </div>
            </div>

            {/* Floating download tray */}
            <DownloadTray
                downloads={downloads}
                open={trayOpen}
                onToggle={() => setTrayOpen(v => !v)}
                onDelete={handleDelete}
                onClear={handleClear}
                onMarkDeleted={handleMarkDeleted}
            />

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
                        <div className={`search-section ${!searchDone && !loading && !error && results.length === 0 ? 'hero' : ''}`}>
                            {!searchDone && !loading && (
                                <div className="search-label">
                                    <h1>Tìm kiếm Video</h1>
                                    <p>Nhập từ khóa hoặc Dán <span style={{ color: '#ff6b6b', fontWeight: 600 }}>YouTube</span> Link</p>
                                </div>
                            )}
                            <div className="search-bar">
                                <input
                                    ref={inputRef}
                                    className="search-input"
                                    type="text"
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Ví dụ: chill lofi, edm..."
                                    autoFocus
                                />
                                {query && (
                                    <button className="clear-btn" onClick={() => {
                                        setQuery('')
                                        inputRef.current?.focus()
                                    }}>✕</button>
                                )}
                                <button className="search-btn" onClick={handleSearch} disabled={loading || !query.trim()}>
                                    Tìm
                                </button>
                            </div>
                        </div>

                        {/* Error state */}
                        {error && (
                            <div className="empty-state" style={{ marginTop: '20px' }}>
                                <div className="empty-icon" style={{ filter: 'grayscale(1)' }}>⚠️</div>
                                <h3>Không tìm thấy kết quả</h3>
                                <p>{error}</p>
                            </div>
                        )}

                        {/* Initial state (no search done, not loading, no results) */}
                        {!searchDone && !loading && !error && results.length === 0 && (
                            <div className="empty-state" style={{ marginTop: '40px' }}>
                                <div className="empty-icon">🎵</div>
                                <h3>Bắt đầu tìm kiếm</h3>
                                <p>Nhập từ khóa để tự động tìm kiếm</p>
                            </div>
                        )}

                        {/* Loading state (initial search) */}
                        {loading && results.length === 0 && (
                            <div className="loading-state" style={{ marginTop: '60px' }}>
                                <div className="main-spinner" style={{ marginBottom: '16px' }} />
                                <h3>Đang tìm kiếm...</h3>
                                <p>Đang tải dữ liệu từ YouTube, vui lòng đợi giây lát.</p>
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
            <AnimatePresence>
                {selectedVideo && (
                    <DownloadModal
                        key="download-modal"
                        video={selectedVideo}
                        onClose={handleCloseModal}
                        onDownloadStart={handleDownloadStart}
                    />
                )}
            </AnimatePresence>

            {/* Fly-to-tray animation: thumbnail flies from download button to the FAB */}
            <AnimatePresence>
                {flyState && (
                    <motion.img
                        key={flyState.id}
                        src={flyState.thumbnail}
                        className="fly-thumbnail"
                        initial={{ opacity: 1, scale: 1, x: flyState.fromX - 25, y: flyState.fromY - 25 }}
                        animate={{
                            opacity: [1, 0.8, 0],
                            scale: [1, 0.5, 0.2],
                            x: window.innerWidth - 50,
                            y: window.innerHeight - 50,
                        }}
                        transition={{ duration: 0.65, ease: 'easeOut' }}
                    />
                )}
            </AnimatePresence>
        </div>
    )
}

export default App
