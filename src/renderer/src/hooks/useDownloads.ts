import { useState, useCallback, useRef, useEffect } from 'react'
import type { DownloadRecord } from '../types'

export function useDownloads() {
    const [downloads, setDownloads] = useState<DownloadRecord[]>([])
    const [trayOpen, setTrayOpen] = useState(false)
    const [flyState, setFlyState] = useState<{ id: number; thumbnail: string; fromX: number; fromY: number } | null>(null)

    const flyIdRef = useRef(0)

    useEffect(() => {
        window.api.historyLoad().then(raw => {
            if (Array.isArray(raw) && raw.length > 0) {
                const loaded = (raw as DownloadRecord[]).map(d =>
                    ['complete', 'error'].includes(d.status)
                        ? d
                        : { ...d, status: 'error' as const, errorMsg: 'Tải xuống bị gián đoạn' }
                )
                setDownloads(loaded)
            }
        }).catch(() => { })
    }, [])

    useEffect(() => {
        const unsub = window.api.onDownloadProgress((p) => {
            setDownloads(prev => {
                const next = prev.map(d =>
                    d.downloadId !== p.downloadId ? d : {
                        ...d,
                        status: p.status as DownloadRecord['status'],
                        percent: p.percent,
                        ...(p.speed ? { speed: p.speed } : {}),
                        ...(p.eta ? { eta: p.eta } : {}),
                        ...(p.filePath ? { filePath: p.filePath } : {}),
                        ...(p.status === 'complete' || p.status === 'error' ? { completedAt: Date.now() } : {}),
                    }
                )
                // Persist when a download finishes
                if (p.status === 'complete' || p.status === 'error') {
                    window.api.historySave(next as unknown[]).catch(() => { })
                }
                return next
            })
        })
        return () => unsub()
    }, [])

    const handleDownloadStart = useCallback((record: DownloadRecord, fromPos: { x: number; y: number }) => {
        // Register record in tray
        setDownloads(prev => {
            const exists = prev.find(d => d.downloadId === record.downloadId)
            const next = exists ? prev.map(d => d.downloadId === record.downloadId ? record : d) : [record, ...prev]

            window.api.historySave(next as unknown[]).catch(() => { })
            return next
        })

        // Launch fly animation
        flyIdRef.current += 1
        setFlyState({ id: flyIdRef.current, thumbnail: record.thumbnail, fromX: fromPos.x, fromY: fromPos.y })

        // Auto-clear fly after animation completes
        setTimeout(() => setFlyState(null), 900)
    }, [])

    const handleDelete = useCallback((downloadId: string) => {
        setDownloads(prev => prev.filter(d => d.downloadId !== downloadId))
        window.api.historyDelete(downloadId).catch(() => { })
    }, [])

    const handleClear = useCallback(() => {
        setDownloads(prev => {
            const next = prev.filter(d => !['complete', 'error'].includes(d.status))
            window.api.historySave(next as unknown[]).catch(() => { })
            return next
        })
    }, [])

    return {
        downloads,
        trayOpen, setTrayOpen,
        flyState,
        handleDownloadStart,
        handleDelete,
        handleClear
    }
}
