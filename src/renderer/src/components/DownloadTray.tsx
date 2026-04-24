import React, { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

import type { DownloadRecord } from '../types'

interface DownloadTrayProps {
    downloads: DownloadRecord[]
    open: boolean
    onToggle: () => void
    onDelete: (downloadId: string) => void
    onClear: () => void
    onMarkDeleted?: (downloadId: string) => void
}

// ── SVG Icons ────────────────────────────────────────────────────
const IconTray = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
)
const IconCheck = () => (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
    </svg>
)
const IconClose = () => (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
)
const IconTrash = () => (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
        <path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" />
    </svg>
)
const IconFile = () => (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
    </svg>
)
const IconLink = () => (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
)
const IconFolderOpen = () => (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
)

// ── Helpers ──────────────────────────────────────────────────────
const STATUS_LABEL: Record<string, string> = {
    downloading: 'Đang tải',
    converting: 'Đang chuyển đổi',
    processing: 'Ghép streams',
    tagging: 'Gắn thẻ',
    complete: 'Hoàn thành',
    error: 'Lỗi',
}

function formatTimeAgo(ms: number): string {
    const s = Math.floor((Date.now() - ms) / 1000)
    if (s < 60) return 'Vừa xong'
    const m = Math.floor(s / 60)
    if (m < 60) return `${m} phút trước`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h} giờ trước`
    return `${Math.floor(h / 24)} ngày trước`
}

// ── Main component ────────────────────────────────────────────────
const DownloadTray: React.FC<DownloadTrayProps> = ({ downloads, open, onToggle, onDelete, onClear, onMarkDeleted }) => {
    const panelRef = useRef<HTMLDivElement>(null)
    const [toast, setToast] = useState<string | null>(null)

    const handleCopy = useCallback((url: string) => {
        navigator.clipboard.writeText(url).catch(() => { })
        setToast('Đã sao chép link YouTube')
        setTimeout(() => setToast(null), 3000)
    }, [])

    const hasActive = downloads.some(d => ['downloading', 'converting', 'processing', 'tagging'].includes(d.status))
    const activeItems = downloads.filter(d => !['complete', 'error', 'deleted'].includes(d.status))
    const histItems = downloads.filter(d => ['complete', 'error', 'deleted'].includes(d.status))

    // Close on outside click
    useEffect(() => {
        if (!open) return
        const handler = (e: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) onToggle()
        }
        requestAnimationFrame(() => document.addEventListener('mousedown', handler))
        return () => document.removeEventListener('mousedown', handler)
    }, [open, onToggle])

    return (
        <div className="dl-tray" ref={panelRef}>
            {/* ── Global Toast ── */}
            <AnimatePresence>
                {toast && (
                    <motion.div
                        className="global-toast"
                        initial={{ opacity: 0, y: -20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 400 }}
                    >
                        <span style={{ color: 'var(--ok)', marginRight: 6 }}>✓</span>
                        {toast}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Floating FAB button ── */}
            <motion.button
                className={`dl-fab ${open ? 'open' : ''}`}
                onClick={onToggle}
                aria-label="Lịch sử tải xuống"
                title="Lịch sử tải xuống"
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.94 }}
                transition={{ type: 'spring' as const, damping: 20, stiffness: 400 }}
            >
                {/* Pulse ring */}
                {hasActive && <span className="dl-fab-pulse" />}

                <IconTray />

                {/* Badge removed */}
            </motion.button>

            {/* ── Panel ── */}
            <AnimatePresence>
                {open && (
                    <motion.div
                        className="dl-panel"
                        initial={{ opacity: 0, x: 14, scale: 0.96 }}
                        animate={{ opacity: 1, x: 0, scale: 1, transition: { type: 'spring' as const, damping: 28, stiffness: 380 } }}
                        exit={{ opacity: 0, x: 10, scale: 0.96, transition: { duration: 0.15 } }}
                    >
                        {/* Panel header */}
                        <div className="dl-panel-header">
                            <span className="dl-panel-title">Tải xuống</span>
                            <div className="dl-panel-actions">
                                {histItems.length > 0 && (
                                    <button className="dl-panel-clear-btn" onClick={onClear} title="Xóa tất cả lịch sử">
                                        <IconTrash /> Xóa tất cả
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="dl-panel-body">
                            {downloads.length === 0 && (
                                <div className="dl-empty">
                                    <IconTray />
                                    <p>Chưa có gì được tải xuống</p>
                                </div>
                            )}

                            {/* Active */}
                            {activeItems.length > 0 && (
                                <div className="dl-group">
                                    <div className="dl-group-label">Đang xử lý</div>
                                    {activeItems.map(dl => (
                                        <DlItem key={dl.downloadId} dl={dl} onDelete={onDelete} onCopy={handleCopy} />
                                    ))}
                                </div>
                            )}

                            {/* History */}
                            {histItems.length > 0 && (
                                <div className="dl-group">
                                    {activeItems.length > 0 && <div className="dl-group-divider" />}
                                    <div className="dl-group-label">Lịch sử</div>
                                    {histItems.map(dl => (
                                        <DlItem key={dl.downloadId} dl={dl} onDelete={onDelete} onMarkDeleted={onMarkDeleted} onCopy={handleCopy} />
                                    ))}
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

// ── Single download item ──────────────────────────────────────────
const DlItem: React.FC<{ dl: DownloadRecord; onDelete: (id: string) => void; onMarkDeleted?: (id: string) => void; onCopy?: (url: string) => void }> = ({ dl, onDelete, onMarkDeleted, onCopy }) => {
    const isComplete = dl.status === 'complete'
    const isError = dl.status === 'error'
    const isDeleted = dl.status === 'deleted'
    const isActive = !['complete', 'error', 'deleted'].includes(dl.status)

    return (
        <div className={`dl-item ${isComplete ? 'done' : (isError || isDeleted) ? 'err' : 'active'}`}>
            {/* Thumbnail */}
            <div className="dl-item-thumb-wrap">
                <img className="dl-item-thumb" src={dl.thumbnail} alt="" />
                {isComplete && (
                    <span className="dl-item-thumb-badge ok"><IconCheck /></span>
                )}
                {(isError || isDeleted) && (
                    <span className="dl-item-thumb-badge bad">!</span>
                )}
            </div>

            {/* Content */}
            <div className="dl-item-body">
                <div className="dl-item-title" title={dl.title}>{dl.title}</div>

                {/* Format badge */}
                {dl.formatLabel && (
                    <div className="dl-item-format">
                        <IconFile /> {dl.formatLabel}
                    </div>
                )}

                {/* Status line */}
                {isActive && (
                    <div className="dl-item-status-line">
                        <span className="dl-item-status active">{STATUS_LABEL[dl.status]}</span>
                        {dl.status === 'downloading' && dl.speed && (
                            <span className="dl-item-speed">{dl.speed}</span>
                        )}
                        {dl.status === 'downloading' && dl.eta && (
                            <span className="dl-item-speed">ETA {dl.eta}</span>
                        )}
                    </div>
                )}
                {isComplete && dl.filePath && (
                    <div className="dl-item-filepath">{dl.filePath.split(/[\\/]/).pop()}</div>
                )}
                {isError && (
                    <div className="dl-item-error-msg">{dl.errorMsg || 'Đã xảy ra lỗi'}</div>
                )}
                {dl.deletedAt && (
                    <div className="dl-item-error-msg">Đã xóa {formatTimeAgo(dl.deletedAt)}</div>
                )}

                {/* Progress bar */}
                {isActive && (
                    <>
                        {dl.status === 'downloading' ? (
                            <div className="dl-item-bar-wrap">
                                <motion.div className="dl-item-bar-fill"
                                    animate={{ width: `${dl.percent}%` }}
                                    transition={{ duration: 0.4, ease: 'easeOut' }}
                                    style={{ width: 0 }} />
                            </div>
                        ) : (
                            <div className="dl-item-processing-icon">
                                <div className="spinner" style={{ width: 12, height: 12, borderWidth: 1.5 }} />
                            </div>
                        )}
                    </>
                )}

                {/* Time */}
                <div className="dl-item-time">{formatTimeAgo(dl.startedAt)}</div>
            </div>

            {/* Action buttons */}
            {!isActive && (
                <div className="dl-item-actions-group">
                    {(isComplete || isDeleted) && dl.url && (
                        <button
                            className="dl-item-action-icon"
                            onClick={(e) => { e.stopPropagation(); onCopy?.(dl.url as string) }}
                            title="Sao chép link YouTube"
                            aria-label="Sao chép link YouTube"
                        >
                            <IconLink />
                        </button>
                    )}
                    {isComplete && dl.filePath && !isDeleted && (
                        <button
                            className="dl-item-action-icon"
                            onClick={async (e) => {
                                e.stopPropagation();
                                const exists = await window.api.showItemInFolder(dl.filePath as string)
                                if (!exists && onMarkDeleted) {
                                    onMarkDeleted(dl.downloadId)
                                }
                            }}
                            title="Mở thư mục"
                            aria-label="Mở thư mục"
                        >
                            <IconFolderOpen />
                        </button>
                    )}
                    <button
                        className="dl-item-action-icon dl-item-del"
                        onClick={(e) => { e.stopPropagation(); onDelete(dl.downloadId) }}
                        title="Xóa khỏi danh sách"
                        aria-label="Xóa"
                    >
                        <IconClose />
                    </button>
                </div>
            )}
        </div>
    )
}

export default DownloadTray
