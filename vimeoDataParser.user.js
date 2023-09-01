// ==UserScript==
// @name         vimeo Data Parser
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  try to take over the world!
// @author       panda
// @match        https://player.vimeo.com/video/*
// @match        https://vimeo.com/showcase/*
// @grant        none
// @run-at document-end
// ==/UserScript==

const SCRIPT_NAME = 'vimeo Data Parser';
const fetchOpt = {mode: 'cors', credentials: "include"};

const parseConfig = async config => {
    const files = config.request.files;

    const isVertical = config.video.width < config.video.height;
    let resolutionList = {};
    const setResoList = (key, data) => {
        if(data == null) {
            return getResoList(key);
        } else {
            data.resolution = key;
            resolutionList[key] = data;
            return data;
        }
    };
    const getResoList = key => {
        if(resolutionList[key] != null) {
            return resolutionList[key];
        } else {
            const resoInt = parseInt(key);
            for(let data of Object.values(resolutionList)) {
                const bb = (resoInt / (isVertical ? data.width : data.height));
                const bh = (isVertical ? data.height : data.width) * bb;
                if(bh % 1 == 0) {
                    return setResoList(key, {width: data.width * bb, height: data.height * bb});
                }
            }
        }
    };

    let streamingData = {video: [], audio: []};
    let dashBaseUrl = null;
    if(files.dash != null) {
        const dashUrl = files.dash.cdns[files.dash.default_cdn].url;
        dashBaseUrl = dashUrl.split('video/')[0];
        if(dashBaseUrl.slice(-4) == 'sep/') dashBaseUrl = dashBaseUrl.slice(0, -4);
        dashBaseUrl = dashBaseUrl + 'parcel/';
        const json = await (await fetch(dashUrl)).json();
        streamingData.json = json;

        streamingData.video = (json.video || []).map(data => {
            const resolution = `${isVertical ? data.width : data.height}p`;
            setResoList(resolution, {width: data.width, height: data.height});
            return {
                id: data.id,
                bitrate: data.bitrate,
                avg_bitrate: data.avg_bitrate,
                codecs: data.codecs,
                duration: data.duration,
                //height: data.height,
                //width: data.width,
                type: data.mime_type,

                url: `${dashBaseUrl}video/${data.id}.${data.mime_type.split('/')[1]}`,
                resolution: resolution,
            };
        });

        streamingData.audio = (json.audio || []).map(data => {
            return {
                id: data.id,
                bitrate: data.bitrate,
                avg_bitrate: data.avg_bitrate,
                codecs: data.codecs,
                duration: data.duration,
                channels: data.channels,
                sample_rate: data.sample_rate,

                url: `${dashBaseUrl}audio/${data.id}.${data.mime_type.split('/')[1]}`,
            };
        });
    }

    const progressive = (files.progressive || []).map(data => {
        setResoList(data.quality, null);

        return {
            url: data.url,
            resolution: data.quality,
        };
    });

    return {
        _test: config,
        _json: streamingData.json,
        user: config.video.owner.name,
        title: config.video.title,
        thumbs: config.video.thumbs,
        thumb_preview: config.request.thumb_preview,
        duration: config.video.duration,
        date: config.seo.upload_date,
        share_url: config.video.share_url,
        progressive: progressive,
        //_progressive: (files.progressive || []).reduce((obj, data) => {
        //    obj[data.quality] = data.url;
        //    return obj;
        //}, {}),
        streaming_video: streamingData.video,
        streaming_audio: streamingData.audio,
        //_streaming: (files.dash?.streams || []).reduce((obj, data) => {
        //    obj[data.quality] = `${dashBaseUrl}video/${data.id.split('-')[0]}.mp4`;
        //    return obj;
        //}, {}),
        isVertical: isVertical,
        resolutionList: resolutionList,
    };
};

(async () => {
    'use strict';
    let data = null;
    if(location.host.includes('player')) {
        data = {
            name: SCRIPT_NAME,
            type: 'player',
            data: await parseConfig(window.playerConfig),
        };
    } else {
        const appData = JSON.parse(document.getElementById('app-data')?.innerText);

        data = {
            name: SCRIPT_NAME,
            type: appData.playlist_data.type,
            title: appData.playlist_data.title,
            length: appData.playlist_data.total,
            data: [],
        };

        for(const clip of appData.clips) {
            let res = await fetch(clip.config, fetchOpt);
            data.data.push(await parseConfig(await res.json()));
        }
    }
    window.top.postMessage(data, '*');
})();