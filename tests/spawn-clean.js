const cp = require('child_process');
const electron = require('electron'); // path to binary
console.log('binary:', electron);

const env = { ...process.env };
// Remove ALL ELECTRON_* and NODE_* variables that might interfere
for (const key of Object.keys(env)) {
    if (key.startsWith('ELECTRON_') || key.startsWith('NODE_') || key.startsWith('npm_')) {
        delete env[key];
    }
}

const child = cp.spawn(electron, ['minimal.js'], {
    stdio: 'inherit',
    env: env
});

child.on('close', code => console.log('Exited with', code));
