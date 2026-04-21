const { YouTube } = require('youtube-sr');
YouTube.search('test', { limit: 1 }).then(res => {
    console.log('Search success:', res.length);
}).catch(err => {
    console.error('Search failed:', err);
});
