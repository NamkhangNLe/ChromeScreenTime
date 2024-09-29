import { getUrlTimes } from './App.tsx';

getUrlTimes().then((urlTimes) => {
  function processTimes(urlTimes) {
    const hourBreakdown = Array(24).fill(0); // initializes an array with 24 zeros

    for (let url in urlTimes) {
      const time = urlTimes[url];
      const hours = Math.floor(time / (1000 * 60 * 60)); // convert milliseconds to hours
      hourBreakdown[hours] += time;
    }

    return hourBreakdown;
  }

  function displayHourBreakdown(hourBreakdown) {
    const container = document.getElementById('hour-breakdown');
    container.innerHTML = ''; // Clear any existing content

    hourBreakdown.forEach((time, hour) => {
      const div = document.createElement('div');
      div.textContent = `Hour ${hour}: ${time} ms`;
      container.appendChild(div);
    });
  }

  const hourBreakdown = processTimes(urlTimes);
  displayHourBreakdown(hourBreakdown);
}).catch((error) => {
  console.error('Error retrieving URL times:', error);
});