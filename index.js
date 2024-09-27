async function sayHello() {
    let [tab] = await chrome.tabs.query({ active: true });
    chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
            alert('Hello, World!');
        }
        }
    );
}
document.getElementById("myButton").addEventListener("click", sayHello);