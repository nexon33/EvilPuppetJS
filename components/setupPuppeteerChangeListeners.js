
//this will inject javascript code inside the puppeteer window, the reason we do this is because
//we can get typed changes immediately and send them through sockets so that the text input is more in sync.
async function setupChangeListeners(socket, page) {
    // Expose a function to be called from the page context
    await page.exposeFunction('onElementChanged', (csspath, value, selectionStart, selectionEnd) => {
        console.log(`${csspath} changed to:`, value);
        socket.emit('inputchange',
            {
                csspath: csspath,
                value: value,
                selectionStart: selectionStart,
                selectionEnd: selectionEnd
            }
        );
    });

    // Function to attach event listeners to input and textarea elements
    const attachChangeListeners = async () => {
        try {
            await page.evaluate(() => {
                // Check if listeners are already attached to prevent multiple event listeners
                if (!window.changeListenersAttached) {
                    function getCssPath(el) {
                        if (!(el instanceof Element))
                            return;
                        var path = [];
                        while (el.nodeType === Node.ELEMENT_NODE) {
                            var selector = el.nodeName.toLowerCase();
                            if (el.id) {
                                selector += '#' + el.id;
                                path.unshift(selector);
                                break;
                            } else {
                                var sib = el, nth = 1;
                                while (sib = sib.previousElementSibling) {
                                    if (sib.nodeName.toLowerCase() == selector)
                                        nth++;
                                }
                                if (nth != 1)
                                    selector += ":nth-of-type(" + nth + ")";
                            }
                            path.unshift(selector);
                            el = el.parentNode;
                        }
                        return path.join(" > ");
                    }
                    document.documentElement.addEventListener('input', (event) => {
                        const tag = event.target.tagName.toLowerCase();
                        if (tag === 'input' || tag === 'textarea') {
                            window.onElementChanged(getCssPath(event.target), event.target.value, event.target.selectionStart, event.target.selectionEnd);
                        }
                    });

                    // Mark that the listeners have been attached
                    window.changeListenersAttached = true;
                }
            });
        } catch (error) {
            console.log(error);
        }

    };

    // Attach listeners after every navigation
    page.on('framenavigated', attachChangeListeners);
}

module.exports = {
    setupChangeListeners
}