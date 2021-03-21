import fs from 'fs-extra';
import { Page } from 'puppeteer/lib/cjs/puppeteer/common/Page';

import { config, cookiesPath, sleep, localStoragePath, click as pageClick, waitFor as pageWaitFor } from './constants';

export const logIn = async (page: Page) => {
    await page.goto('https://soundcloud.com/');
    await page.bringToFront();
    const waitFor = (selector: string) => pageWaitFor(page, selector);
    const click = (selector: string) => pageClick(page, selector);

    const oldCookies = (await fs.pathExists(cookiesPath)) ? await fs.readJSON(cookiesPath) : null;
    const oldLocalStorage = (await fs.pathExists(localStoragePath)) ? await fs.readJSON(localStoragePath) : null;
    if (oldCookies && oldLocalStorage) {
        await page.setCookie(...oldCookies);

        if (oldLocalStorage) {
            await page.evaluate((oldLocalStorage: any) => {
                Object.keys(oldLocalStorage).forEach(key => {
                    window.localStorage.setItem(key, oldLocalStorage[key]);
                })
            }, oldLocalStorage);
        }

        // check auth
        await page.goto('https://soundcloud.com/you/library');
        try {
            const homeEl = await page.waitForSelector('.l-collection', {
                timeout: 4000,
            });

            if (homeEl) {
                // we're successfully authorized via old session
                return;
            }
        } catch (e) { }
    }


    await page.goto('https://soundcloud.com/');

    await click('.frontHero__signin .frontHero__loginButton.loginButton');
    await waitFor('.modal__content .webAuthContainer iframe');

    const iframeSrc = await page.evaluate(() => {
        return document.querySelector('.modal__content .webAuthContainer iframe')?.getAttribute('src');
    });
    if (!iframeSrc) throw new Error('!iframeSrc');

    await page.goto(iframeSrc);

    await waitFor('#sign_in_up_email');
    await page.focus('#sign_in_up_email');
    await page.keyboard.type(config.email, { delay: 10 });

    await page.click('#sign_in_up_submit')

    await waitFor('#enter_password_field');
    await page.focus('#enter_password_field')
    await page.keyboard.type(config.password, { delay: 10 });

    await page.click('#enter_password_submit');
    await sleep(2);
    await page.goto('https://soundcloud.com/you/library');
    await waitFor('.l-collection');

    const newCookies = await page.cookies();
    await fs.outputJSON(cookiesPath, newCookies);

    const newLocalStorage = await page.evaluate(() => Object.assign({}, window.localStorage));
    await fs.outputJSON(localStoragePath, newLocalStorage);

}