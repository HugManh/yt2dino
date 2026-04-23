import React, { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

import type { DownloadRecord } from '../types'

interface DownloadTrayProps {
    downloads: DownloadRecord[]
    open: boolean
    onToggle: () => void
    onDelete: (downloadId: string) => void
    onClear: () => void
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
const DownloadTray: React.FC<DownloadTrayProps> = ({ downloads, open, onToggle, onDelete, onClear }) => {
    const panelRef = useRef<HTMLDivElement>(null)

    const hasActive = downloads.some(d => ['downloading', 'converting', 'processing', 'tagging'].includes(d.status))
    const activeItems = downloads.filter(d => !['complete', 'error'].includes(d.status))
    const histItems = downloads.filter(d => ['complete', 'error'].includes(d.status))

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

                {/* Badge */}
                <AnimatePresence>
                    {downloads.length > 0 && (
                        <motion.span
                            className="dl-fab-badge"
                            key="badge"
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0 }}
                            transition={{ type: 'spring' as const, damping: 18, stiffness: 400 }}
                        >
                            {downloads.length > 99 ? '99+' : downloads.length}
                        </motion.span>
                    )}
                </AnimatePresence>
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
                                        <DlItem key={dl.downloadId} dl={dl} onDelete={onDelete} />
                                    ))}
                                </div>
                            )}

                            {/* History */}
                            {histItems.length > 0 && (
                                <div className="dl-group">
                                    {activeItems.length > 0 && <div className="dl-group-divider" />}
                                    <div className="dl-group-label">Lịch sử</div>
                                    {histItems.map(dl => (
                                        <DlItem key={dl.downloadId} dl={dl} onDelete={onDelete} />
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
const DlItem: React.FC<{ dl: DownloadRecord; onDelete: (id: string) => void }> = ({ dl, onDelete }) => {
    const isActive = !['complete', 'error'].includes(dl.status)
    const isComplete = dl.status === 'complete'
    const isError = dl.status === 'error'

    return (
        <div className={`dl-item ${isComplete ? 'done' : isError ? 'err' : 'active'}`}>
            {/* Thumbnail */}
            <div className="dl-item-thumb-wrap">
                <img className="dl-item-thumb" src={dl.thumbnail} alt="" />
                {isComplete && (
                    <span className="dl-item-thumb-badge ok"><IconCheck /></span>
                )}
                {isError && (
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

                {/* Progress bar */}
                {isActive && (
                    <div className="dl-item-bar-wrap">
                        {dl.status === 'downloading' ? (
                            <motion.div className="dl-item-bar-fill"
                                animate={{ width: `${dl.percent}%` }}
                                transition={{ duration: 0.4, ease: 'easeOut' }}
                                style={{ width: 0 }} />
                        ) : (
                            <div className="dl-item-bar-fill processing" style={{ width: '100%' }} />
                        )}
                    </div>
                )}

                {/* Time */}
                <div className="dl-item-time">{formatTimeAgo(dl.startedAt)}</div>
            </div>

            {/* Action buttons */}
            {!isActive && (
                <button
                    className="dl-item-del"
                    onClick={(e) => { e.stopPropagation(); onDelete(dl.downloadId) }}
                    title="Xóa khỏi danh sách"
                    aria-label="Xóa"
                >
                    <IconClose />
                </button>
            )}
        </div>
    )
}

export default DownloadTray
