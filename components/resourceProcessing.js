const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');
const fs = require('fs');

const {
    CACHED_RESOURCES_DIR,
    BASE_URL,
    CONTENT_URL,
    PORT,
} = require('../config.js');

const {
    stripCssComments,
    sleep,
    getHashedFileName,
    toAbsoluteUrl,
    trimChar
} = require('./utils.js')


//tries to download a resource and returns the link to the downloaded resource. 
// Will check cache for the resourse first
async function downloadResource(url) {
    if (url.startsWith('data:')) {
        return url;
    }
    let hashedFileName = getHashedFileName(url, '.dat'); // Default to .dat
    const existingFilePath = path.join(CACHED_RESOURCES_DIR, hashedFileName);
    // If the URL is already processed or the file exists, return
    if (fs.existsSync(existingFilePath)) {

        return CONTENT_URL + hashedFileName;
    }
    try {
        const response = await axios.get(url, { responseType: 'arraybuffer' });

        if (!response.data) {
            throw new Error(`No data received for ${url}`);
        }
        //get mime type
        const mimeType = response.headers['content-type'] || 'unknown';

        let dataToWrite = response.data;
        if (mimeType.includes('text/')) {
            let cssContent = Buffer.from(dataToWrite).toString('utf8');
            if (mimeType.includes('/css')) {
                dataToWrite = await replaceCssUrlsAndGetContent(cssContent, url);
            } else if (mimeType.includes('/html')) {
                //dataToWrite = await replaceCssUrlsAndGetContent(cssContent, url);
                dataToWrite = cssContent;
            }
            else {
                dataToWrite = csscontent;
            }
        }
        if (!mimeType.startsWith('text/')) { // if it's not a text type
            dataToWrite = Buffer.from(dataToWrite).toString('base64');
        }
        const file = { mime: mimeType, data: dataToWrite };
        fs.writeFileSync(existingFilePath, JSON.stringify(file));

        return CONTENT_URL + hashedFileName;;
    } catch (err) {
        console.error(`Failed to download ${url}: ${err}`);
        return CONTENT_URL + hashedFileName;
    }
}

//takes in a css string and will download all url declarations inside the css string
async function replaceCssUrlsAndGetContent(csscontent, baseurl) {

    // Updated regex
    const regex = /url\(\s*(?:(["'])(?:(?!\1).)*(?<!\\)\1|[^'"\s)]+?)\s*\)/g;
    const downloadPromises = [];
    //replace all urls with downloadResource url result
    csscontent = csscontent.replace(regex, (match, quote, url) => {
        // If URL is inside quotes, `url` captures it; otherwise, `url` is undefined and the URL is in `match`.
        var actualURL = match.slice(4, -1);
        if (quote) {
            actualURL = trimChar(actualURL, quote);
        }

        try {
            if (actualURL.startsWith('data:')) {
                return match;
            }
        } catch (error) {
            console.log(error);
        }

        const newUrl = toAbsoluteUrl(baseurl, actualURL);
        const hashedfilename = getHashedFileName(newUrl);
        downloadPromises.push(downloadResource(newUrl));

        return `url(${quote || ''}${CONTENT_URL}${hashedfilename}${quote || ''})`;
    });
    await Promise.all(downloadPromises);
    return csscontent;
}

//processes html content which means it basically removes scripts 
//and replaces urls to point to the local cache which contains modified css files etc.
async function processHtmlContent(content, baseurl) {
    const $content = cheerio.load(content);
    $content('script').remove();
    $content('noscript').remove();

    if ($content('base').length > 0) {
        const baseHref = $content('base').attr('href');
        baseurl = baseHref;
        //console.log(baseHref); // Outputs: "https://www.example.com/"
        $content('base').remove();
    }

    $content('*').contents().each(function () {
        const elem = $content(this);
        //remove comments
        if (this.type === 'comment') {
            elem.remove();
        } else {
            const attrs = elem.attr();
            for (let attr in attrs) {
                let attributeValue = elem.attr(attr);
                //removes invalid attributes that are not following html spec and cause errors
                if (attr.includes('[') || attr.includes(']')) {
                    elem.removeAttr(attr);
                } else {
                    attributeValue = attributeValue.replace(/\n/g, '');
                }

            }
        }
    });
    
    //process style tags
    await Promise.all($content('*[style]').map(async (_, element) => {
        let inlineCSS = $content(element).attr('style');
        let newinlineCSS = await replaceCssUrlsAndGetContent(inlineCSS, baseurl);
        //need to replace double quotes with single quotes because double quotes don't load images inside url tags
        $content(element).attr('style', newinlineCSS.replace('"', '\''));
    }).get());
    //process style nodes
    await Promise.all($content('style').map(async (_, element) => {
        let internalCSS = $content(element).text();
        internalCSS = await replaceCssUrlsAndGetContent(internalCSS, baseurl);
        $content(element).text(internalCSS);
    }).get());
    //process image urls
    await Promise.all($content('img').map(async (_, element) => {
        var src = $content(element).attr('src');
        if (src) {
            const href = toAbsoluteUrl(baseurl, src);
            var data = await downloadResource(href);
            $content(element).attr('src', data);
        }

    }).get());
    //processes linked css stylesheets
    await Promise.all($content('link[rel="stylesheet"]').map(async (_, element) => {
        const href = toAbsoluteUrl(baseurl, $content(element).attr('href'));
        var data = await downloadResource(href);
        $content(element).attr('href', data);
    }).get());

    return $content.html();
}

//tries to get the complete html sourcecode of the loaded page, including iframes
async function getMainAndIframesWithoutScripts(page) {
    var limitCounter = 0;
    while (limitCounter < 100) {
        limitCounter++;
        try {
            const iframesWithId = [];

            // async function getInputsAndTextareas(frame) {
            //     return await frame.$$eval('input, textarea', elements => {
            //         return elements.map(el => {
            //             let path = [];
            //             let parent = el;
            //             while (parent) {
            //                 const tagName = parent.tagName.toLowerCase();
            //                 let selector = tagName;
            //                 if (parent.id) {
            //                     selector += `#${parent.id}`;
            //                 }
            //                 path.unshift(selector);
            //                 parent = parent.parentElement;
            //             }
            //             return {
            //                 value: el.value,
            //                 csspath: path.join(' > ')
            //             };
            //         });
            //     });
            // }

            async function processFrame(frame) {
                const iframes = await frame.$$("iframe");

                for (const iframe of iframes) {
                    const iframeFrame = await iframe.contentFrame();
                    if (!iframeFrame) continue;

                    const iframeSelector = await iframe.evaluate(el => {
                        let uniqueId = el.getAttribute('data-temp-iframe-id');
                        if (!uniqueId) {
                            uniqueId = `iframe-${Math.random().toString(36).substr(2, 9)}`;
                            el.setAttribute('data-temp-iframe-id', uniqueId);
                        }
                        return `${uniqueId}`;
                    });

                    let iframeContent = await iframeFrame.evaluate(() => {
                        return document.documentElement.outerHTML;
                    });

                    const iframeURL = await iframeFrame.url();
                    iframeContent = await processHtmlContent(iframeContent, iframeURL);

                    //const iframeInputs = await getInputsAndTextareas(iframeFrame);

                    const iframeobj = {
                        selector: iframeSelector,
                        content: iframeContent,
                        //iframeInputs: iframeInputs
                    };

                    if (!iframesWithId.some(existingIframe => existingIframe.selector === iframeSelector)) {
                        iframesWithId.push(iframeobj);
                    }

                    // Process nested iframes recursively
                    await processFrame(iframeFrame);
                }
            }

            await processFrame(page);

            // Get the main page's URL
            const mainPageURL = await page.url();

            let pageContent = await page.content();

            // Process the main page's content
            pageContent = await processHtmlContent(pageContent, mainPageURL);

            //const mainInputs = await getInputsAndTextareas(page);

            const $ = cheerio.load(pageContent);

            for (const iframe of iframesWithId) {
                var selector = `[data-temp-iframe-id="${iframe.selector}"]`;
                $(selector).attr('src', '/iframeScript.html');
            }

            var resulthtml = $.html();

            return { mainhtml: resulthtml, //mainInputs: mainInputs,
                 iframes: iframesWithId };
        }
        catch (error) {
            console.log(error);
            await sleep(100);
        }
    }

}

module.exports = {
    downloadResource,
    replaceCssUrlsAndGetContent,
    processHtmlContent,
    getMainAndIframesWithoutScripts
}