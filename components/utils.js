const urlModule = require('url');
const crypto = require('crypto');

function stripCssComments(cssString) {
    return cssString.replace(/\/\*[^*]*\*+([^/*][^*]*\*+)*\//g, '');
}
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function getHashedFileName(url, extension = '.dat') {
    const hash = crypto.createHash('sha256');
    hash.update(url);
    return hash.digest('hex') + extension;
}

function toAbsoluteUrl( baseUrl, relativeUrl) {
    try {
        return urlModule.resolve(baseUrl, relativeUrl);
    } catch (error) {
        console.log(error);
    }
}

function trimChar(string, char) {
    return string.replace(new RegExp(`^${char}+|${char}+$`, 'g'), '');
}

function isValidAttributeName(str) {
    const regex = /^[a-zA-Z][a-zA-Z0-9-_]*$/;
    return regex.test(str);
}
module.exports = {
    stripCssComments,
    sleep,
    getHashedFileName,
    toAbsoluteUrl,
    trimChar,
    isValidAttributeName
}