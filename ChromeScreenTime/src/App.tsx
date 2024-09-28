import './App.css'
import { useState, useEffect } from 'react'
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend);

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
        alert('Hello from the interside');
      }
    });
  }

  const data = {
    labels: Object.keys(urls),
    datasets: [
      {
        label: 'Time Spent (ms)',
        data: Object.values(urls),
        backgroundColor: [
          'rgba(255, 99, 132, 0.2)',
          'rgba(54, 162, 235, 0.2)',
          'rgba(255, 206, 86, 0.2)',
          'rgba(75, 192, 192, 0.2)',
          'rgba(153, 102, 255, 0.2)',
          'rgba(255, 159, 64, 0.2)',
        ],
        borderColor: [
          'rgba(255, 99, 132, 1)',
          'rgba(54, 162, 235, 1)',
          'rgba(255, 206, 86, 1)',
          'rgba(75, 192, 192, 1)',
          'rgba(153, 102, 255, 1)',
          'rgba(255, 159, 64, 1)',
        ],
        borderWidth: 1,
      },
    ],
  };

  return (
    <>
    <h1>Chrome Screen Time</h1>
      <div className = "chart-container">
        <Doughnut data={data} />
      </div>
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
