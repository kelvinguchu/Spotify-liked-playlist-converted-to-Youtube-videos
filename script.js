function redirectToSpotifyAuth() {
  const clientId = '473e1292e9714be2b9defd20feebd4eb';
  const redirectUri = encodeURIComponent('https://spotify-to-youtube.vercel.app/');
  const scopes = encodeURIComponent('user-library-read');

  window.location = `https://accounts.spotify.com/authorize?response_type=code&client_id=${clientId}&scope=${scopes}&redirect_uri=${redirectUri}`;
}

document.addEventListener('DOMContentLoaded', function() {
  const logButton = document.getElementById('loginButton');
  logButton.addEventListener('click', redirectToSpotifyAuth);
});


async function getAccessToken(code) {
  const clientId = '473e1292e9714be2b9defd20feebd4eb';
  const clientSecret = 'b58bd34301a9493dbba1a1e36fcd4fe3';
  const redirectUri = 'https://spotify-to-youtube.vercel.app/';

  const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': 'Basic ' + btoa(clientId + ':' + clientSecret)
      },
      body: new URLSearchParams({
          'grant_type': 'authorization_code',
          'code': code,
          'redirect_uri': redirectUri
      })
  });

  const data = await response.json();

  return data.access_token;
}

async function getLikedSongs(accessToken) {
  const response = await fetch('https://api.spotify.com/v1/me/tracks', {
      headers: {
          'Authorization': 'Bearer ' + accessToken
      }
  });

  const data = await response.json();

  return data.items.map(item => item.track);
}

async function searchYoutube(songName, artistName) {
  const apiKey = 'AIzaSyDeby8kdPYzUQawOqFiNRp_UJ34Zmvaag8';
  const query = encodeURIComponent(songName + ' ' + artistName);
  const response = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=1&q=${query}&key=${apiKey}`);

  const data = await response.json();

  return data.items[0].id.videoId;
}


function displaySongs(songs, youtubeLinks) {
  const list = document.getElementById('song-list');

  for (let i = 0; i < songs.length; i++) {
      const song = songs[i];
      const listItem = document.createElement('li');

      const songInfo = document.createElement('p');
      songInfo.textContent = song.name + ' by ' + song.artists[0].name;
      listItem.appendChild(songInfo);

      const youtubeEmbed = document.createElement('iframe');
      youtubeEmbed.width = "560";
      youtubeEmbed.height = "315";
      youtubeEmbed.src = 'https://www.youtube.com/embed/' + youtubeLinks[i];
      youtubeEmbed.title = "YouTube video player";
      youtubeEmbed.frameborder = "0";
      youtubeEmbed.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
      youtubeEmbed.allowFullscreen = true;
      listItem.appendChild(youtubeEmbed);

      list.appendChild(listItem);
  }
}

async function handleAuthResponse() {
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');

  if (code) {
      const accessToken = await getAccessToken(code);
      const songs = await getLikedSongs(accessToken);
      const youtubeLinks = await Promise.all(songs.map(song => searchYoutube(song.name, song.artists[0].name))); 
      displaySongs(songs, youtubeLinks);

      document.getElementById('loginSection').style.display = 'none';
      document.getElementById('authorizedSection').style.display = 'block';
  }
}

window.onload = handleAuthResponse;