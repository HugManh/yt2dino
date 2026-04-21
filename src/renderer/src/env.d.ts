/// <reference types="vite/client" />

interface DownloadProgress {
    downloadId: string
    status: 'downloading' | 'converting' | 'processing' | 'tagging' | 'complete' | 'error'
    percent: number
    speed?: string
    eta?: string
    filePath?: string
}

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

interface DownloadFormat {
    label: string
    value: string
    ext: string
    isAudio?: boolean
}

interface DownloadParams {
    videoId: string
    url: string
    title: string
    artist?: string
    year?: string
    genre?: string
    thumbnailUrl?: string
    format: string
    ext: string
    isAudio: boolean
    outputDir: string
    downloadId: string
    audioQuality?: string
}

interface ElectronAPI {
    checkDependencies: () => Promise<boolean>
    search: (query: string, page?: number) => Promise<VideoResult[]>
    getVideoInfo: (videoId: string) => Promise<{ title: string; duration: string; thumbnail: string; formats: DownloadFormat[] }>
    download: (params: DownloadParams) => Promise<{ success: boolean; filePath: string }>
    cancel: (downloadId: string) => Promise<boolean>
    chooseFolder: () => Promise<string | null>
    onDownloadProgress: (callback: (progress: DownloadProgress) => void) => () => void
    minimize: () => void
    maximize: () => void
    close: () => void
}

interface ElectronShell {
    process: {
        env: Record<string, string | undefined>
    }
}

declare interface Window {
    api: ElectronAPI
    electron: ElectronShell
}
