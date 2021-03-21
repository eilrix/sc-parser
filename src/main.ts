import puppeteerExtra from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { Page } from 'puppeteer/lib/cjs/puppeteer/common/Page';

import { config, database, saveDatabase, command } from './shared';
import { logIn } from './logIn';
import { parseFollowing } from './parseFollowing';
import { parseTracks } from './parseTracks';
import { saveTracks } from './saveTracks';

puppeteerExtra.use(StealthPlugin());


const main = async () => {

    const browser = await puppeteerExtra.launch({
        args: ['--no-sandbox'],
        timeout: 1000,
        // headless: false,
        slowMo: 250,
    });
    await Promise.all(Array(config.concurrency - 1).fill(1).map(_it => browser.newPage()));
    const pages: Page[] = await browser.pages();

    if (command === 'start') await startTask(pages);
    if (command === 'continue') await continueTask(pages);

    await browser.close();
};

const startTask = async (pages: Page[]) => {
    await parseFollowing(pages[0]);
    await parseTracks(pages);

    if (database.unreposted.length === 0) return;

    await logIn(pages[0]);
    await saveTracks(pages);
}

const continueTask = async (pages: Page[]) => {
    if (database.unreposted.length > 0) {
        console.log('Continue adding tracks: ' + database.unreposted.length);
        await logIn(pages[0]);
        await saveTracks(pages);
    }
}

main();