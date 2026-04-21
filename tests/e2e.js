const { _electron: electron } = require('playwright');

(async () => {
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  
  const electronApp = await electron.launch({ args: ['.'], env });
  const window = await electronApp.firstWindow();
  
  window.on('console', msg => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));
  
  await window.waitForLoadState('domcontentloaded');
  await window.fill('input.search-input', 'vietnam travel 4k');
  
  try {
    await window.waitForSelector('.video-card', { timeout: 10000 });
    console.log('Success, found cards');
  } catch (err) {
    if (await window.$('.empty-state')) {
      const errorText = await window.innerText('.empty-state p');
      console.log('UI Error State:', errorText);
    }
  }

  await electronApp.close();
})().catch(err => {
  console.error(err);
  process.exit(1);
});
