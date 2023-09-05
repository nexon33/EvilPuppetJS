
//used to select text on a puppeteer page
async function SelectOnPage(selection, page) {

    await page.evaluate((selection) => {
        // Utility function to get a node from a path
        function getNodeByCssPath(path) {
            return document.querySelector(path);
        }
        function getNodeFromRelativePath(rootElement, relativePath) {
            if (!relativePath || !rootElement) {
                return null;
            }
            const steps = relativePath.split('/');
            let currentNode = rootElement;
            for (const step of steps) {
                const [nodeType, index] = step.split(':').map(Number);
                if (!currentNode.childNodes[index] || currentNode.childNodes[index].nodeType !== nodeType) {
                    return null;
                }
                currentNode = currentNode.childNodes[index];
            }
            return currentNode;
        }

        const startNodeParentElement = getNodeByCssPath(selection.startCssPath);
        const endNodeParentElement = getNodeByCssPath(selection.endCssPath);
        var startNode;
        var endNode;
        if (selection.startNodePath && selection.endNodePath) {
            startNode = getNodeFromRelativePath(startNodeParentElement, selection.startNodePath);
            endNode = getNodeFromRelativePath(endNodeParentElement, selection.endNodePath);
        }
        else {
            startNode = startNodeParentElement;
            endNode = endNodeParentElement;
        }

        const range = document.createRange();
        range.setStart(startNode, selection.startOffset);
        range.setEnd(endNode, selection.endOffset);

        const newSelection = window.getSelection();
        newSelection.removeAllRanges();
        newSelection.addRange(range);

    }, selection);
}

async function setupSocketEvents(socket, page) {
    //clicks on page
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
        //when selection has changed mirror this
        try {
            if (selection.startCssPath == selection.endCssPath) {
                await page.evaluate((selec) => {
                    const inputElement = document.querySelector(selec.startCssPath);
                    inputElement.selectionStart = selec.startOffset;
                    inputElement.selectionEnd = selec.endOffset;
                }, selection);
            } else {
                await SelectOnPage(selection, page);
            }
        } catch (error) {
            console.log(error);
        }

    });
    //process keypress events, these contain some custom named events
    //this code is more complicated than it should be but this is to account for different keyboard layouts.
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
            //do a sendcharacter if just pressing the key causes an error.
            //this probably mostly occurs on other keyboard layouts.
            await page.keyboard.sendCharacter(keyinfo.name);
            console.log(error.message);
        }

    });

}

module.exports = {
    setupSocketEvents
}

