const YTDlpWrap = require('yt-dlp-wrap').default;
const ytDlp = new YTDlpWrap('yt-dlp.exe');
async function testSearch() {
    console.time('search');
    const output = await ytDlp.execPromise(['ytsearch5:vietnam', '--dump-json', '--no-playlist']);
    const results = output.trim().split('\n').filter(Boolean).map(line => {
        try { return JSON.parse(line); } catch (e) { return null; }
    }).filter(Boolean);

    console.timeEnd('search');
    console.log('Results:', results.length);
    if (results.length > 0) {
        console.log('Sample:', results[0].title, results[0].duration_string, results[0].uploader);
    }
}
testSearch();
