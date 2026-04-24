export interface VideoResult {
    id: string
    title: string
    channel: string
    duration: string
    thumbnail: string
    views: number
    uploadedAt: string
    url: string
}

export interface SelectedVideo {
    id: string
    title: string
    thumbnail: string
    url: string
    duration: string
    channel?: string
    uploadedAt?: string
}

export interface Quality {
    label: string
    value: string
    audioQuality?: string
}

export interface FormatDef {
    label: string
    ext: string
    isAudio: boolean
    qualities: Quality[]
}

export interface DownloadRecord {
    downloadId: string
    title: string
    thumbnail: string
    status: 'downloading' | 'converting' | 'processing' | 'tagging' | 'complete' | 'error' | 'deleted'
    percent: number
    speed?: string
    eta?: string
    filePath?: string
    errorMsg?: string
    startedAt: number
    completedAt?: number
    formatLabel?: string   // e.g. "MP3 · 320 kbps"
    ext?: string
    url?: string
    deletedAt?: number
}
