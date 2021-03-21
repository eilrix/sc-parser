import { Page } from 'puppeteer/lib/cjs/puppeteer/common/Page';

import { database, saveDatabase, sleep, click as pageClick, waitFor as pageWaitFor, concurrentFlows } from './constants';

export const saveTracks = async (pages: Page[]) => {


    const newTracks = database.unreposted.sort((a, b) => Date.parse(a.date) - Date.parse(b.date))

    if (newTracks.length === 0) return;

    const playlistName = new Date(Date.now()).toISOString();
    await createPlaylist(pages[0], playlistName);

    let added = 0;
    let isWorking = true;

    (async () => {
        while (isWorking) {
            for (const page of pages) {
                if (isWorking)
                    await page.bringToFront();
                await sleep(0.5);
            }
        }
    })();

    await concurrentFlows(pages.length, newTracks, async (track, flowNum) => {
        const page = pages[flowNum];
        const waitFor = (selector: string) => pageWaitFor(page, selector);
        const click = (selector: string) => pageClick(page, selector);

        try {
            await page.goto(track.link);
        } catch (e) {
            console.error('Failed to open track: ' + track.link);
            return;
        }

        try {
            await waitFor('.soundActions .sc-button-more.sc-button');
        } catch (e) {
            console.error('Playlist button was not found(1) at: ' + track.link);
            return;
        }

        await openPlaylistDialog(page);

        const hasAdded = await page.evaluate(async (playlistName: any) => {
            const playlists = document.querySelectorAll('.modal__content .addToPlaylist .addToPlaylistList__item');
            const sleep = (time: number) => new Promise(done => setTimeout(done, time * 1000));
            let hasAdded = false;
            let hasFoundTitle = false;
            for (const playlist of Array.from(playlists)) {
                const title = playlist.querySelector('.addToPlaylistItem__content .addToPlaylistItem__titleLink')?.innerHTML;
                if (title === playlistName) {
                    hasFoundTitle = true;
                    const addBtn = (playlist.querySelector('.addToPlaylistItem__actions .addToPlaylistButton.sc-button') as HTMLButtonElement);
                    if (!addBtn) return 'Add button was not found!';

                    if (!addBtn.classList.contains('sc-button-selected')) {
                        addBtn.click();
                        await sleep(0.6);
                    }
                    if (addBtn.classList.contains('sc-button-selected')) {
                        hasAdded = true;
                    } else {
                        return 'Add button was clicked but selector was not applied';
                    }
                }
            }
            if (!hasFoundTitle) return 'Playlist was not found by title: ' + playlistName;
            return hasAdded;
        }, playlistName);


        if (hasAdded === true) {
            if (!database.tracks.some(t => t.link === track.link))
                database.tracks.push(track);

            database.unreposted = database.unreposted.filter(t => t.link !== track.link);
            added++;
            console.log('Saved track: ' + track.link);
            console.log(`${added} / ${newTracks.length}`)
            await saveDatabase();
        } else {
            console.log('Failed to save track: ' + track.link + ' Reason: ' + hasAdded);
        }
    });

    isWorking = false;
    console.log(`\n Done! ${added} / ${newTracks.length} tracks are added\n`);
}


const openPlaylistDialog = async (page: Page) => {
    const waitFor = (selector: string) => pageWaitFor(page, selector);
    const click = async (selector: string) => pageClick(page, selector);

    await click('.soundActions .sc-button-more.sc-button');
    await click('.moreActions .sc-button-addtoset.sc-button');
    await waitFor('.modal__content .addToPlaylistTabs .addToPlaylist')
}

const createPlaylist = async (page: Page, playlistName: string) => {
    const waitFor = (selector: string) => pageWaitFor(page, selector);
    const click = (selector: string) => pageClick(page, selector);

    await page.goto('https://soundcloud.com/illeniumofficial/nightlight');
    await page.bringToFront();
    await openPlaylistDialog(page);
    await click('.modal__content .addToPlaylistTabs div.tabs__tabs > ul > li:nth-child(2) > a');
    await click('.modal__content .textfield.createPlaylist__title .textfield__input');
    await page.keyboard.type(playlistName, { delay: 10 });

    await click('.modal__content .createPlaylist__saveButton.sc-button');
    await sleep(0.5);
}

