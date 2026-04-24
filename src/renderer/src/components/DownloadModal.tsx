import React, { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { DownloadRecord, Quality, FormatDef, SelectedVideo } from '../types'

interface DownloadModalProps {
    video: SelectedVideo
    onClose: () => void
    /** Called just before download starts — includes download record + click position for fly anim */
    onDownloadStart?: (record: DownloadRecord, fromRect: { x: number; y: number }) => void
}

// ── Format tree ─────────────────────────────────────────────────
const FORMAT_TREE: Record<'video' | 'audio', FormatDef[]> = {
    video: [
        {
            label: 'MP4', ext: 'mp4', isAudio: false,
            qualities: [
                { label: '1080p', value: 'bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080][ext=mp4]/best[height<=1080]' },
                { label: '720p', value: 'bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][ext=mp4]/best[height<=720]' },
                { label: '480p', value: 'bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/best[height<=480][ext=mp4]/best[height<=480]' },
                { label: 'Best', value: 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best' },
            ],
        },
        {
            label: 'WebM', ext: 'webm', isAudio: false,
            qualities: [
                { label: '1080p', value: 'bestvideo[height<=1080][ext=webm]+bestaudio[ext=webm]/best[height<=1080][ext=webm]/best[height<=1080]' },
                { label: '720p', value: 'bestvideo[height<=720][ext=webm]+bestaudio[ext=webm]/best[height<=720][ext=webm]/best[height<=720]' },
                { label: '480p', value: 'bestvideo[height<=480][ext=webm]+bestaudio[ext=webm]/best[height<=480][ext=webm]/best[height<=480]' },
                { label: 'Best', value: 'bestvideo[ext=webm]+bestaudio[ext=webm]/best[ext=webm]/best' },
            ],
        },
        {
            label: 'MKV', ext: 'mkv', isAudio: false,
            qualities: [
                { label: '1080p', value: 'bestvideo[height<=1080]+bestaudio/best[height<=1080]' },
                { label: '720p', value: 'bestvideo[height<=720]+bestaudio/best[height<=720]' },
                { label: '480p', value: 'bestvideo[height<=480]+bestaudio/best[height<=480]' },
                { label: 'Best', value: 'bestvideo+bestaudio/best' },
            ],
        },
    ],
    audio: [
        {
            label: 'MP3', ext: 'mp3', isAudio: true,
            qualities: [
                { label: '320 kbps', value: 'bestaudio/best', audioQuality: '320K' },
                { label: '192 kbps', value: 'bestaudio/best', audioQuality: '192K' },
                { label: '128 kbps', value: 'bestaudio/best', audioQuality: '128K' },
            ],
        },
        {
            label: 'M4A', ext: 'm4a', isAudio: true,
            qualities: [
                { label: 'High', value: 'bestaudio[ext=m4a]/bestaudio', audioQuality: '0' },
                { label: 'Medium', value: 'bestaudio[ext=m4a]/bestaudio', audioQuality: '5' },
                { label: 'Low', value: 'bestaudio[ext=m4a]/bestaudio', audioQuality: '9' },
            ],
        },
        {
            label: 'OPUS', ext: 'opus', isAudio: true,
            qualities: [
                { label: '320 kbps', value: 'bestaudio[ext=opus]/bestaudio', audioQuality: '320K' },
                { label: '192 kbps', value: 'bestaudio[ext=opus]/bestaudio', audioQuality: '192K' },
                { label: '128 kbps', value: 'bestaudio[ext=opus]/bestaudio', audioQuality: '128K' },
            ],
        },
        {
            label: 'FLAC', ext: 'flac', isAudio: true,
            qualities: [{ label: 'Lossless', value: 'bestaudio/best', audioQuality: '0' }],
        },
    ],
}

const DEFAULT_OUTPUT_DIR = window.electron?.process?.env?.USERPROFILE
    ? `${window.electron.process.env.USERPROFILE}\\Downloads`
    : 'C:\\Users\\Public\\Downloads'

// ── SVG icons ────────────────────────────────────────────────────
const IconDownload = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
    </svg>
)
const IconFolder = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
)
const IconX = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
)
const IconCheck = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
    </svg>
)

// ── Framer variants ──────────────────────────────────────────────
const overlayV = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { duration: 0.18 } }, exit: { opacity: 0, transition: { duration: 0.15 } } } as const
const modalV = { hidden: { opacity: 0, y: 16, scale: 0.97 }, visible: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring' as const, damping: 28, stiffness: 380 } }, exit: { opacity: 0, y: 8, scale: 0.98, transition: { duration: 0.14 } } }
const rowV = { hidden: { opacity: 0, y: 5 }, visible: { opacity: 1, y: 0, transition: { duration: 0.18 } }, exit: { opacity: 0, y: -5, transition: { duration: 0.12 } } }

// ── Chip ─────────────────────────────────────────────────────────
const Chip: React.FC<{ label: string; active: boolean; onClick: () => void; audio?: boolean }> = ({ label, active, onClick, audio }) => (
    <motion.button
        className={`format-chip ${audio ? 'audio-chip' : ''} ${active ? 'active' : ''}`}
        onClick={onClick}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.97 }}
        transition={{ type: 'spring' as const, damping: 20, stiffness: 400 }}
    >
        {active && (
            <motion.span className="chip-check" initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring' as const, damping: 18, stiffness: 400 }}>
                <IconCheck />
            </motion.span>
        )}
        {label}
    </motion.button>
)

// ── Main component ───────────────────────────────────────────────
const DownloadModal: React.FC<DownloadModalProps> = ({ video, onClose, onDownloadStart }) => {
    const [mediaType, setMediaType] = useState<'video' | 'audio'>('video')
    const [selectedFormat, setSelectedFormat] = useState<FormatDef>(FORMAT_TREE.video[0])
    const [selectedQuality, setSelectedQuality] = useState<Quality>(FORMAT_TREE.video[0].qualities[1]) // 720p default
    const [downloadId] = useState(() => `dl-${video.id}-${Date.now()}`)
    const formats = FORMAT_TREE[mediaType]

    const handleTypeChange = useCallback((type: 'video' | 'audio') => {
        const first = FORMAT_TREE[type][0]
        setMediaType(type)
        setSelectedFormat(first)
        setSelectedQuality(first.qualities[type === 'video' ? 1 : 0])
    }, [])

    const handleFormatChange = useCallback((fmt: FormatDef) => {
        setSelectedFormat(fmt)
        setSelectedQuality(fmt.qualities[0])
    }, [])

    /** Ask for save location, then Fire-and-forget download — progress tracked in tray only */
    const handleDownload = useCallback(async (e: React.MouseEvent<HTMLButtonElement>) => {
        const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect()
        const fromPos = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }

        const safeTitle = video.title.replace(/[<>:"/\\|?*]/g, '_').substring(0, 100)
        const defaultPath = `${DEFAULT_OUTPUT_DIR}\\${safeTitle}.${selectedFormat.ext}`

        const outputPath = await window.api.showSaveDialog(defaultPath)
        if (!outputPath) return // User cancelled

        const record: DownloadRecord = {
            downloadId,
            title: video.title,
            thumbnail: video.thumbnail,
            status: 'downloading',
            percent: 0,
            startedAt: Date.now(),
            ext: selectedFormat.ext,
            formatLabel: `${selectedFormat.label} · ${selectedQuality.label}`,
            url: video.url,
        }

        // Notify App.tsx (registers in tray + triggers fly animation)
        onDownloadStart?.(record, fromPos)

        // Fire and forget — errors will be reflected in tray status
        window.api.download({
            videoId: video.id,
            url: video.url,
            title: video.title,
            artist: video.channel,
            year: video.uploadedAt?.slice(0, 4),
            genre: selectedFormat.isAudio ? 'Music' : undefined,
            thumbnailUrl: selectedFormat.isAudio ? video.thumbnail : undefined,
            format: selectedQuality.value,
            ext: selectedFormat.ext,
            isAudio: selectedFormat.isAudio,
            outputPath,
            downloadId,
            audioQuality: selectedQuality.audioQuality,
        }).catch((err: Error) => {
            // Errors are caught silently here;
            // the global progress listener in App.tsx will update the tray status to 'error'
            if (!err?.message?.includes('cancel')) console.error('[download]', err)
        })
        onClose() // Auto close modal after successful dialog acceptance
    }, [video, selectedFormat, selectedQuality, downloadId, onDownloadStart, onClose])

    return (
        <motion.div
            className="modal-overlay"
            variants={overlayV}
            initial="hidden" animate="visible" exit="exit"
            onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
        >
            <motion.div className="modal" variants={modalV} initial="hidden" animate="visible" exit="exit">

                {/* Header */}
                <div className="modal-header">
                    <img className="modal-thumb" src={video.thumbnail} alt={video.title}
                        onError={(e) => { e.currentTarget.src = `https://i.ytimg.com/vi/${video.id}/mqdefault.jpg` }} />
                    <div className="modal-title-area">
                        <div className="modal-video-title" title={video.title}>{video.title}</div>
                        {video.duration && <div className="modal-duration">{video.duration}</div>}
                    </div>
                    <button className="modal-close-btn" onClick={onClose} aria-label="Đóng"><IconX /></button>
                </div>

                <div className="modal-body">
                    {/* Loại tệp */}
                    <div className="section-label">Loại tệp</div>
                    <div className="type-toggle-group">
                        {(['video', 'audio'] as const).map(t => (
                            <button key={t} className={`type-toggle-btn ${mediaType === t ? 'active' : ''}`}
                                onClick={() => handleTypeChange(t)}>
                                {t === 'video' ? 'Video' : 'Audio'}
                            </button>
                        ))}
                    </div>

                    {/* Định dạng */}
                    <div className="section-label">Định dạng</div>
                    <AnimatePresence mode="wait">
                        <motion.div key={mediaType} className="format-chips-row" variants={rowV}
                            initial="hidden" animate="visible" exit="exit" style={{ marginBottom: 14 }}>
                            {formats.map(fmt => (
                                <Chip key={fmt.label} label={fmt.label} active={selectedFormat.label === fmt.label}
                                    onClick={() => handleFormatChange(fmt)} audio={fmt.isAudio} />
                            ))}
                        </motion.div>
                    </AnimatePresence>

                    {/* Chất lượng */}
                    <div className="section-label">Chất lượng</div>
                    <AnimatePresence mode="wait">
                        <motion.div key={`${mediaType}-${selectedFormat.label}`} className="format-chips-row" variants={rowV}
                            initial="hidden" animate="visible" exit="exit" style={{ marginBottom: 14 }}>
                            {selectedFormat.qualities.map(q => (
                                <Chip key={q.label} label={q.label} active={selectedQuality.label === q.label}
                                    onClick={() => setSelectedQuality(q)} audio={selectedFormat.isAudio} />
                            ))}
                        </motion.div>
                    </AnimatePresence>

                    {/* Footer */}
                    <div className="modal-footer">
                        <button className="btn-secondary" onClick={onClose}>Đóng</button>
                        <motion.button
                            className="btn-primary"
                            onClick={handleDownload}
                            whileHover={{ scale: 1.04 }}
                            whileTap={{ scale: 0.95 }}
                            transition={{ type: 'spring' as const, damping: 18, stiffness: 400 }}
                        >
                            <IconDownload /> Tải xuống
                        </motion.button>
                    </div>
                </div>
            </motion.div>
        </motion.div>
    )
}

export default DownloadModal
