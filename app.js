const fs = require('fs');
//const puppeteer = require('puppeteer');
const puppeteer = require('puppeteer-extra')
const pluginStealth = require('puppeteer-extra-plugin-stealth')
const { executablePath } = require('puppeteer');

const cheerio = require('cheerio');

const path = require('path');
const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server)
const diffdom = require('diff-dom');
var dd = new diffdom.DiffDOM();
const {
    setupSocketEvents
} = require('./components/setupSocketEvents')
const {
    setupChangeListeners
} = require('./components/setupPuppeteerChangeListeners')
const {
    CACHED_RESOURCES_DIR,
    BASE_URL,
    CONTENT_URL,
    PORT,
} = require('./config.js');

const {
    stripCssComments,
    sleep,
    getHashedFileName,
    toAbsoluteUrl
} = require('./components/utils.js')
const {
    getMainAndIframesWithoutScripts,
    processHtmlContent
} = require('./components/resourceProcessing')

//setup puppeteer stealth instead of normal puppeteer to support more sites.
puppeteer.use(pluginStealth());


app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'domdiffer.html'));
});
app.get('/iframeScript.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'iframeScript.html'));
});
app.get('/domdiffer.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'domdiffer.js'));
});
app.get('/domdifferscript.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'domdifferscript.js'));
});
app.get('/getContent', (req, res) => {
    //this getContent function tries to get the hashed url from the cashed resources
    // and will download the resource if it isn't found
    const url = decodeURIComponent(req.query.url);
    const filepath = path.join(CACHED_RESOURCES_DIR, url);
    //check if already exists
    if (fs.existsSync(filepath)) {
        var data = JSON.parse(fs.readFileSync(filepath));
        //returns the specified file and content type if found
        res.setHeader('Content-Type', data.mime);
        if (!data.mime.startsWith('text/')) {
            // Convert base64 back to buffer for non-textual content
            res.send(Buffer.from(data.data, 'base64'));
        } else {
            res.send(data.data);
        }
    } else {
        res.status(404).send('File not found');
    }
});

// Ensure required directories exist
[CACHED_RESOURCES_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
    }
});

//on client connection
io.on('connection', async (socket) => {
    //start a puppeteer browser
    var puppet = await puppeteer.launch({
        headless: false,
        executablePath: executablePath(),
        args: [
            '--disable-web-security',
            '--disable-features=IsolateOrigins,site-per-process'
        ]
    });
    //close the puppeteer browser when disconnecting
    socket.on('disconnect', async () => {
        try {
            await puppet.close();
        } catch (error) {
            console.log(error);
        }

    });
    const page = await puppet.newPage();
    await page.setViewport({ width: 1366, height: 768 });

    //sets up all socket events except for disconnect function
    await setupSocketEvents(socket, page);

    //sets up change listener code inside the puppeteer window
    //This is to listen on input changes directly instead of waiting for the main loop
    await setupChangeListeners(socket, page);

    page.goto(BASE_URL);

    //await sleep(2000);

    //variables needed in main loop
    var oldhead = '<head></head>';
    var oldbodydiv = '<body></body>';

    var oldiframes = [];
    var previousResult = null;

    //main loop, still needs to be refactored
    while (socket.connected) {

        var data = await getMainAndIframesWithoutScripts(page);
        if (!data) {
            continue;
        }
        //var currentResult = data;
        const $ = cheerio.load(data.mainhtml);

        let newhead = $('head').first().prop('outerHTML');
        let newbodydiv = $('body').first().prop('outerHTML');

        // if (previousResult) {
        //     const changes = [];
        //     // Check main page input changes
        //     for (let input of currentResult.mainInputs) {
        //         const previousInput = previousResult.mainInputs.find(p => p.csspath === input.csspath);
        //         if (previousInput && previousInput.value !== input.value) {
        //             changes.push({
        //                 csspath: input.csspath,
        //                 oldValue: previousInput.value,
        //                 newValue: input.value
        //             });
        //         }
        //     }
        //     // // Check iframe input changes
        //     // for (let iframe of currentResult.iframes) {
        //     //     for (let input of iframe.iframeInputs) {
        //     //         const matchingIframe = previousResult.iframes.find(pIframe => pIframe.selector === iframe.selector);
        //     //         if (matchingIframe) {
        //     //             const previousInput = matchingIframe.iframeInputs.find(p => p.csspath === input.csspath);
        //     //             if (previousInput && previousInput.value !== input.value) {
        //     //                 changes.push({
        //     //                     iframe: iframe.selector,
        //     //                     csspath: input.csspath,
        //     //                     oldValue: previousInput.value,
        //     //                     newValue: input.value
        //     //                 });
        //     //             }
        //     //         }
        //     //     }
        //     // }
        //     // If there are any changes, add them to the allChanges array
        //     // if (changes.length > 0) {
        //     //     socket.emit('maininputs', changes);
        //     // }
        // }
        // Update the previousResult for the next iteration
        //previousResult = data;

        let changes = {};
        if (oldhead != newhead) {
            var oldNode = diffdom.stringToObj(oldhead);
            var newNode = diffdom.stringToObj(newhead);
            oldhead = newhead;
            var diff = dd.diff(oldNode, newNode);
            if (!changes.main) {
                changes.main = {};
            }
            changes.main.head = RemoveInvalidAttributesFromDiff(diff);
            //res.send(JSON.stringify({difference: }))
            console.log('htmlhead changed');
        }
        if (oldbodydiv != newbodydiv) {
            var oldNode = diffdom.stringToObj(oldbodydiv);
            var newNode = diffdom.stringToObj(newbodydiv);
            oldbodydiv = newbodydiv;

            var diff = dd.diff(oldNode, newNode);
            if (!changes.main) {
                changes.main = {};
            }
            changes.main.bodydiv = RemoveInvalidAttributesFromDiff(diff);

            //res.send(JSON.stringify({difference: }))
            console.log('htmldivbody changed');
        }

        if (!changes.iframes) {
            changes.iframes = [];
        }
        data.iframes.forEach(iframe => {
            if (!oldiframes.some(item => item.selector == iframe.selector)) {
                oldiframes.push({ selector: iframe.selector, oldhead: '<head></head>', oldbodydiv: '<body></body>' });
            }
            var newIframe = { selector: iframe.selector };
            var oldiframe = oldiframes.find(item => item.selector == iframe.selector);
            const $ = cheerio.load(iframe.content);
            let newhead = $('head').first().prop('outerHTML');
            let newbodydiv = '<body>' + $('body').first().prop('innerHTML') + '</body>';

            if (oldiframe.oldhead != newhead) {
                var oldNode = diffdom.stringToObj(oldiframe.oldhead);
                var newNode = diffdom.stringToObj(newhead);
                oldiframe.oldhead = newhead;
                var diff = dd.diff(oldNode, newNode);
                newIframe.head = RemoveInvalidAttributesFromDiff(diff);

                console.log('htmlhead changed');
            }
            if (oldiframe.oldbodydiv != newbodydiv) {
                var oldNode = diffdom.stringToObj(oldiframe.oldbodydiv);
                var newNode = diffdom.stringToObj(newbodydiv);
                oldiframe.oldbodydiv = newbodydiv;

                var diff = dd.diff(oldNode, newNode);
                newIframe.bodydiv = RemoveInvalidAttributesFromDiff(diff);
                console.log('htmldivbody changed');
            }

            if (newIframe.head || newIframe.bodydiv) {
                changes.iframes.push(newIframe);
                console.log(`iframe with id ${iframe.selector} changed!`);
            }

        });
        if (changes.main || changes.iframes.length > 0) {
            socket.emit('domchanges', changes);
        }
    }
});



//selects text on page




//removes invalid attributes from diffDOM diff object, enable when you run into trouble with some site.
function RemoveInvalidAttributesFromDiff(diffobj) {
    return diffobj;
    try {
        const data = diffobj;//JSON.parse(jsonString);
        // Recursive function to traverse the JSON
        function traverse(obj) {
            if (typeof obj === 'object' && obj !== null) {
                if (obj.hasOwnProperty('attributes')) {

                    //console.log('Found attributes:', obj.attributes);
                    const regex = /^[a-zA-Z][a-zA-Z0-9-_]*$/;
                    // Iterate through the attributes object's keys
                    for (const key in obj.attributes) {
                        if (!regex.test(key)) {
                            delete obj.attributes[key];
                        }
                        // Place conditions here to check keys/values
                        // Example: 
                        // if (key === 'specificKey' || obj.attributes[key] === 'specificValue') {
                        //     delete obj.attributes[key];
                        // }
                    }
                }
                // Continue traversal
                for (const key in obj) {
                    traverse(obj[key]);
                }
            }
        }
        traverse(data);

        return data;
        // Optionally, save the modified JSON back to a file
        return JSON.stringify(data);
        const updatedJsonString = JSON.stringify(data, null, 2);
        fs.writeFile('diffdomjsonUpdated.json', updatedJsonString, (err) => {
            if (err) console.error('Error writing to file', err);
        });

    } catch (err) {
        console.error('Error parsing the JSON:', err);
    }
}



server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
})
