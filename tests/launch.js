const { spawn } = require('child_process');
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const child = spawn('npm', ['run', 'dev'], {
    env,
    stdio: 'inherit',
    shell: true
});

child.on('close', code => process.exit(code || 0));
