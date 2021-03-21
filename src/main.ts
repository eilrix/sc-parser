import puppeteerExtra from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { Page } from 'puppeteer/lib/cjs/puppeteer/common/Page';

import { config, database, saveDatabase } from './constants';
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
        slowMo: 150,
    });
    await Promise.all(Array(config.concurrency - 1).fill(1).map(_it => browser.newPage()));
    const pages: Page[] = await browser.pages();

    const following = await parseFollowing(pages[0]);
    database.following = following;
    console.log('following', following);


    await parseTracks(pages, following);


    console.log('\nParsing is done!');
    console.log(`Found ${database.unreposted.length} new tracks\n`)
    await saveDatabase();

    if (database.unreposted.length === 0) return;

    await logIn(pages[0]);

    await saveTracks(pages);

    await saveDatabase();
    await browser.close();
};

main();