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
    outputPath: string
    downloadId: string
    audioQuality?: string
}

interface ElectronAPI {
    checkDependencies: () => Promise<boolean>
    search: (query: string, page?: number) => Promise<VideoResult[]>
    getVideoInfo: (videoId: string) => Promise<{ title: string; duration: string; thumbnail: string; formats: { label: string; value: string; ext: string; isAudio?: boolean; audioQuality?: string }[] }>
    download: (params: { videoId: string; url: string; title: string; artist?: string; year?: string; genre?: string; thumbnailUrl?: string; format: string; ext: string; isAudio: boolean; outputPath: string; downloadId: string; audioQuality?: string }) => Promise<{ success: boolean; filePath: string }>
    cancel: (downloadId: string) => Promise<boolean>
    chooseFolder: () => Promise<string | null>
    showSaveDialog: (defaultDir: string, defaultName: string, ext: string, typeLabel: string) => Promise<string | null>
    showItemInFolder: (path: string) => Promise<boolean>
    openExternal: (url: string) => Promise<void>
    onDownloadProgress: (callback: (progress: any) => void) => () => void
    minimize: () => void
    maximize: () => void
    close: () => void
    // Download history (persisted to userData/download-history.json)
    historyLoad: () => Promise<unknown[]>
    historySave: (records: unknown[]) => Promise<void>
    historyDelete: (downloadId: string) => Promise<void>
    historyClear: () => Promise<void>
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
