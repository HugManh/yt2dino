import React, { memo } from 'react'
import type { VideoResult, SelectedVideo } from '../types'

interface VideoCardProps extends VideoResult {
    onDownload: (video: SelectedVideo) => void
}

function formatViews(views: number): string {
    if (views >= 1_000_000_000) return `${(views / 1_000_000_000).toFixed(1)}B views`
    if (views >= 1_000_000) return `${(views / 1_000_000).toFixed(1)}M views`
    if (views >= 1_000) return `${(views / 1_000).toFixed(0)}K views`
    return `${views} views`
}

const VideoCard: React.FC<VideoCardProps> = memo(
    ({ id, title, channel, duration, thumbnail, views, uploadedAt, url, onDownload }) => {
        return (
            <div className="video-card">
                <div className="video-thumbnail">
                    <img
                        src={thumbnail}
                        alt={title}
                        loading="lazy"
                        onError={(e) => {
                            const img = e.currentTarget
                            img.src = `https://i.ytimg.com/vi/${id}/mqdefault.jpg`
                        }}
                    />
                    {duration && <span className="video-duration">{duration}</span>}
                    <div className="video-play-overlay">
                        <div className="play-icon">▶</div>
                    </div>
                </div>

                <div className="video-info">
                    <div className="video-title" title={title}>
                        {title}
                    </div>
                    <div className="video-meta">
                        <span className="video-channel" title={channel}>
                            {channel}
                        </span>
                        {views > 0 && <span className="video-views">{formatViews(views)}</span>}
                    </div>
                    <button
                        className="download-btn"
                        onClick={() => onDownload({ id, title, thumbnail, url, duration, channel, uploadedAt })}
                    >
                        ↓ Tải xuống
                    </button>
                </div>
            </div>
        )
    }
)

VideoCard.displayName = 'VideoCard'
export default VideoCard
