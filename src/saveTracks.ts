import { Page } from 'puppeteer/lib/cjs/puppeteer/common/Page';

import {
    click as pageClick,
    command,
    concurrentFlows,
    database,
    removeAds,
    saveDatabase,
    sleep,
    TTrack,
    waitFor as pageWaitFor,
} from './shared';

export const saveTracks = async (pages: Page[]) => {
    const newTracks = database.unreposted.sort((a, b) => Date.parse(b.date) - Date.parse(a.date))

    if (newTracks.length === 0) return;

    const playlistName = (command === 'continue' && database.lastPlaylist) ? database.lastPlaylist :
        new Date(Date.now()).toISOString();

    if (!(command === 'continue' && database.lastPlaylist)) {
        await createPlaylist(pages[0], playlistName, newTracks[0]);
        database.lastPlaylist = playlistName;
        await saveDatabase();
        newTracks.shift();
    }

    let added = 0;
    let failed = 0;
    let isWorking = true;
    let reachedLimit = false;

    for (const page of pages) {
        await page.bringToFront();
        await removeAds(page);
    }

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

        if (reachedLimit) return;

        try {
            await page.goto(track.link);
        } catch (e) {
            console.error('Failed to open track: ' + track.link);
            return false;
        }

        const addTrack = async (): Promise<boolean> => {
            try {
                await waitFor('.soundActions .sc-button-more.sc-button');
            } catch (e) {
                console.error('Playlist button was not found(1) at: ' + track.link);
                return false;
            }

            await openPlaylistDialog(page);

            type TStats = {
                hasAdded: boolean;
                message?: string;
                reachedLimit?: boolean;
            };
            const stats: TStats = await page.evaluate(async (playlistName: any): Promise<TStats> => {
                const playlists = document.querySelectorAll('.modal__content .addToPlaylist .addToPlaylistList__item');
                const sleep = (time: number) => new Promise(done => setTimeout(done, time * 1000));
                let hasAdded = false;
                let hasFoundTitle = false;
                for (const playlist of Array.from(playlists)) {
                    const title = playlist.querySelector('.addToPlaylistItem__content .addToPlaylistItem__titleLink')?.innerHTML;
                    if (title === playlistName) {
                        hasFoundTitle = true;
                        const addBtn = (playlist.querySelector('.addToPlaylistItem__actions .addToPlaylistButton.sc-button') as HTMLButtonElement);
                        if (!addBtn) return {
                            hasAdded: false,
                            message: 'Add button was not found!'
                        }

                        if (!addBtn.classList.contains('sc-button-selected')) {
                            addBtn.click();
                            await sleep(1);
                        }

                        if (addBtn.disabled) return {
                            hasAdded: false,
                            reachedLimit: true,
                            message: "Add button is disabled. We're reached a limit for the playlist"
                        };

                        if (addBtn.classList.contains('sc-button-selected')) {
                            hasAdded = true;
                        } else {
                            return {
                                hasAdded: false,
                                message: 'Add button was clicked but selector was not applied'
                            };
                        }
                    }
                }
                if (!hasFoundTitle) return {
                    hasAdded: false,
                    message: 'Playlist was not found by title: ' + playlistName
                };
                return {
                    hasAdded,
                };
            }, playlistName);

            if (stats.reachedLimit) reachedLimit = true;

            if (!stats.hasAdded) {
                console.log('Failed to save track: ' + track.link + ' Reason: ' + stats.message);
                return false;
            }

            return !!stats.hasAdded;
        }

        let success = false;
        try {
            success = await addTrack();
        } catch (e) {
            console.error(e);
        }

        if (!success) {
            console.log('Failed to save track after first attempt: ' + track.link + ' Repeating...');
            try {
                await page.reload();
                success = await addTrack();
            } catch (e) {
                console.error(e);
            }
        }
        if (!success) {
            console.log('Failed to save track after second attempt: ' + track.link + ' Repeating...');
            try {
                await page.reload();
                success = await addTrack();
            } catch (e) {
                console.error(e);
            }
        }

        if (success) {
            if (!database.tracks.some(t => t.link === track.link))
                database.tracks.push(track);

            database.unreposted = database.unreposted.filter(t => t.link !== track.link);
            added++;
            console.log('Saved track: ' + track.link);
            console.log(`Added: ${added}, failed: ${failed}, out of ${newTracks.length} total`)
            await saveDatabase();
        } else {
            console.log('Failed to save track after 3 attempts: ' + track.link + ' Abandon track.');
            failed++;
        }
    });

    isWorking = false;
    console.log(`\n Done! ${added} / ${newTracks.length} tracks are added. ${failed} Failed to add\n`);
    await saveDatabase();
}


const openPlaylistDialog = async (page: Page) => {
    const waitFor = (selector: string) => pageWaitFor(page, selector);
    const click = async (selector: string) => pageClick(page, selector);

    await click('.soundActions .sc-button-more.sc-button');
    await click('.moreActions .sc-button-addtoset.sc-button');
    await waitFor('.modal__content .addToPlaylistTabs .addToPlaylist')
}

const createPlaylist = async (page: Page, playlistName: string, firstTrack: TTrack) => {
    const waitFor = (selector: string) => pageWaitFor(page, selector);
    const click = (selector: string) => pageClick(page, selector);

    await page.goto(firstTrack.link);
    await page.bringToFront();
    await openPlaylistDialog(page);
    await click('.modal__content .addToPlaylistTabs div.tabs__tabs > ul > li:nth-child(2) > a');
    await click('.modal__content .textfield.createPlaylist__title .textfield__input');
    await page.keyboard.type(playlistName, { delay: 10 });

    await click('.modal__content .createPlaylist__saveButton.sc-button');
    await sleep(0.5);
    console.log('Created new playlist: ' + playlistName);
}

