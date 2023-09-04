const {
    SelectOnPage
} = require('../app')

async function setupSocketEvents(socket, page, puppet) {

    socket.on('click', async (click) => {
        try {
            const element = await page.waitForSelector(click.cssPath);
            await element.click();
            await element.dispose();
        } catch (error) {
            console.log(error);
        }
    });

    socket.on('selectionchange', async (selection) => {
        //console.log('selectionchange');
        try {
            if (selection.startCssPath == selection.endCssPath) {
                await page.evaluate((click) => {
                    const inputElement = document.querySelector(click.startCssPath);
                    inputElement.selectionStart = click.startOffset;
                    inputElement.selectionEnd = click.endOffset;
                }, selection);
            } else {
                await SelectOnPage(selection, page);
            }
        } catch (error) {
            console.log(error);
        }

    });

    socket.on('keypress', async (keyinfo) => {

        try {
            if (keyinfo.name === 'CtrlBackspace') {
                await page.keyboard.down('Control');
                await page.keyboard.press('Backspace');
                await page.keyboard.up('Control');
            }
            else if (keyinfo.name === 'CtrlZ') {
                await page.keyboard.down('Control');
                await page.keyboard.press('z');
                await page.keyboard.up('Control');
            }
            else if (keyinfo.name === 'CtrlY') {
                await page.keyboard.down('Control');
                await page.keyboard.press('y');
                await page.keyboard.up('Control');
            }
            else {
                await page.keyboard.press(keyinfo.name);
            }

        } catch (error) {
            await page.keyboard.sendCharacter(keyinfo.name);
            console.log(error.message);
        }

    });

}

module.exports = {
    setupSocketEvents
}

