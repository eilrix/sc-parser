import fs from 'fs-extra';
import { Page } from 'puppeteer/lib/cjs/puppeteer/common/Page';

import { config, cookiesPath, sleep, localStoragePath, click as pageClick, waitFor as pageWaitFor } from './shared';

const saveSession = async (page: Page) => {
    const newCookies = await page.cookies();
    await fs.outputJSON(cookiesPath, newCookies);

    const newLocalStorage = await page.evaluate(() => Object.assign({}, window.localStorage));
    await fs.outputJSON(localStoragePath, newLocalStorage);
}

const loadSession = async (page: Page): Promise<boolean> => {
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
                await saveSession(page);
                return true;
            }
        } catch (e) { }
    }
    return false;
}

export const logIn = async (page: Page) => {
    await page.goto('https://soundcloud.com/');
    await page.bringToFront();
    const waitFor = (selector: string) => pageWaitFor(page, selector);
    const click = (selector: string) => pageClick(page, selector);

    const success = await loadSession(page);
    if (success) return;

    await page.goto('https://soundcloud.com/');
    await sleep(1);

    try {
        await click('#onetrust-accept-btn-handler');
        await sleep(1);
    } catch (error) { }

    await page.evaluate(() => {
        document.querySelector('#onetrust-consent-sdk')?.remove();
        document.querySelector('#onetrust-banner-sdk')?.remove();
    });

    await click('.frontHero__signin .frontHero__loginButton.loginButton');
    await waitFor('.modal__content .webAuthContainer iframe');

    const iframeSrc = await page.evaluate(() => {
        return document.querySelector('.modal__content .webAuthContainer iframe')?.getAttribute('src');
    });
    if (!iframeSrc) throw new Error('!iframeSrc');

    const frames = page.frames();
    const authFrame = frames.find(frame => frame.url() === iframeSrc);

    if (!authFrame) throw new Error('!authFrame');
    const frameWaitFor = (selector: string) => pageWaitFor(authFrame, selector);

    await frameWaitFor('#sign_in_up_email');
    await authFrame.focus('#sign_in_up_email');
    await page.keyboard.type(config.email, { delay: 10 });

    await authFrame.click('#sign_in_up_submit')

    await frameWaitFor('#enter_password_field');
    await authFrame.focus('#enter_password_field')
    await page.keyboard.type(config.password, { delay: 10 });

    await authFrame.click('#enter_password_submit');
    await sleep(2);
    await page.goto('https://soundcloud.com/you/library');
    await waitFor('.l-collection');

    await saveSession(page);
}