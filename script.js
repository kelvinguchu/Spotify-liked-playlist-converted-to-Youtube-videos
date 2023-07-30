// Constants for client details and API keys
const clientId = '473e1292e9714be2b9defd20feebd20feebd4eb';
const clientSecret = 'b58bd34301a9493dbba1a1e36fcd4fe3';
const redirectUri = 'http://127.0.0.1:5500/index.html';
const apiKey = 'AIzaSyDeby8kdPYzUQawOqFiNRp_UJ34Zmvaag8';

// Function to redirect to Spotify for authentication
function redirectToSpotifyAuth() {
  const scopes = encodeURIComponent('user-library-read');
  window.location = `https://accounts.spotify.com/authorize?response_type=code&client_id=${clientId}&scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUri)}`;
}

// Function to get Access Token from Spotify
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
  }

  const data = await response.json();
  return data.access_token;
}

// Function to get liked songs from Spotify
async function getLikedSongs(accessToken, url = 'https://api.spotify.com/v1/me/tracks?limit=50') {
  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  
  const data = await response.json();
  let tracks = data.items.map(item => item.track);

  if (data.next) {
    const nextTracks = await getLikedSongs(accessToken, data.next);
    tracks = [...tracks, ...nextTracks];
  }

  return tracks;
}

// Function to search for a song on Youtube
async function searchYoutube(songName, artistName) {
  const query = encodeURIComponent(`${songName} ${artistName}`);
  const response = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=1&videoEmbeddable=true&regionCode=US&type=video&q=${query}&key=${apiKey}`);
  const data = await response.json();
  return data.items[0].id.videoId;
}

// Function to display liked songs on the page
function displaySongs(songs, youtubeLinks) {
  const list = document.getElementById('song-list');
  
  songs.forEach((song, i) => {
    const listItem = document.createElement('li');
    const songInfo = document.createElement('p');
    songInfo.textContent = `${song.name} by ${song.artists[0].name}`;
    listItem.appendChild(songInfo);

    const youtubeEmbed = document.createElement('iframe');
    youtubeEmbed.width = "100%";
    youtubeEmbed.height = "auto";
    youtubeEmbed.src = `https://www.youtube.com/embed/${youtubeLinks[i]}`;
    youtubeEmbed.title = "YouTube video player";
    youtubeEmbed.frameBorder = "0";
    youtubeEmbed.style.borderRadius = "15px";
    youtubeEmbed.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
    youtubeEmbed.allowFullscreen = true;
    listItem.appendChild(youtubeEmbed);

    list.appendChild(listItem);
  });
}

// Function to get user profile from Spotify
async function getUserProfile(accessToken) {
  const response = await fetch('https://api.spotify.com/v1/me', {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  return data;
}

// Function to handle authorization response from Spotify
async function handleAuthResponse() {
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');

  if (code) {
    try {
      const accessToken = await getAccessToken(code);
      const userProfile = await getUserProfile(accessToken);
      const songs = await getLikedSongs(accessToken);
      const youtubeLinks = await Promise.all(songs.map(song => searchYoutube(song.name, song.artists[0].name))); 

      document.getElementById('userName').textContent = userProfile.display_name;
      displaySongs(songs, youtubeLinks);

      document.getElementById('loginSection').style.display = 'none';
      document.getElementById('authorizedSection').style.display = 'block';
    } catch (error) {
      console.error(`Failed to get access token, user profile, or liked songs: ${error}`);
    }
  }
}

// Event Listener for DOM content loaded
document.addEventListener('DOMContentLoaded', function() {
  const loginButton = document.getElementById('loginButton');
  loginButton.addEventListener('click', redirectToSpotifyAuth);
  window.onload = handleAuthResponse;
});
