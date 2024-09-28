chrome.tabs.onActivated.addListener((tabId, tab) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length > 0) {
            let url = tabs[0].url;
            if (url) {
                try {
                    let hostname = new URL(url).hostname;
                    chrome.storage.local.get(['hostnames'], (result) => {
                        let hostnames = result.hostnames || {};
                        if (hostnames[hostname]) {
                            hostnames[hostname]++;
                        } else {
                            hostnames[hostname] = 1;
                        }
                        chrome.storage.local.set({ hostnames }, () => {
                            console.log('Hostname count updated:', hostnames);
                        });
                    });
                } catch (e) {
                    console.error('Invalid URL:', url);
                }
            }
        }
    });
})