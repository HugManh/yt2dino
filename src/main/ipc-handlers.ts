import { ipcMain, dialog, BrowserWindow, app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync, readdirSync, renameSync, rmSync } from 'fs'
import { readFile, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import YTDlpWrap from 'yt-dlp-wrap'
import NodeID3 from 'node-id3'
import https from 'https'
import http from 'http'

/** Fetch a URL and return the body as a Buffer */
function fetchBuffer(url: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const get = url.startsWith('https') ? https.get : http.get
        get(url, (res) => {
            // Follow redirects
            if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return fetchBuffer(res.headers.location).then(resolve).catch(reject)
            }
            const chunks: Buffer[] = []
            res.on('data', (c: Buffer) => chunks.push(c))
            res.on('end', () => resolve(Buffer.concat(chunks)))
            res.on('error', reject)
        }).on('error', reject)
    })
}

/**
 * Write ID3 tags to an MP3 file.
 * @param filePath  Absolute path to the .mp3 file
 * @param tags      Tag values (all optional)
 */
async function writeMp3Tags(
    filePath: string,
    tags: {
        title?: string
        artist?: string
        year?: string
        genre?: string
        thumbnailUrl?: string
    }
): Promise<void> {
    const id3Tags: NodeID3.Tags = {}

    if (tags.title) id3Tags.title = tags.title
    if (tags.artist) id3Tags.artist = tags.artist
    if (tags.year) id3Tags.year = tags.year
    if (tags.genre) id3Tags.genre = tags.genre

    // Fetch cover art
    if (tags.thumbnailUrl) {
        try {
            const imageBuffer = await fetchBuffer(tags.thumbnailUrl)
            id3Tags.image = {
                mime: 'image/jpeg',
                type: { id: 3, name: 'front cover' },
                description: 'Cover',
                imageBuffer
            }
        } catch (e) {
            console.warn('Could not fetch thumbnail for ID3 cover:', e)
        }
    }

    NodeID3.write(id3Tags, filePath)
}

// Map to track active downloads so we can cancel them
const activeDownloads = new Map<string, { process: any; cancel: () => void }>()

const ffmpegStatic = require('ffmpeg-static')
function getFfmpegPath(): string {
    if (!ffmpegStatic) return ''
    return ffmpegStatic.replace('app.asar', 'app.asar.unpacked')
}

// Initialize yt-dlp binary path
function getYtDlpBinaryPath(): string {
    const isWin = process.platform === 'win32'
    const binaryName = isWin ? 'yt-dlp.exe' : 'yt-dlp'
    // Store in app.getPath('userData') so it's outside readonly resources
    const { app } = require('electron')
    const userDataPath = app.getPath('userData')
    return join(userDataPath, binaryName)
}

export function registerIpcHandlers(getMainWindow: () => BrowserWindow | null): void {
    ipcMain.handle('app:check-dependencies', async () => {
        const binPath = getYtDlpBinaryPath()
        if (!existsSync(binPath)) {
            try {
                const YTDlpClass = (YTDlpWrap as any).default || YTDlpWrap
                await YTDlpClass.downloadFromGithub(binPath)
            } catch (err) {
                console.error('Failed to download yt-dlp', err)
                return false
            }
        }
        return true
    })

    // ─── SEARCH ───────────────────────────────────────────────────────────────
    ipcMain.handle('youtube:search', async (_event, query: string, page: number = 1) => {
        if (!query || typeof query !== 'string' || query.trim().length === 0) {
            throw new Error('Invalid search query')
        }

        try {
            const YTDlpClass = (YTDlpWrap as any).default || YTDlpWrap
            const ytDlp = new YTDlpClass(getYtDlpBinaryPath())
            const limit = page * 20
            const searchArgs = [
                `ytsearch${limit}:${query.trim()}`,
                '--dump-json',
                '--no-playlist',
                '--ignore-errors'
            ]

            const output = await ytDlp.execPromise(searchArgs)
            const results = output
                .trim()
                .split('\n')
                .filter(Boolean)
                .map((line: string) => {
                    try {
                        return JSON.parse(line)
                    } catch (e) {
                        return null
                    }
                })
                .filter(Boolean)

            return results.map((video: any) => ({
                id: video.id,
                title: video.title,
                channel: video.uploader || video.channel || 'Unknown',
                duration: video.duration_string || '',
                thumbnail: video.thumbnail || `https://i.ytimg.com/vi/${video.id}/mqdefault.jpg`,
                views: video.view_count || 0,
                uploadedAt: video.upload_date || '',
                url: video.webpage_url || `https://www.youtube.com/watch?v=${video.id}`
            }))
        } catch (err: any) {
            console.error('Search error:', err)
            throw new Error(`Search failed: ${err.message}`)
        }
    })
    // ─── CHOOSE FOLDER ────────────────────────────────────────────────────────
    ipcMain.handle('app:choose-folder', async () => {
        const win = getMainWindow()
        const result = await dialog.showOpenDialog(win!, {
            properties: ['openDirectory'],
            title: 'Chọn thư mục lưu file'
        })
        if (result.canceled || result.filePaths.length === 0) return null
        return result.filePaths[0]
    })

    // ─── GET VIDEO INFO ───────────────────────────────────────────────────────
    ipcMain.handle('youtube:get-info', async (_event, videoId: string) => {
        if (!videoId || typeof videoId !== 'string') throw new Error('Invalid video ID')
        try {
            const YTDlpClass = (YTDlpWrap as any).default || YTDlpWrap
            const ytDlp = new YTDlpClass(getYtDlpBinaryPath())
            const info = await ytDlp.getVideoInfo(`https://www.youtube.com/watch?v=${videoId}`)

            const formats = (info.formats || [])
                .filter((f: any) => f.vcodec !== 'none' || f.acodec !== 'none')
                .map((f: any) => ({
                    formatId: f.format_id,
                    ext: f.ext,
                    resolution: f.resolution || (f.height ? `${f.height}p` : 'audio only'),
                    filesize: f.filesize || f.filesize_approx || 0,
                    vcodec: f.vcodec,
                    acodec: f.acodec
                }))

            // Filter unique video qualities
            const videoFormats = [
                { label: 'MP4 1080p', value: 'bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080][ext=mp4]/best[height<=1080]', ext: 'mp4' },
                { label: 'MP4 720p', value: 'bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][ext=mp4]/best[height<=720]', ext: 'mp4' },
                { label: 'MP4 480p', value: 'bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/best[height<=480][ext=mp4]/best[height<=480]', ext: 'mp4' },
                { label: 'MP4 Best', value: 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best', ext: 'mp4' },
                { label: 'MP3 Audio', value: 'bestaudio/best', ext: 'mp3', isAudio: true },
            ]

            return {
                title: info.title,
                duration: info.duration_string || '',
                thumbnail: info.thumbnail || `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
                formats: videoFormats
            }
        } catch (err: any) {
            console.error('Get info error:', err)
            // Return default formats even if yt-dlp fails for basic info
            const videoFormats = [
                { label: 'MP4 1080p', value: 'bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080][ext=mp4]/best[height<=1080]', ext: 'mp4' },
                { label: 'MP4 720p', value: 'bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][ext=mp4]/best[height<=720]', ext: 'mp4' },
                { label: 'MP4 480p', value: 'bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/best[height<=480][ext=mp4]/best[height<=480]', ext: 'mp4' },
                { label: 'MP4 Best', value: 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best', ext: 'mp4' },
                { label: 'MP3 Audio', value: 'bestaudio/best', ext: 'mp3', isAudio: true },
            ]
            return { title: '', duration: '', thumbnail: '', formats: videoFormats }
        }
    })

    // ─── DOWNLOAD ─────────────────────────────────────────────────────────────
    ipcMain.handle(
        'youtube:download',
        async (
            event,
            params: {
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
        ) => {
            const { videoId, url, title, artist, year, genre, thumbnailUrl, format, ext, isAudio, outputDir, downloadId, audioQuality } = params

            // Validate inputs
            if (!videoId || !url || !outputDir || !downloadId) {
                throw new Error('Invalid download parameters')
            }

            // Ensure output directory exists
            if (!existsSync(outputDir)) {
                mkdirSync(outputDir, { recursive: true })
            }

            const win = getMainWindow()
            const YTDlpClass = (YTDlpWrap as any).default || YTDlpWrap
            const ytDlp = new YTDlpClass(getYtDlpBinaryPath())

            // Build output template
            const safeTitle = title.replace(/[<>:"/\\|?*]/g, '_').substring(0, 100)
            const outputTemplate = join(outputDir, `${safeTitle}.%(ext)s`)

            const ytDlpArgs: string[] = [
                url,
                '-f', format,
                '-o', outputTemplate,
                '--no-playlist',
                '--no-part'
            ]

            const ffmpegPath = getFfmpegPath()
            if (ffmpegPath) {
                ytDlpArgs.push('--ffmpeg-location', ffmpegPath)
            }

            // For audio: use a hidden temp dir so intermediate webm stays invisible.
            // After conversion the mp3 will be moved to outputDir and temp dir removed.
            let tempDir = ''

            if (isAudio) {
                tempDir = join(tmpdir(), `yt2-${downloadId}`)
                mkdirSync(tempDir, { recursive: true })
                // Override the -o template to point at temp dir
                const tempTemplate = join(tempDir, `${safeTitle}.%(ext)s`)
                // Replace the -o argument already added above
                const oIdx = ytDlpArgs.indexOf('-o')
                if (oIdx !== -1) ytDlpArgs[oIdx + 1] = tempTemplate

                ytDlpArgs.push(
                    '-x',
                    '--audio-format', ext,
                    '--audio-quality', params.audioQuality || '0'
                )
            } else {
                ytDlpArgs.push('--merge-output-format', 'mp4', '--embed-thumbnail', '--add-metadata')
            }

            return new Promise<{ success: boolean; filePath: string }>((resolve, reject) => {
                let filePath = ''
                let cancelled = false

                const emitPush = (data: object) => {
                    if (win && !win.isDestroyed()) {
                        win.webContents.send('download:progress', { downloadId, ...data })
                    }
                }

                try {
                    const proc = ytDlp.exec(ytDlpArgs)

                    const cancel = () => {
                        cancelled = true
                        proc.kill()
                    }

                    activeDownloads.set(downloadId, { process: proc, cancel })

                    proc.on('progress', (progress: any) => {
                        emitPush({
                            status: 'downloading',
                            percent: Math.round(progress.percent || 0),
                            speed: progress.currentSpeed || '',
                            eta: progress.eta || ''
                        })
                    })

                    proc.on('ytDlpEvent', (eventType: string, eventData: string) => {
                        if (eventType === 'download' && eventData.includes('Destination')) {
                            const match = eventData.match(/Destination: (.+)$/)
                            if (match) filePath = match[1].trim()
                        }
                        if (eventType === 'ExtractAudio') {
                            // Audio: ffmpeg is now converting to MP3
                            emitPush({ status: 'converting', percent: 100 })
                        }
                        if (eventType === 'merger') {
                            // Video: ffmpeg is merging streams
                            emitPush({ status: 'processing', percent: 100 })
                        }
                    })

                    proc.on('close', async (code: number) => {
                        activeDownloads.delete(downloadId)
                        if (cancelled) {
                            // Cleanup temp dir if audio
                            if (tempDir && existsSync(tempDir)) {
                                try { rmSync(tempDir, { recursive: true, force: true }) } catch (_) { }
                            }
                            reject(new Error('Download cancelled'))
                            return
                        }
                        if (code === 0) {
                            let finalPath = ''
                            if (isAudio && tempDir) {
                                // Find the mp3 in tempDir and move it to outputDir
                                try {
                                    const mp3File = readdirSync(tempDir).find(f => f.endsWith('.mp3'))
                                    if (mp3File) {
                                        const src = join(tempDir, mp3File)
                                        const dest = join(outputDir, mp3File)
                                        renameSync(src, dest)
                                        finalPath = dest

                                        // ── Auto-tag MP3 ──────────────────────────
                                        emitPush({ status: 'tagging', percent: 99 })
                                        try {
                                            await writeMp3Tags(dest, {
                                                title: title || undefined,
                                                artist: artist || undefined,
                                                year: year || undefined,
                                                genre: genre || 'Music',
                                                thumbnailUrl: thumbnailUrl || undefined
                                            })
                                        } catch (tagErr) {
                                            console.warn('ID3 tagging failed (file is still saved):', tagErr)
                                        }
                                        // ──────────────────────────────────────────
                                    }
                                } catch (moveErr) {
                                    console.error('Failed to move mp3:', moveErr)
                                } finally {
                                    // Always cleanup temp dir
                                    try { rmSync(tempDir, { recursive: true, force: true }) } catch (_) { }
                                }
                            } else {
                                // Non-audio: use guessed path or captured path
                                const guessedPath = join(outputDir, `${safeTitle}.mp4`)
                                finalPath = filePath || guessedPath
                            }
                            emitPush({ status: 'complete', percent: 100, filePath: finalPath })
                            resolve({ success: true, filePath: finalPath })
                        } else {
                            if (tempDir && existsSync(tempDir)) {
                                try { rmSync(tempDir, { recursive: true, force: true }) } catch (_) { }
                            }
                            reject(new Error(`yt-dlp exited with code ${code}`))
                        }
                    })

                    proc.on('error', (err: Error) => {
                        activeDownloads.delete(downloadId)
                        // Bug 5 fix: cleanup orphaned tempDir on process error
                        if (tempDir && existsSync(tempDir)) {
                            try { rmSync(tempDir, { recursive: true, force: true }) } catch (_) { }
                        }
                        reject(err)
                    })
                } catch (err: any) {
                    reject(err)
                }
            })
        }
    )

    // ─── CANCEL DOWNLOAD ──────────────────────────────────────────────────────
    ipcMain.handle('youtube:cancel', async (_event, downloadId: string) => {
        const dl = activeDownloads.get(downloadId)
        if (dl) {
            dl.cancel()
            activeDownloads.delete(downloadId)
            return true
        }
        return false
    })

    // ─── WINDOW CONTROLS ──────────────────────────────────────────────────────
    ipcMain.on('window:minimize', () => getMainWindow()?.minimize())
    ipcMain.on('window:maximize', () => {
        const win = getMainWindow()
        if (win?.isMaximized()) win.unmaximize()
        else win?.maximize()
    })
    ipcMain.on('window:close', () => getMainWindow()?.close())

    // Toggle Electron DevTools
    ipcMain.handle('app:toggle-devtools', () => {
        const win = getMainWindow()
        if (!win) return
        if (win.webContents.isDevToolsOpened()) {
            win.webContents.closeDevTools()
        } else {
            win.webContents.openDevTools({ mode: 'detach' })
        }
    })

    // ── Download History ─────────────────────────────────────────
    const histFile = () => join(app.getPath('userData'), 'download-history.json')

    ipcMain.handle('history:load', async () => {
        try {
            const raw = await readFile(histFile(), 'utf-8')
            return JSON.parse(raw)
        } catch {
            return []
        }
    })

    ipcMain.handle('history:save', async (_e, records: unknown[]) => {
        try {
            await writeFile(histFile(), JSON.stringify(records, null, 2), 'utf-8')
        } catch (err) {
            console.error('[history:save]', err)
        }
    })

    ipcMain.handle('history:delete', async (_e, downloadId: string) => {
        try {
            const raw = await readFile(histFile(), 'utf-8')
            const arr = JSON.parse(raw) as { downloadId: string }[]
            await writeFile(histFile(), JSON.stringify(arr.filter(r => r.downloadId !== downloadId), null, 2), 'utf-8')
        } catch {
            // File may not exist yet — nothing to do
        }
    })

    ipcMain.handle('history:clear', async () => {
        try {
            await writeFile(histFile(), '[]', 'utf-8')
        } catch (err) {
            console.error('[history:clear]', err)
        }
    })
}
