const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('node:path');

const runTest = async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setRequestInterception(true);

  page.on('request', interceptedRequest => {
    if (interceptedRequest.isInterceptResolutionHandled()) return;

    console.log(interceptedRequest.url())

    interceptedRequest.continue();
  });

  await page.goto('https://storage.googleapis.com/rbf-test/index.html', {
    waitUntil: 'domcontentloaded',
    timeout: 0
  });

  const allResultsSelector = 'table tbody tr:nth-child(33)';
  await page.waitForSelector(allResultsSelector, {timeout: 1000000, visible: true});

  const resultsSelector = 'table tbody tr';

  const data = await page.evaluate(resultsSelector => {
    const timestamp = new Date().toLocaleString('en-US');
    return [...document.querySelectorAll(resultsSelector)].map(anchor => {
      const title = anchor.innerText.split('\t')
      return `${timestamp},${title}`;
    });
  }, resultsSelector);

  await browser.close();

  return Promise.resolve(data)
};

const main = async () => {

  let output = path.join(__dirname, `/results/rbv-output-${Date.now()}.csv`)
  let csv = `run_id,bucket_region,bucket_region_name,file_size,mib_s,browser,server,server_client,server_hop, browser_boost_percent,\n`;
  const tests = []

  for(let a = 0; a<=75; a++){
    tests.push(runTest())
  }

  Promise.all(
      tests
  ).then(results => {

    results.forEach(data => data.forEach(row => csv += `${row}\n`))

    fs.writeFile(output, csv, err => {
      if (err) {
        console.error(err);
      }
      console.log(`complete`)
    })

  })
}

main()