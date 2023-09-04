
const path = require('path');

const CACHED_RESOURCES_DIR = path.resolve('cached_resources');
const BASE_URL = 'https://facebook.com/';
const CONTENT_URL = 'http://localhost:3000/getContent?url=';
const PORT = 3000;

module.exports = {
    CACHED_RESOURCES_DIR,
    BASE_URL,
    CONTENT_URL,
    PORT,
}