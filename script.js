'use strict'
/**
 * Script for Spotify integration and YouTube video search.
 * 
 * This script will authenticate the user with Spotify, fetch their liked songs, 
 * and display a YouTube video for each song.
 */

//Import the API keys from the config.js file.
import CONFIG from './config.js';

// Create a new <script> element
const tag = document.createElement('script');

// Set the 'src' attribute of the new <script> element to the URL of the YouTube IFrame API
tag.src = "https://www.youtube.com/iframe_api";

// Get the first <script> element on the page
const firstScriptTag = document.getElementsByTagName('script')[0];

// Insert the new <script> element before the first <script> element on the page
// This ensures that the YouTube IFrame API script is loaded before any other script on the page
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

// Declare a variable named 'currentPlayingPlayer' and initialize it with the value 'null'
// This variable will likely be used to store a reference to the currently playing YouTube player
let currentPlayingPlayer = null;


//spotify credentials
const clientId = CONFIG.SPOTIFY_CLIENT_ID;
const clientSecret = CONFIG.SPOTIFY_CLIENT_SECRET;
const redirectUri = CONFIG.REDIRECT_URI;

//YouTube API key
const apiKey = CONFIG.YOUTUBE_API_KEY;

//Array initialised keep track of all songs to enable easy search
let allSongs = [];

// Search input const
const searchField = document.getElementById('songSearch');

/*
*-Variables to keep track of the pages' URLs
*-Keep the count of the pages 
*--Also keep an array that will contain the particular songs in a given page
*this works by popping and pushing whereby if a user clicks next, the song videos in that
*will be removed and another 12 song videos are added, without having to load another page
*/
const SONGS_PER_PAGE = 12; // Number of songs displayed per page. Adjust as needed.
let currentPage = 0; // Start from the first page
let nextPageUrl = null;
let prevPageUrl = null;
let pages = []; // Will contain the paginated songs

//---------SPOTIFY LOGIC------

// Function to redirect to Spotify Authentication page
function redirectToSpotifyAuth() {
  const scopes = encodeURIComponent('user-library-read');
  const authUrl = `https://accounts.spotify.com/authorize?response_type=code&client_id=${clientId}&scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUri)}`;
  sessionStorage.setItem('attempting-auth', 'true');
  window.location = authUrl;
};

// Function to retrieve access token from Spotify
async function getAccessToken(code) {
  const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': 'Basic ' + btoa(`${clientId}:${clientSecret}`)
      },
      body: new URLSearchParams({
          'grant_type': 'authorization_code',
          'code': code,
          'redirect_uri': redirectUri
      })
  });

  if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
  } else {
      const data = await response.json();
      const expiresIn = data.expires_in; // This gives the number of seconds until the token expires
      const expiryTime = new Date().getTime() + expiresIn * 1000; // Convert to milliseconds and add to current time
      sessionStorage.setItem('spotify_access_token_expiry', expiryTime);
      sessionStorage.setItem('spotify_access_token', data.access_token);
      return data.access_token;
  };
}


/*
*Function to retrieve liked songs from Spotify
*Fetches them in page batches
*/ 
async function getLikedSongs(accessToken, url = 'https://api.spotify.com/v1/me/tracks?limit=50') {
    let allTracks = [];
    let continueFetching = true;

    while (continueFetching) {
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        const data = await response.json();

        let tracks = data.items.map(item => item.track);
        allTracks.push(...tracks);

        // Check if there's a next page
        if (data.next) {
            url = data.next;
        } else {
            continueFetching = false;
        }
    };

    return allTracks;
};


// Function to retrieve user profile from Spotify
async function getUserProfile(accessToken) {
  const response = await fetch('https://api.spotify.com/v1/me', {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  } else {
    const data = await response.json();

    // Using optional chaining in case the images array is empty
    const imageUrl = data.images[0]?.url;
    return { ...data, imageUrl };
  };
};



//-----------YOUTUBE LOGIC-------------

// Function to search YouTube and return first video ID
async function searchYoutube(songName, artistName) {
  const cacheKey = `${songName}-${artistName}`;
  const cachedResult = localStorage.getItem(cacheKey);

  // If result is cached, return it
  if (cachedResult) {
    return cachedResult;
  };

  // Otherwise, fetch data from YouTube API
  const query = encodeURIComponent(`${songName} ${artistName} official music video`);
  const response = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=1&videoEmbeddable=true&regionCode=US&type=video&q=${query}&key=${apiKey}`);
  const data = await response.json();

  const videoId = data.items[0].id.videoId;
  localStorage.setItem(cacheKey, videoId);
  return videoId;
};


// Function to display songs and their corresponding YouTube links on webpage
function displaySongs(songs, youtubeLinks) {
  const list = document.getElementById('song-list');

  songs.forEach((song, i) => {
    const listItem = document.createElement('li');
    listItem.className = 'card';

    // Create a container for the YouTube embed
    const youtubeEmbedContainer = document.createElement('div');
    youtubeEmbedContainer.className = 'card_video';

    // Create a div to hold the YouTube player
    const youtubeEmbedDiv = document.createElement('div');
    youtubeEmbedDiv.id = `player-${i}`;
    youtubeEmbedContainer.appendChild(youtubeEmbedDiv);

    listItem.appendChild(youtubeEmbedContainer);

    // Create a paragraph for the song info(artist and song name)
    const songInfo = document.createElement('p');
    songInfo.className = 'card_info';
    songInfo.textContent = `${song.name} by ${song.artists[0].name}`;

    listItem.appendChild(songInfo);
    list.appendChild(listItem);

    // Initialize the YouTube player with the IFrame Player API
    const player = new YT.Player(`player-${i}`, {
      height: '100%',
      width: '100%',
      videoId: youtubeLinks[i],
      events: {
        'onStateChange': (event) => {
          if (event.data === YT.PlayerState.PLAYING) {
            if (currentPlayingPlayer && currentPlayingPlayer !== event.target) {
              currentPlayingPlayer.pauseVideo();
            }
            currentPlayingPlayer = event.target;
          }
        }
      }
    });
  });
};



//-----COMBINATION OF THE TWO TO MAKE THE MAGIC HAPPEN👀--------


/*
*Function to handle authentication response
*/

async function handleAuthResponse() {
    let accessToken = sessionStorage.getItem('spotify_access_token');

    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');

    try {
        // If there is no access token in the session storage or cookies, but there is a code in the URL, attempt to exchange it for an access token
        if (!accessToken && code) {
            accessToken = await getAccessToken(code);

            // If still no access token after the exchange attempt, throw an error
            if (!accessToken) {
                throw new Error('Failed to exchange code for access token.');
            }
        } else if (!accessToken) {
            // No token and no code in URL, redirect to Spotify authentication
            redirectToSpotifyAuth();
            return;
        }

        // Show loading animation
        document.getElementById('loginSection').style.display = 'none';
        document.getElementById('loadingAnimation').style.display = 'block';

        const userProfile = await getUserProfile(accessToken);
        const songs = await getLikedSongs(accessToken);
        allSongs = songs;
        const youtubeLinks = await Promise.all(songs.map(song => searchYoutube(song.name, song.artists[0].name)));
        

        // Paginate the songs and their corresponding YouTube links
        pages = paginateSongs(songs, youtubeLinks, SONGS_PER_PAGE);

        displayUserProfile(userProfile);
        displayPage(currentPage); // Display the first page
        sessionStorage.setItem('user_authenticated', 'true');

        document.getElementById('loadingAnimation').style.display = 'none';
        document.getElementById('authorizedSection').style.display = 'block';

    } catch (error) {
        console.error(`Error processing authentication or fetching data: ${error}`);

        // Check for token-related error and redirect to Spotify auth if needed
        if (error.message.includes('401') && !code) {
            redirectToSpotifyAuth();
            return;
        }

        document.getElementById('loadingAnimation').style.display = 'none';
        document.getElementById('loginSection').style.display = 'block';
    };
};


/**
 * Splits an array of songs and their corresponding YouTube links into smaller arrays (or "pages") of a specified size.
 * 
 * @param {Array} songs - An array containing all the songs.
 * @param {Array} youtubeLinks - An array containing the YouTube links corresponding to each song.
 * @param {number} perPage - The number of songs (and their YouTube links) you want to have on each page.
 * @return {Array} An array containing the paginated songs and their corresponding YouTube links.
 */
function paginateSongs(songs, youtubeLinks, perPage) {
  // Initialize an empty array to hold the paginated songs and YouTube links.
  const pages = [];
  
  // Iterate through the songs array in steps of 'perPage'.
  for (let i = 0; i < songs.length; i += perPage) {
      
      // Slice out a portion of the songs and youtubeLinks arrays based on the current index and 'perPage'.
      // Then, push this "page" into the pages array.
      pages.push({
          songs: songs.slice(i, i + perPage),
          youtubeLinks: youtubeLinks.slice(i, i + perPage)
      });
  }

  // Return the paginated songs and YouTube links.
  return pages;
}


/**
 * Displays a specific "page" of songs and their corresponding YouTube links on the web page.
 * Also manages the state of the pagination buttons based on the current page being displayed.
 *
 * @param {number} pageIndex - The index of the desired page to be displayed.
 */
function displayPage(pageIndex) {
  // Get a reference to the HTML element with ID 'song-list'. This is where the songs and videos are displayed.
  const list = document.getElementById('song-list');

  // Clear any previously displayed songs and videos from the 'song-list' container.
  list.innerHTML = '';

  // Access the specific "page" of songs and YouTube links from the 'pages' array using the provided 'pageIndex'.
  const page = pages[pageIndex];

  // If the desired page exists, call the 'displaySongs' function to render/display the songs and videos on the web page.
  if (page) {
      displaySongs(page.songs, page.youtubeLinks);
  }

  // Manage the state of the 'prevButton'. Disable it if the current page is the first page.
  document.getElementById('prevButton').disabled = (currentPage === 0);

  // Manage the state of the 'nextButton'. Disable it if the current page is the last page.
  document.getElementById('nextButton').disabled = (currentPage >= pages.length - 1);
}

/**
 * Displays the user's profile information on the web page.
 *
 * @param {Object} userProfile - Object containing user's Spotify profile details.
 */
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

//--------UTILITY FUNCTIONS-----------


/**
 * Shuffles an array using the Fisher-Yates (also known as the Knuth or Durstenfeld) algorithm.
 * The algorithm works by iterating through the array from the end to the beginning. 
 * For each iteration, it randomly selects an index from 0 to the current index (inclusive), 
 * and then swaps the elements at the current index and the randomly selected index.
 *
 * @param {Array} array - The array to shuffle.
 * @return {Array} The shuffled array.
 */
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1)); // Randomly select an index from 0 to i.
    [array[i], array[j]] = [array[j], array[i]]; // Swap the elements at indices i and j.
  }
  return array;
};


// Array of messages
const messages = [
    'Good Taste 😍🤤',
    'Fantastic Playlist 🎧🔥',
    'Vibe High 🙌💃',
    'Music for the Soul 🎶❤️',
    'Keep Jammin 🤘🎸',
    'Rock On 🥁🤩',
    'Smooth Grooves 🎷🎵',
    'You Got The Beat 🎹🎼',
    'Sound Of Happiness 😄🔊',
    'Perfect Harmony 🎤✨',
    'Dance With The Melody 💃🎶',
    'Feel The Rhythm 🕺💥',
    'Sonic Bliss 🎧💞',
    'Soundtrack of Life 🌍🎵',
    'Turn Up The Volume 🎚️🔊',
    'Lost In The Music 🎧🎶',
    'Jazz It Up 🎺💫',
    'Classical Mood 🎻🌟',
    'Pop It Up 🎈🔥',
    'Raise The Bar 🏋️🎼',
    'Hip Hop Non-Stop 🕴️🎵',
    'In The Groove 🌊🎶',
    'Country Vibes 🤠🌾',
    'Rave On 🎇🔊',
    'Heavy Metal 🏋️‍♀️🎸',
    'Breezy Blues 🌬️🎷',
    'Epic Orchestra 🎻🎼',
    'Funky Beats 🕺💥',
    'Reggae Relax 🌴☀️',
    'Punk Power 🤘🔥',
    'Indie Inspirations 💡🎶',
    'Disco Fever 🕺🔥',
    'Soulful Sounds 🎶💗',
    'Sizzling Salsa 💃🌶️',
    'Rhythm & Blues 🎶🎷',
    'Gospel Glory 🌞🎤',
    'Trance Trip 🌀🎵',
    'Bollywood Beats 💃🥁',
    'K-Pop Krazy 🎉🎤',
    'Celtic Charm 🍀🎻',
    'Soothing Symphony 🎵🌙',
    'Vocal Vibrations 🎤🌈',
    'Rockabilly Rumble 🎸🕺',
    'Dubstep Drop 🎧🌪️',
    'Techno Trip 🎵🤖',
    'A Capella Amazing 🎤💫',
    'Reggaeton Rhythm 💃🥁',
    'Psychedelic Sounds 🎵🌈',
    'EDM Energy 🎧💥',
    'Folklore Feel 🎻🌳'
];

shuffleArray(messages);

let index = 0;

// Function to change the message
function changeMessage() {
  const p = document.querySelector('.navbar p');
  p.style.opacity = "0"; // Start the fade out

  setTimeout(() => {
    p.textContent = messages[index]; // Change the text while it's not visible
    p.style.opacity = "1"; // Start the fade in
  }, 1000);

  // Move to the next message, loop back to the start if we've reached the end
  index = (index + 1) % messages.length;
}

// Change the message every 10 seconds
setInterval(changeMessage, 10000);

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



// Function to set the theme based on the user's previous choice (stored in local storage)
function applyInitialTheme() {
  // Retrieve the theme preference stored in local storage
  const storedTheme = localStorage.getItem('theme');

  // If a theme was previously selected and stored, apply it to the body
  if (storedTheme) {
    document.body.classList.add(storedTheme);
  }

  // Check if the current theme is dark mode
  const isDarkMode = document.body.classList.contains('dark-mode');

  // Get references to the login and authorized dark mode toggle buttons
  const darkModeButtonLogin = document.getElementById('darkModeButtonLogin');
  const darkModeButtonAuthorized = document.getElementById('darkModeButtonAuthorized');

  // Adjust button styles and content based on the current theme
  if (isDarkMode) {
    // For dark mode, change button content to a sun icon (indicating switch to light mode)
    darkModeButtonLogin.innerHTML = '<i class="fas fa-sun"></i> ';
    // Set the button styles appropriate for dark mode
    darkModeButtonLogin.style.color = '#fff';
    darkModeButtonLogin.style.backgroundColor = 'rgba(4, 4, 4)';
    darkModeButtonLogin.style.border = 'none';
    
    // Do the same for the authorized dark mode button
    darkModeButtonAuthorized.innerHTML = '<i class="fas fa-sun"></i> ';
    darkModeButtonAuthorized.style.color = '#fff';
    darkModeButtonAuthorized.style.backgroundColor = 'rgba(4, 4, 4)';
    darkModeButtonAuthorized.style.border = 'none';
  } 
  // If it's light mode
  else {
    // Change button content to a moon icon (indicating switch to dark mode)
    darkModeButtonLogin.innerHTML = '<i class="fas fa-moon"></i>';
    // Set the button styles appropriate for light mode
    darkModeButtonLogin.style.color = '#000';
    darkModeButtonLogin.style.backgroundColor = '#ece7e7';
    darkModeButtonLogin.style.border = 'none';
    
    // Do the same for the authorized dark mode button
    darkModeButtonAuthorized.innerHTML = '<i class="fas fa-moon"></i>';
    darkModeButtonAuthorized.style.color = '#000';
    darkModeButtonAuthorized.style.backgroundColor = '#ece7e7';
    darkModeButtonAuthorized.style.border = 'none';
  };
};


//---------EVENT LISTENERS----------

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

//Event listeners to toggle between dark mode and light mode
document.getElementById('darkModeButtonLogin').addEventListener('click', toggleDarkMode);
document.getElementById('darkModeButtonAuthorized').addEventListener('click', toggleDarkMode);

// Event listener that fires when the document has been completely loaded and parsed
document.addEventListener('DOMContentLoaded', function() {
  // Set the theme based on the user's previous choice (stored in local storage)
  applyInitialTheme();

  // Retrieve access token and other related data from session storage
  const accessToken = sessionStorage.getItem('spotify_access_token');
  const code = new URLSearchParams(window.location.search).get('code');
  const attemptingAuth = sessionStorage.getItem('attempting-auth');
  const userAuthenticated = sessionStorage.getItem('user_authenticated'); // Get the user's authentication status

  // Fetch the current timestamp and the token's expiry timestamp for comparison
  const currentTimestamp = new Date().getTime();
  const tokenExpiryTimestamp = sessionStorage.getItem('spotify_access_token_expiry');
  
  // If the user was authenticated in a previous session, proceed to handle their data fetching
  if (userAuthenticated === 'true') {
      handleAuthResponse();
      return;
  }
  
  // If there's an access token but it's expired (or close to expiring), redirect to Spotify for re-authentication
  if (accessToken && (!tokenExpiryTimestamp || currentTimestamp > tokenExpiryTimestamp)) {
      console.log("Redirecting to Spotify for authentication...");  // Debugging statement
      redirectToSpotifyAuth();
      return;
  }

  // If there's a code in the URL and the app is attempting to authenticate, handle the authentication response
  if (code && attemptingAuth) {
      handleAuthResponse();
      // Remove the 'attempting-auth' flag from session storage after authentication is handled
      sessionStorage.removeItem('attempting-auth');
      // Clear the URL parameters to keep the address clean
      history.replaceState(null, null, window.location.pathname);
  }

  // Add an event listener to the login button to trigger Spotify authentication when clicked
  document.getElementById('loginButton').addEventListener('click', function() {
      if (!accessToken) {
          redirectToSpotifyAuth();
      }
  });
});

//Event listener for the next button.
document.getElementById('nextButton').addEventListener('click', function() {
  if (currentPage < pages.length - 1) {
      currentPage++;
      displayPage(currentPage);
      window.scrollTo(0, 0); // Scroll to the top of the page after clicking next
  }
});

//Event listener for the previous button.
document.getElementById('prevButton').addEventListener('click', function() {
  if (currentPage > 0) {
      currentPage--;
      displayPage(currentPage);
      window.scrollTo(0, 0); // Scroll to the top of the page after clicking previous
  }
});

//Event listener for the logout button.
const logoutButton = document.getElementById('logoutButton');
logoutButton.addEventListener('click', function() {
    // Clear the access token, expiry, and authentication state from session storage
    sessionStorage.removeItem('spotify_access_token');
    sessionStorage.removeItem('spotify_access_token_expiry');
    sessionStorage.removeItem('user_authenticated');
});


//--------SCRIPT WRITTEN BY GUCHU KELVIN WITH ❤️-----------