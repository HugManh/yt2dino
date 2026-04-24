import { contextBridge, ipcRenderer } from 'electron'

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
    audioQuality?: string
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

const api = {
    checkDependencies: (): Promise<boolean> =>
        ipcRenderer.invoke('app:check-dependencies'),

    // Bug 6 fix: include page param so infinite scroll fetches correct page
    search: (query: string, page: number = 1): Promise<VideoResult[]> =>
        ipcRenderer.invoke('youtube:search', query, page),

    getVideoInfo: (videoId: string): Promise<{ title: string; duration: string; thumbnail: string; formats: DownloadFormat[] }> =>
        ipcRenderer.invoke('youtube:get-info', videoId),

    download: (params: DownloadParams): Promise<{ success: boolean; filePath: string }> =>
        ipcRenderer.invoke('youtube:download', params),

    cancel: (downloadId: string): Promise<boolean> =>
        ipcRenderer.invoke('youtube:cancel', downloadId),

    chooseFolder: (): Promise<string | null> =>
        ipcRenderer.invoke('app:choose-folder'),

    showItemInFolder: (path: string): Promise<boolean> =>
        ipcRenderer.invoke('app:show-item-in-folder', path),

    openExternal: (url: string): Promise<void> =>
        ipcRenderer.invoke('app:open-external', url),

    onDownloadProgress: (callback: (progress: DownloadProgress) => void): (() => void) => {
        const handler = (_: Electron.IpcRendererEvent, data: DownloadProgress) => callback(data)
        ipcRenderer.on('download:progress', handler)
        return () => ipcRenderer.removeListener('download:progress', handler)
    },

    minimize: (): void => { ipcRenderer.send('window:minimize') },
    maximize: (): void => { ipcRenderer.send('window:maximize') },
    close: (): void => { ipcRenderer.send('window:close') },

    // Download history
    historyLoad: (): Promise<unknown[]> => ipcRenderer.invoke('history:load'),
    historySave: (records: unknown[]): Promise<void> => ipcRenderer.invoke('history:save', records),
    historyDelete: (downloadId: string): Promise<void> => ipcRenderer.invoke('history:delete', downloadId),
    historyClear: (): Promise<void> => ipcRenderer.invoke('history:clear'),
}

const electronBridge = {
    process: {
        env: {
            USERPROFILE: process.env.USERPROFILE || process.env.HOME || ''
        }
    }
}

if (process.contextIsolated) {
    try {
        contextBridge.exposeInMainWorld('api', api)
        contextBridge.exposeInMainWorld('electron', electronBridge)
    } catch (error) {
        console.error(error)
    }
} else {
    // @ts-ignore
    window.api = api
    // @ts-ignore
    window.electron = electronBridge
}
