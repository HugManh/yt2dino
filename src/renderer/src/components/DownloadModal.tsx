import React, { useState, useEffect, useRef, useCallback } from 'react'

interface DownloadFormat {
    label: string
    value: string
    ext: string
    isAudio?: boolean
    audioQuality?: string
}

interface DownloadModalProps {
    video: {
        id: string
        title: string
        thumbnail: string
        url: string
        duration: string
        channel?: string
        uploadedAt?: string
    }
    onClose: () => void
}

const DEFAULT_FORMATS: DownloadFormat[] = [
    { label: '1080p (FHD)', value: 'bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080][ext=mp4]/best[height<=1080]', ext: 'mp4' },
    { label: '720p (HD)', value: 'bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][ext=mp4]/best[height<=720]', ext: 'mp4' },
    { label: '480p (SD)', value: 'bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/best[height<=480][ext=mp4]/best[height<=480]', ext: 'mp4' },
    { label: 'Tốt nhất', value: 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best', ext: 'mp4' },
    { label: '320kbps', value: 'bestaudio/best', ext: 'mp3', isAudio: true, audioQuality: '320K' },
    { label: '192kbps', value: 'bestaudio/best', ext: 'mp3', isAudio: true, audioQuality: '192K' },
    { label: '128kbps', value: 'bestaudio/best', ext: 'mp3', isAudio: true, audioQuality: '128K' },
]

const DEFAULT_OUTPUT_DIR = window.electron?.process?.env?.USERPROFILE
    ? `${window.electron.process.env.USERPROFILE}\\Downloads`
    : 'C:\\Users\\Downloads'

const DownloadModal: React.FC<DownloadModalProps> = ({ video, onClose }) => {
    const [mediaType, setMediaType] = useState<'video' | 'audio'>('video')
    const [formats] = useState<DownloadFormat[]>(DEFAULT_FORMATS)
    const [selectedFormat, setSelectedFormat] = useState<DownloadFormat>(DEFAULT_FORMATS[1])
    const [outputDir, setOutputDir] = useState<string>(DEFAULT_OUTPUT_DIR)
    const [downloadId] = useState<string>(() => `dl-${video.id}-${Date.now()}`)
    const [status, setStatus] = useState<'idle' | 'downloading' | 'converting' | 'processing' | 'tagging' | 'complete' | 'error'>('idle')
    const [percent, setPercent] = useState(0)
    const [speed, setSpeed] = useState('')
    const [eta, setEta] = useState('')
    const [filePath, setFilePath] = useState('')
    const [errorMsg, setErrorMsg] = useState('')
    const unsubRef = useRef<(() => void) | null>(null)

    const isActive = status === 'downloading' || status === 'converting' || status === 'processing' || status === 'tagging'

    const videoFormats = formats.filter(f => !f.isAudio)
    const audioFormats = formats.filter(f => f.isAudio)

    const handleTypeChange = useCallback((type: 'video' | 'audio') => {
        if (isActive) return
        setMediaType(type)
        if (type === 'video' && selectedFormat.isAudio) {
            setSelectedFormat(videoFormats[1] || videoFormats[0])
        } else if (type === 'audio' && !selectedFormat.isAudio) {
            setSelectedFormat(audioFormats[0])
        }
    }, [isActive, selectedFormat.isAudio, videoFormats, audioFormats])

    useEffect(() => {
        // Subscribe to progress
        unsubRef.current = window.api.onDownloadProgress((progress) => {
            if (progress.downloadId !== downloadId) return
            setStatus(progress.status)
            setPercent(progress.percent)
            if (progress.speed) setSpeed(progress.speed)
            if (progress.eta) setEta(progress.eta)
            if (progress.filePath) setFilePath(progress.filePath)
        })
        return () => {
            unsubRef.current?.()
        }
    }, [downloadId])

    const handleChooseFolder = useCallback(async () => {
        const dir = await window.api.chooseFolder()
        if (dir) setOutputDir(dir)
    }, [])

    const handleDownload = useCallback(async () => {
        if (status === 'downloading' || status === 'processing') return
        setStatus('downloading')
        setPercent(0)
        setErrorMsg('')

        try {
            await window.api.download({
                videoId: video.id,
                url: video.url,
                title: video.title,
                artist: video.channel || undefined,
                year: video.uploadedAt ? video.uploadedAt.slice(0, 4) : undefined,
                genre: selectedFormat.isAudio ? 'Music' : undefined,
                thumbnailUrl: selectedFormat.isAudio ? video.thumbnail : undefined,
                format: selectedFormat.value,
                ext: selectedFormat.ext,
                isAudio: selectedFormat.isAudio ?? false,
                outputDir,
                downloadId,
                audioQuality: selectedFormat.audioQuality
            })
        } catch (err: any) {
            if (!err.message?.includes('cancel')) {
                setStatus('error')
                setErrorMsg(err.message || 'Đã xảy ra lỗi')
            } else {
                setStatus('idle')
                setPercent(0)
            }
        }
    }, [status, video, selectedFormat, outputDir, downloadId])

    const handleCancel = useCallback(async () => {
        await window.api.cancel(downloadId)
        setStatus('idle')
        setPercent(0)
    }, [downloadId])

    // Các bước xử lý audio thực tế
    const AUDIO_STEPS: { key: string; label: string; icon: string }[] = [
        { key: 'downloading', label: 'Tải stream', icon: '⬇️' },
        { key: 'converting', label: 'Chuyển đổi MP3', icon: '⚙️' },
        { key: 'tagging', label: 'Gắn tags', icon: '🏷️' },
        { key: 'complete', label: 'Hoàn thành', icon: '✅' },
    ]
    const audioStepIndex = status === 'downloading' ? 0
        : status === 'converting' ? 1
            : status === 'tagging' ? 2
                : status === 'complete' ? 3
                    : 0

    const getVideoProgressLabel = () => {
        if (status === 'processing') return 'converting video'
        if (percent < 20) return 'initializing conversion'
        if (percent < 40) return 'restarting conversion'
        if (percent < 60) return 'verifying video'
        if (percent < 80) return 'extracting video'
        return 'converting video'
    }

    const displayedFormats = mediaType === 'video' ? videoFormats : audioFormats

    return (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget && !isActive) onClose() }}>
            <div className="modal">
                <div className="modal-header">
                    <img
                        className="modal-thumb"
                        src={video.thumbnail}
                        alt={video.title}
                        onError={(e) => { e.currentTarget.src = `https://i.ytimg.com/vi/${video.id}/mqdefault.jpg` }}
                    />
                    <div className="modal-title-area">
                        <div className="modal-video-title" title={video.title}>{video.title}</div>
                        {video.duration && <div className="modal-duration">⏱ {video.duration}</div>}
                    </div>
                    {!isActive && (
                        <button className="modal-close-btn" onClick={onClose}>✕</button>
                    )}
                </div>

                <div className="modal-body">
                    {/* Media Type & Format selection */}
                    <div className="section-label">Loại tệp</div>
                    <div className="type-toggle-group">
                        <button
                            className={`type-toggle-btn ${mediaType === 'video' ? 'active' : ''}`}
                            onClick={() => handleTypeChange('video')}
                            disabled={isActive}
                        >
                            🎬 Video
                        </button>
                        <button
                            className={`type-toggle-btn ${mediaType === 'audio' ? 'active' : ''}`}
                            onClick={() => handleTypeChange('audio')}
                            disabled={isActive}
                        >
                            🎵 Âm thanh
                        </button>
                    </div>

                    <div className="section-label">Định dạng</div>
                    <div className="format-grid">
                        <button className={`format-chip active ${mediaType === 'audio' ? 'audio-chip' : ''}`} style={{ cursor: 'default' }}>
                            {mediaType === 'video' ? '🎬 MP4' : '🎵 MP3'}
                        </button>
                    </div>

                    <div className="section-label">Chất lượng</div>
                    <div className="format-grid">
                        {displayedFormats.map((fmt) => (
                            <button
                                key={fmt.label}
                                className={`format-chip ${fmt.isAudio ? 'audio-chip' : ''} ${selectedFormat.label === fmt.label ? 'active' : ''}`}
                                onClick={() => !isActive && setSelectedFormat(fmt)}
                                disabled={isActive}
                            >
                                {fmt.label}
                            </button>
                        ))}
                    </div>

                    {/* Output folder */}
                    <div className="section-label">Thư mục lưu</div>
                    <div className="folder-row">
                        <div className="folder-path" title={outputDir}>{outputDir}</div>
                        <button className="folder-btn" onClick={handleChooseFolder} disabled={isActive}>
                            📁 Chọn
                        </button>
                    </div>

                    {/* Progress */}
                    {status !== 'idle' && (
                        <div className="progress-section">

                            {/* === AUDIO: hiển thị step indicator === */}
                            {mediaType === 'audio' && status !== 'error' && (
                                <>
                                    <div className="audio-steps">
                                        {AUDIO_STEPS.map((step, i) => (
                                            <div
                                                key={step.key}
                                                className={`audio-step ${i < audioStepIndex ? 'done'
                                                    : i === audioStepIndex ? 'active'
                                                        : 'pending'
                                                    }`}
                                            >
                                                <div className="step-dot">{i < audioStepIndex ? '✓' : step.icon}</div>
                                                <div className="step-label">{step.label}</div>
                                            </div>
                                        ))}
                                    </div>
                                    {status === 'downloading' && (
                                        <>
                                            <div className="progress-bar-wrapper">
                                                <div
                                                    className="progress-bar-fill"
                                                    style={{ width: `${percent}%` }}
                                                />
                                            </div>
                                            <div className="progress-label" style={{ justifyContent: 'space-between' }}>
                                                <span>{percent}%</span>
                                                {speed && <span>🚀 {speed}</span>}
                                                {eta && <span>⏳ {eta}</span>}
                                            </div>
                                        </>
                                    )}
                                    {(status === 'converting' || status === 'tagging') && (
                                        <div className="progress-bar-wrapper">
                                            <div className="progress-bar-fill processing" style={{ width: '100%' }} />
                                        </div>
                                    )}
                                </>
                            )}

                            {/* === VIDEO: progress bar đơn giản === */}
                            {mediaType === 'video' && (status === 'downloading' || status === 'processing') && (
                                <>
                                    <div className="progress-label">
                                        <span>{getVideoProgressLabel()}</span>
                                    </div>
                                    <div className="progress-bar-wrapper">
                                        <div
                                            className={`progress-bar-fill ${status === 'processing' ? 'processing' : ''}`}
                                            style={{ width: `${status === 'processing' ? 100 : percent}%` }}
                                        />
                                    </div>
                                    <div className="progress-label" style={{ justifyContent: 'space-between', marginTop: 4 }}>
                                        <span>{status === 'processing' ? '100%' : `${percent}%`}</span>
                                        {speed && <span>🚀 {speed}</span>}
                                        {eta && <span>⏳ {eta}</span>}
                                    </div>
                                </>
                            )}
                            {status === 'complete' && (
                                <div className="progress-success">
                                    ✅ Tải xong!{filePath && <span style={{ fontSize: 11, color: '#6ee7b7', marginLeft: 4 }}>{filePath}</span>}
                                </div>
                            )}
                            {status === 'error' && (
                                <div className="progress-error">
                                    ❌ Lỗi: {errorMsg}
                                </div>
                            )}
                        </div>
                    )}

                    <div className="modal-footer">
                        {isActive ? (
                            <button className="btn-danger" onClick={handleCancel}>✕ Hủy</button>
                        ) : status === 'complete' ? (
                            <>
                                <button className="btn-secondary" onClick={onClose}>Đóng</button>
                                <button className="btn-primary" onClick={handleDownload}>↓ Tải lại</button>
                            </>
                        ) : (
                            <>
                                <button className="btn-secondary" onClick={onClose}>Đóng</button>
                                <button
                                    className="btn-primary"
                                    onClick={handleDownload}
                                    disabled={status === 'error' && false}
                                >
                                    <div className={isActive ? 'spinner' : undefined} />
                                    ↓ Tải xuống
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

export default DownloadModal
