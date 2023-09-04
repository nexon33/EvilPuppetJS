
const path = require('path');

const CACHED_RESOURCES_DIR = path.resolve('cached_resources');
const BASE_URL = 'https://google.com/';
const PORT = 3000;

const CONTENT_URL = `http://localhost:${PORT}/getContent?url=`;




module.exports = {
    CACHED_RESOURCES_DIR,
    BASE_URL,
    CONTENT_URL,
    PORT,
}