import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import { useState, useEffect } from 'react'

function App() {
  const [urls, setUrls] = useState<{ [key: string]: number }>({});

  useEffect(() => {
    chrome.storage.local.get(['urls'], (result) => {
      setUrls(result.urls || {});
    });
  }, []);
  
  const onclick = async () => {
    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.scripting.executeScript({
      target: {tabId: tab.id!},
      func: () => {
        alert('Hello from the ');
      }
    });
  }

  return (
    <>
      <div>
        <a href="https://vitejs.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Chrome Screen Time</h1>
      <div className="card">
        <button onClick={() => onclick()}>
          Click me
        </button>
        <h2>URLs Hashmap Contents:</h2>
        <ul>
          {Object.entries(urls).map(([url, timeSpent]) => (
            <li key={url}>{url}: {timeSpent} ms</li>
          ))}
        </ul>
      </div>
    </>
  )
}

export default App
