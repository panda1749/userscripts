// ==UserScript==
// @name         World Family Vimoe Connecter
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  try to take over the world!
// @author       panda
// @match        https://club.world-family.co.jp/*
// @match        https://kidsworld.worldfamily-member.com/*
// @icon         data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==
// @grant        none
// @noframes
// @run-at document-start
// ==/UserScript==

const createDom = ({tagName = 'div', id, text, className = [], style = {}, attr = {}} = {}) => {
    if(typeof className == 'string') className = [className];

    const d = document.createElement(tagName);
    if(typeof text == 'string') d.innerText = text;
    if(typeof id == 'string') d.id = id;

    if(className.length > 0) {
        d.classList.add(...className);
    }

    for(let [key, val] of Object.entries(style)) {
        d.style[key] = val;
    }

    for(let [key, val] of Object.entries(attr)) {
        d.setAttribute(key, val);
    }
    return d;
};

const getDlIcon = () => {
    let icon = document.getElementById('WFVC_dlIcon');
    if(icon != null) return icon;

    icon = createDom({text: 'WFVC', id: 'WFVC_dlIcon', style: {zIndex: '1000'}});

    const list = createDom({id: 'WFVC_list'});
    icon.appendChild(list);

    document.body.appendChild(icon);
    return icon;
};

const getDownloadCommand = data => {
    const r = {
        dl: [], cnv: [], dlType: '',
        imgUrl: data.thumbs.base + '.jpg',
        previewUrl: data.thumb_preview?.url,
        title: `${data.date} - ${data.title} - ${Math.floor(data.duration / 60)}m${data.duration % 60}ss`,
        progressive: data.progressive.sort((a, b) => parseInt(a.resolution) - parseInt(b.resolution)),
        streaming_video: data.streaming_video.sort((a, b) => a.bitrate - b.bitrate),
        streaming_audio: data.streaming_audio.sort((a, b) => a.bitrate - b.bitrate),
    };

    const [LV, LA, LP] = [r.streaming_video.slice(-1)[0], r.streaming_audio.slice(-1)[0], r.progressive.slice(-1)[0]];
    const title = data.title.replaceAll("?", "_").replaceAll("/", "-").replaceAll('"', "'");
    r.dl.push(`curl.exe -L \ "${r.imgUrl}" -o "${title}.jpg"`);
    r.dl.push(`curl.exe -L \ "${r.previewUrl}" -o "${title} preview.jpg"`);

    let outputVideoName = null;
    let scaleSize = null;
    const LVcodecs = LV == null ? '' : `${LV.codecs}_${LV.bitrate/1000}kbs`;
    const LAcodecs = LA == null ? '' : `${LA.codecs}_${LA.bitrate/1000}kbs`;
    if(LP == null || parseInt(LP.resolution) < parseInt(LV.resolution)) {
        r.dlType = 'streaming';
        outputVideoName = `${title} (${LV.resolution} ${LVcodecs} ${LAcodecs}).mp4`;
        r.dl.push(`ffmpeg -hide_banner -i "${LV.url}" -i "${LA.url}" -c copy -map 0:v:0 -map 1:a:0 -map_metadata 0 -map_metadata:s:v 0:s:v -map_metadata:s:a 1:s:a -loglevel info "${outputVideoName}"`);
        scaleSize = data.resolutionList[LV.resolution];
    } else {
        r.dlType = 'progressive';
        outputVideoName = `${title} (${LP.resolution}${parseInt(LP.resolution) == parseInt(LV?.resolution) ? ` ${LVcodecs} ${LAcodecs}` : ''}).mp4`;
        r.dl.push(`curl.exe -L "${LP.url}" -o "${outputVideoName}"`);
        scaleSize = data.resolutionList[LP.resolution];
    }

    if(parseInt(scaleSize.resolution) > 720) scaleSize = data.resolutionList["720p"];

    const v_qp = 35;
    const v_preset = 6;
    const a_b = 96;
    const fillterCmd = `-filter_complex "[0:v]scale=${scaleSize.width}:${scaleSize.height}[v0]; [1:v]scale=${scaleSize.width}:${scaleSize.height}[v1]; [v0][v1]overlay=enable='between(n,0,0)'"`;
    const encodeCmd = `-c:v libsvtav1 -crf ${v_qp} -preset ${v_preset} -c:a libopus -b:a ${a_b}k -pix_fmt yuv420p10le`;
    r.cnv.push(`ffmpeg -hide_banner -i "${outputVideoName}" -i "${title}.jpg" ${fillterCmd} ${encodeCmd} -loglevel info "${title} (${scaleSize.resolution} av1.${v_qp} opus.${a_b}).webm"`);

    return r;
}

const addListItem = (parentDom, r) => {
    const listItem = createDom();
    const img = createDom({tagName: 'img', style: {height: '120px', width: 'auto'}, attr: {src: r.imgUrl}});
    listItem.appendChild(img);

    const preview = createDom({tagName: 'img', style: {height: '120px', width: 'auto'}, attr: {src: r.previewUrl, type: 'image/jpg'}});
    listItem.appendChild(preview);

    const title = createDom({text: r.title});
    listItem.appendChild(title);

    const progList = createDom({text: 'progressive'});
    for(let _d of r.progressive) {
        progList.appendChild(createDom({tagName: 'a', text: _d.resolution, attr: {href: _d.url,}}));
    }
    listItem.appendChild(progList);

    const streVideoList = createDom({text: 'streaming(Video)'});
    for(let _d of r.streaming_video) {
        streVideoList.appendChild(createDom({tagName: 'a', text: _d.resolution, attr: {href: _d.url,}}));
    }
    listItem.appendChild(streVideoList);

    const streAudioList = createDom({text: 'streaming(Audio)'});
    for(let _d of r.streaming_audio) {
        streAudioList.appendChild(createDom({tagName: 'a', text: `${_d.codecs}(${_d.bitrate/1000}kbs)`, attr: {href: _d.url,}}));
    }
    listItem.appendChild(streAudioList);

    const command = createDom({
        tagName: 'textarea',
        style: {width: '100%', height: '5em', border: 'black solid 1px'},
    });

    for (let cmdLine of r.dl) {
        command.value += `${cmdLine} \n`;
    }
    command.value += '\n';
    for (let cmdLine of r.cnv) {
        command.value += `${cmdLine} \n`;
    }

    listItem.appendChild(createDom({text: `PowerShell Cmmand - ${r.dlType}`}));
    listItem.appendChild(command);

    parentDom.appendChild(listItem);

    command.style.height = command.scrollHeight + 'px';
};

const _addListItem = (parentDom, data) => {
    const listItem = createDom();
    const outputImageName = data.thumbs.base + '.jpg';
    const img = createDom({tagName: 'img', style: {height: '120px', width: 'auto'}, attr: {src: outputImageName}});
    listItem.appendChild(img);

    const preview = createDom({tagName: 'img', style: {height: '120px', width: 'auto'}, attr: {src: data.thumb_preview?.url, type: 'image/jpg'}});
    listItem.appendChild(preview);

    const title = createDom({text: `${data.date} - ${data.title} - ${Math.floor(data.duration / 60)}m${data.duration % 60}ss`});
    listItem.appendChild(title);

    let lastProgressiveData = null;
    const progList = createDom({text: 'progressive'});
    for(let _d of data.progressive.sort((a, b) => parseInt(a.resolution) - parseInt(b.resolution))) {
        lastProgressiveData = _d;
        progList.appendChild(createDom({tagName: 'a', text: _d.resolution, attr: {href: _d.url,}}));
    }
    listItem.appendChild(progList);

    let lastVideoData = null;
    const streVideoList = createDom({text: 'streaming(Video)'});
    for(let _d of data.streaming_video.sort((a, b) => a.bitrate - b.bitrate)) {
        lastVideoData = _d;
        streVideoList.appendChild(createDom({tagName: 'a', text: _d.resolution, attr: {href: _d.url,}}));
    }
    listItem.appendChild(streVideoList);

    let lastAudioData = null;
    const streAudioList = createDom({text: 'streaming(Audio)'});
    for(let _d of data.streaming_audio.sort((a, b) => a.bitrate - b.bitrate)) {
        lastAudioData = _d;
        streAudioList.appendChild(createDom({tagName: 'a', text: `${_d.codecs}(${_d.bitrate/1000}kbs)`, attr: {href: _d.url,}}));
    }
    listItem.appendChild(streAudioList);

    const [LV, LA, LP] = [lastVideoData, lastAudioData, lastProgressiveData];
    const command = createDom({
        tagName: 'textarea',
        style: {width: '100%', height: '5em', border: 'black solid 1px'},
    });

    data.title = data.title.replaceAll("?", "_").replaceAll("/", "-").replaceAll('"', "'");
    command.value += `curl.exe -L \ "${data.thumbs.base}.jpg" -o "${data.title}.jpg" \n`;
    command.value += `curl.exe -L \ "${data.thumb_preview?.url}" -o "${data.title} preview.jpg" \n`;


    let commandTitle = 'PowerShell Cmmand - ';
    let outputVideoName = null;
    let scaleSize = null;
    const LVcodecs = LV == null ? '' : `${LV.codecs}_${LV.bitrate/1000}kbs`;
    const LAcodecs = LA == null ? '' : `${LA.codecs}_${LA.bitrate/1000}kbs`;
    if(LP == null || parseInt(LP.resolution) < parseInt(LV.resolution)) {
        commandTitle += 'streaming';
        outputVideoName = `${data.title} (${LV.resolution} ${LVcodecs} ${LAcodecs}).mp4`;
        command.value += `ffmpeg -hide_banner -i "${LV.url}" -i "${LA.url}" -c copy -map 0:v:0 -map 1:a:0 -map_metadata 0 -map_metadata:s:v 0:s:v -map_metadata:s:a 1:s:a -loglevel info "${outputVideoName}" \n`;
        scaleSize = data.resolutionList[LV.resolution];
    } else {
        commandTitle += 'progressive';
        outputVideoName = `${data.title} (${LP.resolution}${parseInt(LP.resolution) == parseInt(LV?.resolution) ? ` ${LVcodecs} ${LAcodecs}` : ''}).mp4`;
        command.value += `curl.exe -L "${LP.url}" -o "${outputVideoName}" \n`;
        scaleSize = data.resolutionList[LP.resolution];
    }

    if(parseInt(scaleSize.resolution) > 720) scaleSize = data.resolutionList["720p"];

    const v_qp = 35;
    const v_preset = 6;
    const a_b = 96;
    const fillterCmd = `-filter_complex "[0:v]scale=${scaleSize.width}:${scaleSize.height}[v0]; [1:v]scale=${scaleSize.width}:${scaleSize.height}[v1]; [v0][v1]overlay=enable='between(n,0,0)'"`;
    const encodeCmd = `-c:v libsvtav1 -crf ${v_qp} -preset ${v_preset} -c:a libopus -b:a ${a_b}k -pix_fmt yuv420p10le`;
    command.value += `ffmpeg -hide_banner -i "${outputVideoName}" -i "${data.title}.jpg" ${fillterCmd} ${encodeCmd} -loglevel info "${data.title} (${scaleSize.resolution} av1.${v_qp} opus.${a_b}).webm" \n`;

    listItem.appendChild(createDom({text: commandTitle}));
    listItem.appendChild(command);

    parentDom.appendChild(listItem);

    command.style.height = command.scrollHeight + 'px';
};

(function() {
    window.addEventListener('message', e => {
        if(e?.data?.name == 'vimeo Data Parser') {
            const data = e.data.data;
            const dlIcon = getDlIcon();
            const list = dlIcon.querySelector('#WFVC_list');
            console.log(e.data);

            if(Array.isArray(data)) {
                const r = getDownloadCommand(data);
                data.forEach(data => addListItem(list, r));
            } else {
                addListItem(list, getDownloadCommand(data));
            }
        }
    });
})();