let activeTabId = null;
let activeTabStartTime = null;

chrome.tabs.onActivated.addListener((activeInfo) => {
    if (activeTabId !== null && activeTabStartTime !== null) {
        // Calculate the time spent on the previous tab
        const timeSpent = Date.now() - activeTabStartTime;
        chrome.tabs.get(activeTabId, (tab) => {
            if (tab && tab.url) {
                const url = new URL(tab.url).hostname;
                chrome.storage.local.get(['urls'], (result) => {
                    let urls = result.urls || {};
                    if (urls[url]) {
                        urls[url] += timeSpent;
                    } else {
                        urls[url] = timeSpent;
                    }
                    chrome.storage.local.set({ urls }, () => {
                        console.log('URL time updated (onActivated):', urls);
                    });
                });
            }
        });
    }

    // Update the active tab and start time
    activeTabId = activeInfo.tabId;
    activeTabStartTime = Date.now();
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (tabId === activeTabId && changeInfo.url) {
        // Tab URL changed, reset the start time
        activeTabStartTime = Date.now();
    }
});

chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
    if (tabId === activeTabId && activeTabStartTime !== null) {
        // Calculate the time spent on the tab being closed in seconds
        const timeSpent = Date.now() - activeTabStartTime;
        chrome.tabs.get(tabId, (tab) => {
            if (tab && tab.url) {
                const url = new URL(tab.url).hostname;
                chrome.storage.local.get(['urls'], (result) => {
                    let urls = result.urls || {};
                    if (urls[url]) {
                        urls[url] += timeSpent;
                    } else {
                        urls[url] = timeSpent;
                    }
                    chrome.storage.local.set({ urls }, () => {
                        console.log('URL time updated (onRemoved):', urls);
                    });
                });
            }
        });
    }
});