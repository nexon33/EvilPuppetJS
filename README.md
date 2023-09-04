# EvilPuppet

**DISCLAIMER: EvilPuppet is for educational and research purposes only. Do not use this tool for illegal activities. The author is not responsible for any misuse of this tool.**

## Overview

EvilPuppet is a proof-of-concept man-in-the-middle tool that uses Puppeteer in the background to capture and stream HTML content to a target browser. More than just streaming, it provides an interface that allows the target browser to remotely control the Puppeteer browser instance, simulating a real user's actions.

## Features

- Stream Puppeteer controlled web content to target browsers.
- Allow remote control of the Puppeteer browser instance from the target browser.
- Simulate real user behaviors like clicking, scrolling, and typing.

## Prerequisites

- Node.js

## Installation

1. Clone the repository:
```bash
git clone https://github.com/nexon33/EvilPuppetJS.git
```
2. Navigate into the directory:
```bash
cd EvilPuppetJS
```
3. Install the dependencies
```bash
npm install
```

## Usage

1. Set config inside config.js

2. Start the server:
```bash
node app.js
```

## Known problems

 - Syncing the textfields between the browsers can be improved

 - Many other things too much to list for now.

## TODO

 - Make use of MutationObserver instead of a loop to detect changes. (Maybe getting rid of diffDOM?)

 - Improve syncing between text fields.
 
 - Further improve typing 

 - Add support for copy/paste and autofill

 - Complete refactoring the code and convert it to typescript.

 - Add mouse hover and drag.

 - fix the cssparser and html parser to make it more robust in edgecases. Especially get rid of regex.

## Safety and Responsibility
This tool is powerful and can be misused. Always get proper permissions before conducting any testing. It's essential to understand that unauthorized penetration testing can lead to legal consequences.

## Contribution
Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

## License
This project is licensed under the MIT License - see the LICENSE.md file for details.


## Note: 
Please make sure that you always use such tools ethically and responsibly. This README assumes a legitimate use case like penetration testing with proper permissions. Always obtain permission before testing on any system or network.
