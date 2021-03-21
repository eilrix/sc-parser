import { Page } from 'puppeteer/lib/cjs/puppeteer/common/Page';

import { config } from './constants';

export const parseFollowing = async (page: Page): Promise<string[]> => {
    await page.goto(`https://soundcloud.com/${config.target}/following`);

    const links = await page.evaluate(async () => {
        const sleep = (time: number) => new Promise(done => setTimeout(done, time * 1000));
        while (true) {
            window.scrollTo(0, document.body.scrollHeight);
            await sleep(0.5);
            if (!document.querySelector('.userNetwork .badgeList.m-oneRow.lazyLoadingList .loading.regular')) break
        }

        const links = Array.from(document.querySelectorAll('.badgeList__item .userBadgeListItem .userBadgeListItem__image')).map(
            (item: any) => item.href
        );
        return links.filter(Boolean) as string[];
    });
    return links;
}
