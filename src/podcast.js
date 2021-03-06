const { default: axios } = require("axios");
const xml2js = require("xml2js");
const fs = require("fs");
const player = require('play-sound')(opts = {})
const log = require('loglevel');
const path = require('path');
const { resolve } = require("path");

const Podcast = class {
    constructor(url, id, audio, notifier) {
        this.id = id;
        this.url = url;
        this.audio = audio;
        this.notifier = notifier;

        this.lastPlayedGuid = null;
        this.title = null;
    }

    async checkForUpdate(skipPlaying) {
        const response = await axios.get(this.url);
		const json = await xml2js.parseStringPromise(response.data);

        if(!this.title)
        {
            this.title = json.rss.channel[0].title[0];

            const pictureLink = json.rss.channel[0].image[0].url[0];

            await this.download(pictureLink, `podcast-${this.id}-image`);
        } 

		const guid = json.rss.channel[0].item[0].guid[0]._;

		if (guid !== this.lastPlayedGuid) {

            log.debug("New Podcast", this.title);

			this.lastPlayedGuid = guid;

			if(skipPlaying)
			{
				return;
			}

			const url = json.rss.channel[0].item[0].enclosure[0].$.url;

            log.debug("Downloading Podcast", this.title, url);

			await this.download(url, `podcast-${this.id}.mp3`);

            log.debug("Downloaded/Playing Podcast", this.title);

            const description = json.rss.channel[0].item[0].title[0];

            this.notifier.notify(
                {
                    title: this.title,
                    message: `Now playing ${description}`,
                    icon: `podcast-${this.id}-image`,
                    actions: ['OK', 'Skip']
                }
            );

			await this.playPodcast();

            log.debug("Played Podcast", this.title);
        }
    }

    download(url, filename) {
        return new Promise(async (resolve, error) => {
            try
            {
                const download = await axios({
                    method: "get",
                    url,
                    responseType: "stream",
                });
    
                const stream = download.data.pipe(fs.createWriteStream(filename));
    
                stream.on("finish", () => resolve());
                stream.on("error", (err) => error(err));
            }
            catch(err)
            {
                error(err);
            }
        });
    }

    playPodcast() {
        if(this.audio.player) return;

        return new Promise((resolve, error) => {
            this.audio.player = player.play(`podcast-${this.id}.mp3`, (err) => {
                this.audio.player = null;
                if(err) error(err);
                else resolve();
            });
        });
    }
}

module.exports = Podcast;