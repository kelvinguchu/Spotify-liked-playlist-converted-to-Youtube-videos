# YouTubify.
Based on my experience as a regular Spotify and YouTube user,sometimes I listen to some random music on Spotify when i am on shuffle listening, I end up liking it and adding it to my playlist, over time this accumulates and becomes a very long list of liked tracks. Just as other normal music lovers, I want to see the artist and the music video, and what other better way to do that than using Youtube.

But then searching for each liked song can be very time consuming, and sometimes you have to do a search of the official music videos, that's where it hit me, why not build a software to do all that tasks for me and my work is just to watch the music videos, ad free. I built [YouTubify](https://you-tubify.vercel.app/) to exactly that.

# Usage
For testing and seeing how it works, just click on this link [YouTubify](https://you-tubify.vercel.app/), when you click on the `Login with Spotify` button, it will prompt you to enter your Spotify credentials, this data is not stored anywhere on the server side, only accessible using your browser, and you can logout to delete it from the local storage.

For developers, wishing to see the code and play around with it:

1. Run ```git clone https://github.com/kelvinguchu/Spotify-liked-playlist-converted-to-Youtube-videos.git```
2. When you have the repository on your locally, you need to get the Client ID and Client Secret from the Spotify developers platfrom [here](https://developer.spotify.com/).
3. Also get the YouTube API key from [here](https://console.cloud.google.com/).
4. After acquring the above, you will need to create a `config.js` file to store those keys as secret.
use this format:
 ``` javascript
 const CONFIG = {
    'SPOTIFY_CLIENT_ID': '',
    'SPOTIFY_CLIENT_SECRET': '',
    'YOUTUBE_API_KEY': '',
    'REDIRECT_URI': ''
};

export default CONFIG;
```
5. After that just run it locally on your machine.

**Note:** The redirect URI should be the same, both on your `config.js` file and Spotify developer dashboard.

# Tech Stack
-HTML.
-CSS.
-JavaScript.

# Features
1. Login and user authentication.
2. Logout functionality.
3. Pagination: To reduce the API calls made to the Spotify and YouTube APIs, I added this feature to improve the loading and scroll performance. Also utilise the YouTube quota, because maybe the user wants to view like the recent 5 like songs, there is no need to query for all the liked songs in their playlist. The limit per page is 12.

4. Search functionality: To minimise the time used to search all through the videos manually, a search functionality was necessary. The search can also access the videos even though they aren't displayed in the current page.
The code:
``` javascript
// Search input functionality
const searchField = document.getElementById('songSearch');

// Add an event listener to detect and respond to user input in the search field
searchField.addEventListener('input', async function() {
    // Get the user's query and convert it to lowercase for case-insensitive search
    const query = this.value.toLowerCase();
    
    // Filter the songs based on the user's query
    const filteredSongs = allSongs.filter(song => {
        // Combine song name and artist name, then convert to lowercase for comparison
        const songName = `${song.name} by ${song.artists[0].name}`.toLowerCase();
        // Check if the song's details contain the user's query
        return songName.includes(query);
    });

    // For each filtered song, fetch its corresponding YouTube link
    const youtubeLinks = await Promise.all(filteredSongs.map(song => searchYoutube(song.name, song.artists[0].name)));
    
    // Paginate the filtered songs and their corresponding YouTube links
    pages = paginateSongs(filteredSongs, youtubeLinks, SONGS_PER_PAGE);
    
    // Reset to the first page of results after a search
    currentPage = 0;
    
    // Display the first page of the filtered results
    displayPage(currentPage);
});
```
5. Dark mode support: This is just a matter of preference of the user, it is necessary to have.
Also it is saved to the local storage to ensure that the user doesn't have to reselect again.
The code:
CSS:
``` css
/* 
*Utility class for the dark mode
*Containing all the styles for the dark mode
*/
.dark-mode #logoutButton {
  color: #000;
}

.dark-mode #prevButton:disabled, 
.dark-mode #nextButton:disabled {
  background-color: #bbb;
  cursor: not-allowed;
}

.dark-mode #prevButton, .dark-mode #nextButton {
  background-color: #1DB954;
  color: #000;
}

.dark-mode #prevButton:hover, .dark-mode #nextButton:hover {
  background-color: #1ed760;
  color: #000;
}

body.dark-mode {
  background-color: rgba(4, 4, 4);
  color: #ffffff;
}

.dark-mode .navbar {
  background-color: rgba(4, 4, 4);
  color: #ffffff;
  box-shadow: 0px 5px 5px 0px rgba(30, 215, 96, 0.1);
}

.dark-mode #authorizedSection {
  background-color: rgba(4, 4, 4);
  color: #ffffff;
}

.dark-mode #loginSection {
  background-color: rgba(4, 4, 4);
  color: #ffffff;
  border: 1px solid #1ed760;
}

.dark-mode #loginSection h1,
.dark-mode #loginSection h2 {
  color: #ffffff;
}

.dark-mode #songSearch {
  background-color: rgba(4, 4, 4);
  color: #ffffff;
}

.dark-mode .card {
  background: linear-gradient(135deg, #232323 0%, rgba(4, 4, 4) 100%);
  border: 1px solid #1ed760;
}


.dark-mode #darkModeButton {
  background-color: #ffffff;
  color: #000000;
}

.dark-mode .loader-container {
  background-color: rgba(0, 0, 0, 0.8);
}

.dark-mode .loader {
  border: 8px solid rgba(4, 4, 4);
  border-top: 8px solid #ffffff;
}

.dark-mode .loader::before {
  color: #ffffff;
}

.dark-mode #search {
  background-color: rgba(4, 4, 4);
}
```

JavaScript
``` javascript
// Function to toggle between dark mode and light mode
function toggleDarkMode() {
  // Get a reference to the document body
  const body = document.body;

  // Toggle the 'dark-mode' class on the body. If the class exists, it's removed; if it doesn't, it's added.
  body.classList.toggle('dark-mode');

  // Check if the body now has the 'dark-mode' class
  const isDarkMode = body.classList.contains('dark-mode');

  // If in dark mode
  if (isDarkMode) {
    // Change button content to a sun icon (indicating switch to light mode)
    this.innerHTML = '<i class="fas fa-sun"></i> ';

    // Set the button styles appropriate for dark mode
    this.style.color = '#fff';
    this.style.backgroundColor = 'rgba(4, 4, 4)';
    this.style.border = 'none';

    // Store the current theme mode (dark) in the local storage
    localStorage.setItem('theme', 'dark-mode');
  }
  // If in light mode
  else {
    // Change button content to a moon icon (indicating switch to dark mode)
    this.innerHTML = '<i class="fas fa-moon"></i>';

    // Set the button styles appropriate for light mode
    this.style.color = '#000';
    this.style.backgroundColor = '#ece7e7';
    this.style.border = 'none';

    // Clear the theme mode from local storage (default to light mode)
    localStorage.setItem('theme', '');
  };
};
```
6. User name and profile photo:  Just in case different users use the same device, it is possible to know who is logged in the moment.
The code for it:

``` javascript
function displayUserProfile(userProfile) {
  // Create a new div for the user's profile.
  const userDiv = document.createElement('div');
  userDiv.style.display = 'flex';
  userDiv.style.alignItems = 'center';
  userDiv.style.gap = '10px';

  // Create a span to display the user's name.
  const userName = document.createElement('span');
  userName.textContent = userProfile.display_name;
  userName.style.alignSelf = 'center';
  userDiv.appendChild(userName);

  // If the user has a profile image, display it.
  if (userProfile.imageUrl) {
      const img = document.createElement('img');
      img.src = userProfile.imageUrl;
      img.alt = `${userProfile.display_name}'s profile image`;
      img.style.height = "50px";
      img.style.width = "50px";
      img.style.borderRadius = "50%";
      userDiv.prepend(img);  // Add the image to the beginning of the userDiv.
  };

  // Replace the existing 'userName' element on the page with the new userDiv.
  document.getElementById('userName').replaceWith(userDiv);
};
```

7. Random messages: Though disable on smaller devices, this just to keep the website lively. I used the Fisher Yate's algorithm to randmise their appearance.

# Contributions
Feel free to submit a pull request.
Let's work together!!

# License
[MIT License](https://opensource.org/license/mit/)