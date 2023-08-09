'use strict'
/**
 * Script for Spotify integration and YouTube video search.
 * 
 * This script will authenticate the user with Spotify, fetch their liked songs, 
 * and display a YouTube video for each song.
 */

// Constants for Spotify and YouTube APIs
const clientId = '473e1292e9714be2b9defd20feebd4eb';
const clientSecret = 'b58bd34301a9493dbba1a1e36fcd4fe3';
const redirectUri = 'https://you-tubify.vercel.app/';
const apiKey = 'AIzaSyDeby8kdPYzUQawOqFiNRp_UJ34Zmvaag8';
let allSongs = [];

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


// Function to retrieve liked songs from Spotify
let nextPageUrl = null;
let prevPageUrl = null;

async function getLikedSongs(accessToken, url = 'https://api.spotify.com/v1/me/tracks?limit=50') {
    const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    const data = await response.json();

    let tracks = data.items.map(item => item.track);

    // Store the next and previous URLs for pagination
    nextPageUrl = data.next;
    prevPageUrl = data.previous;

    return tracks;
};



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

    // Create the YouTube embed
    const youtubeEmbed = document.createElement('iframe');
    youtubeEmbed.width = "100%";
    youtubeEmbed.height = "100%";
    youtubeEmbed.src = `https://www.youtube.com/embed/${youtubeLinks[i]}`;
    youtubeEmbed.title = "YouTube video player";
    youtubeEmbed.frameborder = "0";
    youtubeEmbed.style.borderRadius = "15px";
    youtubeEmbed.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
    youtubeEmbed.allowFullscreen = true;
    youtubeEmbed.loading = "lazy"; // Enable lazy loading

    youtubeEmbedContainer.appendChild(youtubeEmbed);
    listItem.appendChild(youtubeEmbedContainer);

    // Create a paragraph for the song info
    const songInfo = document.createElement('p');
    songInfo.className = 'card_info';
    songInfo.textContent = `${song.name} by ${song.artists[0].name}`;

    listItem.appendChild(songInfo);
    list.appendChild(listItem);
  });
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

// Function to handle authentication response
const SONGS_PER_PAGE = 12; // Number of songs displayed per page. Adjust as needed.
let currentPage = 0; // Start from the first page
let pages = []; // Will contain the paginated songs

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

function paginateSongs(songs, youtubeLinks, perPage) {
    const pages = [];
    for (let i = 0; i < songs.length; i += perPage) {
        pages.push({
            songs: songs.slice(i, i + perPage),
            youtubeLinks: youtubeLinks.slice(i, i + perPage)
        });
    }
    return pages;
}

function displayPage(pageIndex) {
  const list = document.getElementById('song-list');
  list.innerHTML = ''; // Clear the current songs

  const page = pages[pageIndex];
  if (page) {
      displaySongs(page.songs, page.youtubeLinks);
  }

  // Manage button states
  document.getElementById('prevButton').disabled = (currentPage === 0);
  document.getElementById('nextButton').disabled = (currentPage >= pages.length - 1);
}

document.getElementById('nextButton').addEventListener('click', function() {
  if (currentPage < pages.length - 1) {
      currentPage++;
      displayPage(currentPage);
      window.scrollTo(0, 0); // Scroll to the top of the page
  }
});

document.getElementById('prevButton').addEventListener('click', function() {
  if (currentPage > 0) {
      currentPage--;
      displayPage(currentPage);
      window.scrollTo(0, 0); // Scroll to the top of the page
  }
});


function displayUserProfile(userProfile) {
  const userDiv = document.createElement('div');
  userDiv.style.display = 'flex';
  userDiv.style.alignItems = 'center';
  userDiv.style.gap = '10px';

  const userName = document.createElement('span');
  userName.textContent = userProfile.display_name;
  userName.style.alignSelf = 'center';
  userDiv.appendChild(userName);

  if (userProfile.imageUrl) {
      const img = document.createElement('img');
      img.src = userProfile.imageUrl;
      img.alt = `${userProfile.display_name}'s profile image`;
      img.style.height = "50px";
      img.style.width = "50px";
      img.style.borderRadius = "50%";
      userDiv.prepend(img);
  };

  document.getElementById('userName').replaceWith(userDiv);
};


// Function to shuffle an array using Fisher-Yates algorithm
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
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

document.getElementById('darkModeButtonLogin').addEventListener('click', toggleDarkMode);
document.getElementById('darkModeButtonAuthorized').addEventListener('click', toggleDarkMode);

// Function to toggle dark mode
function toggleDarkMode() {
  const body = document.body;
  body.classList.toggle('dark-mode');

  // Switch the icon and the text
  const isDarkMode = body.classList.contains('dark-mode');
  if (isDarkMode) {
    this.innerHTML = '<i class="fas fa-sun"></i> ';
    this.style.color = '#fff';
    this.style.backgroundColor = 'rgba(4, 4, 4)';
    this.style.border = 'none';

    localStorage.setItem('theme', 'dark-mode');
  } else {
    this.innerHTML = '<i class="fas fa-moon"></i>';
    this.style.color = '#000';
    this.style.backgroundColor = '#ece7e7';
    this.style.border = 'none';

    localStorage.setItem('theme', '');
  }
}


// Function to apply the initial theme
function applyInitialTheme() {
  const storedTheme = localStorage.getItem('theme');
  if (storedTheme) {
    document.body.classList.add(storedTheme);
  }

  const isDarkMode = document.body.classList.contains('dark-mode');
  const darkModeButtonLogin = document.getElementById('darkModeButtonLogin');

  // Initialize the button style
  if (isDarkMode) {
    darkModeButtonLogin.innerHTML = '<i class="fas fa-sun"></i> ';
    darkModeButtonLogin.style.color = '#fff';
    darkModeButtonLogin.style.backgroundColor = 'rgba(4, 4, 4)';
    darkModeButtonLogin.style.border = 'none';
    
    darkModeButtonAuthorized.innerHTML = '<i class="fas fa-sun"></i> ';
    darkModeButtonAuthorized.style.color = '#fff';
    darkModeButtonAuthorized.style.backgroundColor = 'rgba(4, 4, 4)';
    darkModeButtonAuthorized.style.border = 'none';
  } else {
    darkModeButtonLogin.innerHTML = '<i class="fas fa-moon"></i>';
    darkModeButtonLogin.style.color = '#000';
    darkModeButtonLogin.style.backgroundColor = '#ece7e7';
    darkModeButtonLogin.style.border = 'none';
    
    darkModeButtonAuthorized.innerHTML = '<i class="fas fa-moon"></i>';
    darkModeButtonAuthorized.style.color = '#000';
    darkModeButtonAuthorized.style.backgroundColor = '#ece7e7';
    darkModeButtonAuthorized.style.border = 'none';
  }
}

// Event listener to handle document ready event
document.addEventListener('DOMContentLoaded', function() {
  applyInitialTheme();

  const accessToken = sessionStorage.getItem('spotify_access_token');
  const code = new URLSearchParams(window.location.search).get('code');
  const attemptingAuth = sessionStorage.getItem('attempting-auth');
  const userAuthenticated = sessionStorage.getItem('user_authenticated'); // Get the user_authenticated value

  const currentTimestamp = new Date().getTime();
  const tokenExpiryTimestamp = sessionStorage.getItem('spotify_access_token_expiry');

  // Debugging statements
  console.log("Access Token: ", accessToken);
  console.log("Token Expiry: ", tokenExpiryTimestamp);
  console.log("Current Timestamp: ", currentTimestamp);
  
  // If user has been authenticated previously, handle their data fetching
  if (userAuthenticated === 'true') {
      handleAuthResponse();
      return;
  }
  
  if (accessToken && (!tokenExpiryTimestamp || currentTimestamp > tokenExpiryTimestamp)) {
      console.log("Redirecting to Spotify for authentication...");  // Debugging statement
      redirectToSpotifyAuth();
      return;
  }

  if (code && attemptingAuth) {
      handleAuthResponse();
      sessionStorage.removeItem('attempting-auth');
      history.replaceState(null, null, window.location.pathname); // This will clear the URL parameters
  }

  document.getElementById('loginButton').addEventListener('click', function() {
      if (!accessToken) {
          redirectToSpotifyAuth();
      }
  });
});

  //Search input
  const searchField = document.getElementById('songSearch');
  searchField.addEventListener('input', async function() {
    const query = this.value.toLowerCase();
    const filteredSongs = allSongs.filter(song => {
        const songName = `${song.name} by ${song.artists[0].name}`.toLowerCase();
        return songName.includes(query);
    });

    const youtubeLinks = await Promise.all(filteredSongs.map(song => searchYoutube(song.name, song.artists[0].name)));
    
    // Paginate the filtered songs and their corresponding YouTube links
    pages = paginateSongs(filteredSongs, youtubeLinks, SONGS_PER_PAGE);
    currentPage = 0; // Reset to the first page after a search
    displayPage(currentPage);
});
  
  const logoutButton = document.getElementById('logoutButton');
  logoutButton.addEventListener('click', function() {
      // Clear the access token, expiry, and authentication state from session storage
      sessionStorage.removeItem('spotify_access_token');
      sessionStorage.removeItem('spotify_access_token_expiry');
      sessionStorage.removeItem('user_authenticated');
      // Reload the page after logout.
      location.reload();
  });