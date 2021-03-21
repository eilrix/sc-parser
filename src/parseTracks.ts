import { Page } from 'puppeteer/lib/cjs/puppeteer/common/Page';

import { concurrentFlows, database, saveDatabase, trackDateMin, TTrack, sleep } from './constants';

export const parseTracks = async (pages: Page[], following: string[]) => {

    let totalNewTracks: TTrack[] = [];

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

    await concurrentFlows(pages.length, following, async (artist, flowNum) => {
        const page = pages[flowNum];
        try {
            await page.goto(`${artist}/tracks`);
        } catch (e) {
            console.error('Failed to open artist profile: ' + artist, e);
            return;
        }

        const tracks = await page.evaluate(async (trackDateMin: any) => {
            const sleep = (time: number) => new Promise(done => setTimeout(done, time * 1000));
            const newTracks: TTrack[] = [];
            const newTrackLinks: string[] = [];
            while (true) {
                const tracks = Array.from(
                    document.querySelectorAll('.soundList__item'));

                for (const track of tracks) {
                    const trackLink = (track.querySelector('.sound__coverArt') as HTMLLinkElement)?.href;
                    const trackTime = track.querySelector('.soundTitle__uploadTime .relativeTime')?.getAttribute('datetime');
                    if (trackTime && trackLink) {
                        const trackDateTime = new Date(Date.parse(trackTime));
                        const dateMin = new Date(Date.parse(trackDateMin));
                        if (trackDateTime.getTime() > dateMin.getTime()) {
                            if (!newTrackLinks.includes(trackLink)) {
                                newTrackLinks.push(trackLink);
                                newTracks.push({
                                    link: trackLink,
                                    date: trackDateTime.toISOString(),
                                });
                            }
                        } else {
                            return newTracks;
                        }
                    }
                }

                window.scrollTo(0, document.body.scrollHeight);
                await sleep(0.5);
                if (!document.querySelector('.userMain .soundList.lazyLoadingList .loading.regular')) break;
            }
            return newTracks;
        }, trackDateMin.toISOString());

        const newTracks = tracks.filter(newTrack => !database.tracks.some(track => track.link === newTrack.link));

        if (newTracks.length > 0) {
            console.log(`\nFound ${newTracks.length} new tracks for author: ${artist}`);
        }

        newTracks.forEach(track => totalNewTracks.push(track));


        newTracks.forEach(track => {
            if (!database.unreposted.some(t => t.link === track.link)) {
                database.unreposted.push(track);
            }
        });

        await saveDatabase();
    })

    isWorking = false;
}