import fs from 'fs-extra';
import { resolve } from 'path';
import { Page } from 'puppeteer/lib/cjs/puppeteer/common/Page';
import { Frame } from 'puppeteer/lib/cjs/puppeteer/common/FrameManager';

export type TConfig = {
    email: string;
    password: string;
    target: string;
    concurrency: number;
    timeRange: number;
    headless?: boolean;
}
export type TTrack = {
    link: string;
    date: string;

}
export type TDatabase = {
    tracks: TTrack[];
    unreposted: TTrack[];
    following: string[];
    lastPlaylist?: string;
}
export type TCommand = 'continue' | 'start' | undefined;
export const command: TCommand = (process.argv[2] as TCommand) ?? 'start';

export const config: TConfig = fs.readJSONSync(resolve(process.cwd(), 'config.json'));
export const sleep = (time: number) => new Promise(done => setTimeout(done, time * 1000));

export const trackDateMin = new Date(Date.now() - 1000 * config.timeRange);

export const databasePath = resolve(process.cwd(), 'data/db.json');
export const database: TDatabase = fs.pathExistsSync(databasePath) ? fs.readJSONSync(databasePath) : {};
if (!database.unreposted) database.unreposted = [];
if (!database.tracks) database.tracks = [];
if (!database.following) database.following = [];

export const saveDatabase = async () => await fs.outputJSON(databasePath, database, {
    spaces: 2
});

export const cookiesPath = resolve(process.cwd(), 'data/cookies.json');
export const localStoragePath = resolve(process.cwd(), 'data/local-storage.json');

export const waitFor = async (page: Page | Frame, selector: string) => {
    await page.waitForSelector(selector, {
        timeout: 7000,
    });
}
export const click = async (page: Page | Frame, selector: string) => {
    await waitFor(page, selector);
    await page.click(selector);
}

export const concurrentFlows = async <T>(flowQnt: number, items: T[], worker: (item: T, flowNum: number) => Promise<any>) => {
    const statuses: Promise<any>[] = [];
    for (let i = 0; i < items.length; i++) {
        const num = i % flowQnt;
        if (statuses[num]) {
            await statuses[num];
        }
        const item = items[i];
        statuses[num] = worker(item, num);
    }
    await Promise.all(statuses);
}