chrome.tabs.onActivated.addListener((tabId, tab) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        let url = tabs[0].url;
        console.log(url);
    });
})