const { app, BrowserWindow } = require('electron');
console.log('typeof app:', typeof app);
if (typeof app !== 'undefined') {
    app.whenReady().then(() => {
        const win = new BrowserWindow({ width: 800, height: 600 });
        win.loadURL('https://youtube.com');
    });
} else {
    console.log('Failed to load electron app context.');
}
