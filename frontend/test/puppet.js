const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setRequestInterception(true);


  page.on('request', interceptedRequest => {
    if (interceptedRequest.isInterceptResolutionHandled()) return;

    console.log(interceptedRequest.url())

    interceptedRequest.continue();
  });

  await page.goto('https://storage.googleapis.com/rbf-test/index.html', {
    waitUntil: 'domcontentloaded'
  });

  const allResultsSelector = 'table tbody tr:nth-child(33)';
  await page.waitForSelector(allResultsSelector, {timeout: 30000, visible: true});

  const resultsSelector = 'table tbody tr';

  const data = await page.evaluate(resultsSelector => {
    return [...document.querySelectorAll(resultsSelector)].map(anchor => {
      const title = anchor.innerText.split('\t')
      return `${title}`;
    });
  }, resultsSelector);

  console.log(data)

  await browser.close();
})();