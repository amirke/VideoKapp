'use strict';
document.getElementById('launch').addEventListener('click', () => {
  // A custom protocol navigation has no reliable success/failure response.
  // Do not claim success or color it green merely because it was clicked.
  document.getElementById('launch-status').textContent = 'Open request sent. Accept the browser prompt if shown. If nothing opens, see the help below.';
  document.getElementById('help').open = true;
});
