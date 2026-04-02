// App State
const state = {
    library: [], // Array of song objects: { id, file, title, artist, duration, url }
    playlists: JSON.parse(localStorage.getItem('symphony_playlists')) || [],
    currentView: 'library', // 'library' or playlist id
    currentPlaylist: [], // Array of song objects currently queued
    currentIndex: -1,
    isPlaying: false,
    isShuffle: false,
    isRepeat: false,
    theme: localStorage.getItem('symphony_theme') || 'dark',
    activeModalSongId: null
};

// DOM Elements
const audio = new Audio();
const fileUpload = document.getElementById('file-upload');
const songListEl = document.getElementById('song-list');
const playlistListEl = document.getElementById('playlist-list');
const currentViewTitle = document.getElementById('current-view-title');
const currentViewCount = document.getElementById('current-view-count');

// Player Controls DOM
const playPauseBtn = document.getElementById('play-pause-btn');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const shuffleBtn = document.getElementById('shuffle-btn');
const repeatBtn = document.getElementById('repeat-btn');
const progressBar = document.getElementById('progress-slider');
const progressFill = document.getElementById('progress-fill');
const currentTimeEl = document.getElementById('current-time');
const totalTimeEl = document.getElementById('total-time');
const volumeSlider = document.getElementById('volume-slider');

// Now Playing DOM
const nowPlayingTitle = document.getElementById('now-playing-title');
const nowPlayingArtist = document.getElementById('now-playing-artist');
const defaultArt = document.querySelector('.default-art');
const albumImg = document.getElementById('now-playing-img');

// Modal DOM
const modalOverlay = document.getElementById('playlist-modal');
const closeModalBtn = document.getElementById('close-modal');
const modalPlaylistList = document.getElementById('modal-playlist-list');
const newPlaylistInput = document.getElementById('new-playlist-input');
const createPlaylistBtn = document.getElementById('create-playlist-btn');
const toastEl = document.getElementById('toast');

// Views and Navigation
const navLibrary = document.getElementById('nav-library');
const navSearchBtn = document.getElementById('nav-search-btn');
const searchBarContainer = document.getElementById('search-bar-container');
const searchInput = document.getElementById('search-input');
const themeToggle = document.getElementById('theme-toggle');

// Helper: Format Time
function formatTime(seconds) {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

// Helper: Generate ID
function generateId() {
    return Math.random().toString(36).substr(2, 9);
}

// Helper: Show Toast
function showToast(message) {
    toastEl.textContent = message;
    toastEl.classList.add('show');
    setTimeout(() => {
        toastEl.classList.remove('show');
    }, 3000);
}

// Initialize Theme
function initTheme() {
    document.documentElement.setAttribute('data-theme', state.theme);
    updateThemeUI();
}

function toggleTheme() {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', state.theme);
    localStorage.setItem('symphony_theme', state.theme);
    updateThemeUI();
}

function updateThemeUI() {
    const themeIcon = document.getElementById('theme-icon');
    const themeText = document.getElementById('theme-text');
    if (state.theme === 'light') {
        themeIcon.classList.replace('fa-sun', 'fa-moon');
        themeText.textContent = 'Dark Mode';
    } else {
        themeIcon.classList.replace('fa-moon', 'fa-sun');
        themeText.textContent = 'Light Mode';
    }
}

// Initialize App
function initApp() {
    initTheme();
    renderPlaylistsSidebar();
    
    // Set initial audio volume
    audio.volume = volumeSlider.value / 100;
}

// --- FILE UPLOAD & PROCESSING ---

fileUpload.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    showToast(`Processing ${files.length} files...`);

    for (const file of files) {
        // Strip out extension for title, look for dash to separate artist
        const nameParts = file.name.replace(/\.[^/.]+$/, "").split('-');
        let artist = 'Unknown Artist';
        let title = nameParts[0].trim();
        
        if (nameParts.length > 1) {
            artist = nameParts[0].trim();
            title = nameParts[1].trim();
        }

        const song = {
            id: generateId(),
            file: file,
            title: title,
            artist: artist,
            url: URL.createObjectURL(file), // Revokable memory URL
            duration: 0 // Will update when loaded
        };

        // Preload to get duration
        await new Promise((resolve) => {
            const tempAudio = new Audio(song.url);
            tempAudio.addEventListener('loadedmetadata', () => {
                song.duration = tempAudio.duration;
                resolve();
            });
            tempAudio.addEventListener('error', resolve); // resolve anyway on error
        });

        state.library.push(song);
    }
    
    // Refresh current view if we are on library
    if (state.currentView === 'library') {
        renderSongList(state.library);
    }
    
    showToast(`Added ${files.length} songs to library`);
});

// --- RENDER LOGIC ---

function renderSongList(songs) {
    if (songs.length === 0) {
        songListEl.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-compact-disc"></i>
                <h3>No songs found</h3>
                <p>${state.currentView === 'library' ? 'Upload some local music files to get started.' : 'This playlist is empty.'}</p>
            </div>
        `;
        currentViewCount.textContent = '0 songs';
        document.getElementById('play-all-btn').style.display = 'none';
        return;
    }

    currentViewCount.textContent = `${songs.length} song${songs.length !== 1 ? 's' : ''}`;
    document.getElementById('play-all-btn').style.display = 'flex';
    songListEl.innerHTML = '';

    songs.forEach((song, index) => {
        const isActive = state.currentPlaylist[state.currentIndex]?.id === song.id;
        const item = document.createElement('div');
        item.className = `song-item ${isActive ? 'playing' : ''}`;
        
        item.innerHTML = `
            <div class="song-number">
                <span>${index + 1}</span>
                <button class="play-overlay-btn" onclick="playSongFromContext('${song.id}')">
                    <i class="fa-solid ${isActive && state.isPlaying ? 'fa-pause' : 'fa-play'}"></i>
                </button>
            </div>
            <div class="song-info">
                <div class="song-title" title="${song.title}">${song.title}</div>
            </div>
            <div class="song-artist" title="${song.artist}">${song.artist}</div>
            <div class="song-duration">${formatTime(song.duration)}</div>
            <div class="song-actions">
                <button class="action-btn" onclick="openModal('${song.id}')" title="Add to Playlist">
                    <i class="fa-solid fa-plus"></i>
                </button>
                ${state.currentView !== 'library' ? `
                <button class="action-btn" onclick="removeFromPlaylist('${song.id}')" title="Remove from Playlist">
                    <i class="fa-solid fa-trash"></i>
                </button>
                ` : ''}
            </div>
        `;
        
        // Double click to play
        item.addEventListener('dblclick', () => {
            playSongFromContext(song.id);
        });

        songListEl.appendChild(item);
    });
}

function renderPlaylistsSidebar() {
    playlistListEl.innerHTML = '';
    state.playlists.forEach(playlist => {
        const el = document.createElement('div');
        el.className = `playlist-item ${state.currentView === playlist.id ? 'active' : ''}`;
        el.innerHTML = `
            <span style="flex:1; overflow:hidden; text-overflow:ellipsis;">${playlist.name}</span>
            <button class="delete-playlist-btn" onclick="removePlaylist(event, '${playlist.id}')">
                <i class="fa-solid fa-trash"></i>
            </button>
        `;
        el.addEventListener('click', () => {
            loadPlaylistView(playlist.id);
        });
        playlistListEl.appendChild(el);
    });
}

// --- NAVIGATION & VIEWS ---

navLibrary.addEventListener('click', () => {
    loadLibraryView();
});

function loadLibraryView() {
    state.currentView = 'library';
    currentViewTitle.textContent = 'All Songs';
    
    document.querySelectorAll('.menu-item').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.playlist-item').forEach(el => el.classList.remove('active'));
    navLibrary.classList.add('active');
    
    renderSongList(state.library);
}

function loadPlaylistView(playlistId) {
    state.currentView = playlistId;
    const playlist = state.playlists.find(p => p.id === playlistId);
    currentViewTitle.textContent = playlist.name;
    
    document.querySelectorAll('.menu-item').forEach(el => el.classList.remove('active'));
    navLibrary.classList.remove('active');
    renderPlaylistsSidebar(); // updates active state there
    
    // Resolve songs from library (since we only store IDs in localStorage)
    const playlistSongs = playlist.songIds
        .map(id => state.library.find(s => s.id === id))
        .filter(s => s != null);
        
    renderSongList(playlistSongs);
}

// Search functionality
navSearchBtn.addEventListener('click', () => {
    if (searchBarContainer.style.display === 'none') {
        searchBarContainer.style.display = 'flex';
        searchInput.focus();
        navSearchBtn.classList.add('active');
    } else {
        searchBarContainer.style.display = 'none';
        searchInput.value = '';
        navSearchBtn.classList.remove('active');
        if (state.currentView === 'library') loadLibraryView();
        else loadPlaylistView(state.currentView);
    }
});

searchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    
    let sourceSongs = [];
    if (state.currentView === 'library') {
        sourceSongs = state.library;
    } else {
        const pl = state.playlists.find(p => p.id === state.currentView);
        sourceSongs = pl.songIds.map(id => state.library.find(s => s.id === id)).filter(s=>s);
    }
    
    const filtered = sourceSongs.filter(s => 
        s.title.toLowerCase().includes(query) || 
        s.artist.toLowerCase().includes(query)
    );
    
    renderSongList(filtered);
});

document.getElementById('play-all-btn').addEventListener('click', () => {
    // Determine context
    let sourceSongs = [];
    if (state.currentView === 'library') {
        sourceSongs = [...state.library];
    } else {
        const pl = state.playlists.find(p => p.id === state.currentView);
        sourceSongs = pl.songIds.map(id => state.library.find(s => s.id === id)).filter(s=>s);
    }
    
    if (sourceSongs.length > 0) {
        state.currentPlaylist = sourceSongs;
        playTrack(0);
    }
});

// --- AUDIO PLAYBACK LOGIC ---

window.playSongFromContext = function(songId) {
    let sourceSongs = [];
    if (state.currentView === 'library') {
        // If we are searching, we only play from the visible list?
        // Keep simple: play from full library or playlist
        sourceSongs = [...state.library];
    } else {
        const pl = state.playlists.find(p => p.id === state.currentView);
        sourceSongs = pl.songIds.map(id => state.library.find(s => s.id === id)).filter(s=>s);
    }
    
    state.currentPlaylist = sourceSongs;
    const index = state.currentPlaylist.findIndex(s => s.id === songId);
    
    if (index !== -1) {
        if (state.currentIndex === index && audio.src && !audio.paused) {
            audio.pause();
        } else if (state.currentIndex === index && audio.src && audio.paused) {
            audio.play();
        } else {
            playTrack(index);
        }
    }
};

function playTrack(index) {
    if (index < 0 || index >= state.currentPlaylist.length) return;
    
    state.currentIndex = index;
    const song = state.currentPlaylist[index];
    
    audio.src = song.url;
    audio.play()
        .then(() => {
            state.isPlaying = true;
            updatePlayerUI();
            
            // Re-render song list to update playing states
            if (state.currentView === 'library') renderSongList(state.library);
            else loadPlaylistView(state.currentView);
            
        })
        .catch(err => {
            console.error("Playback error:", err);
            showToast("Failed to play track. You may need to re-upload files if refreshed.");
        });
        
    // Update Now Playing UI immediately
    nowPlayingTitle.textContent = song.title;
    nowPlayingArtist.textContent = song.artist;
    
    // Just a fun color trick for the album art instead of parsing ID3
    const hue = Math.floor(Math.random() * 360);
    defaultArt.style.color = `hsl(${hue}, 70%, 50%)`;
}

function togglePlay() {
    if (!audio.src) return;
    
    if (audio.paused) {
        audio.play().catch(e=>console.log(e));
        state.isPlaying = true;
    } else {
        audio.pause();
        state.isPlaying = false;
    }
    updatePlayerUI();
    
    // Re-render list slightly to sync play/pause icon on hover
    if (state.currentView === 'library') renderSongList(state.library);
    else loadPlaylistView(state.currentView);
}

function playNext() {
    if (!state.currentPlaylist.length) return;
    
    if (state.isShuffle) {
        let nextIndex;
        do {
            nextIndex = Math.floor(Math.random() * state.currentPlaylist.length);
        } while (nextIndex === state.currentIndex && state.currentPlaylist.length > 1);
        playTrack(nextIndex);
    } else {
        let nextIndex = state.currentIndex + 1;
        if (nextIndex >= state.currentPlaylist.length) {
            if (state.isRepeat) {
                nextIndex = 0;
            } else {
                return; // Stop if at end and no repeat
            }
        }
        playTrack(nextIndex);
    }
}

function playPrev() {
    if (!state.currentPlaylist.length) return;
    if (audio.currentTime > 3) {
        // Restart current instead of previous if playing for > 3s
        audio.currentTime = 0;
        return;
    }
    
    let prevIndex = state.currentIndex - 1;
    if (prevIndex < 0) prevIndex = state.currentPlaylist.length - 1;
    playTrack(prevIndex);
}

// Player Events
audio.addEventListener('timeupdate', () => {
    if (isNaN(audio.duration)) return;
    const progressPercent = (audio.currentTime / audio.duration) * 100;
    progressBar.value = progressPercent;
    progressFill.style.width = `${progressPercent}%`;
    currentTimeEl.textContent = formatTime(audio.currentTime);
    totalTimeEl.textContent = formatTime(audio.duration);
});

audio.addEventListener('ended', () => {
    if (state.isRepeat && state.currentPlaylist.length === 1) {
        audio.currentTime = 0;
        audio.play();
    } else {
        playNext();
    }
});

// UI Event Listeners
playPauseBtn.addEventListener('click', togglePlay);
nextBtn.addEventListener('click', playNext);
prevBtn.addEventListener('click', playPrev);

shuffleBtn.addEventListener('click', () => {
    state.isShuffle = !state.isShuffle;
    shuffleBtn.classList.toggle('active', state.isShuffle);
});

repeatBtn.addEventListener('click', () => {
    state.isRepeat = !state.isRepeat;
    repeatBtn.classList.toggle('active', state.isRepeat);
});

progressBar.addEventListener('input', (e) => {
    const percent = e.target.value;
    progressFill.style.width = `${percent}%`;
    if (audio.duration) {
        currentTimeEl.textContent = formatTime((percent / 100) * audio.duration);
    }
});

progressBar.addEventListener('change', (e) => {
    const percent = e.target.value;
    if (audio.duration) {
        audio.currentTime = (percent / 100) * audio.duration;
    }
});

volumeSlider.addEventListener('input', (e) => {
    const vol = e.target.value / 100;
    audio.volume = vol;
    
    const icon = document.getElementById('volume-icon');
    if (vol === 0) icon.className = 'fa-solid fa-volume-xmark';
    else if (vol < 0.5) icon.className = 'fa-solid fa-volume-low';
    else icon.className = 'fa-solid fa-volume-high';
});

function updatePlayerUI() {
    const icon = playPauseBtn.querySelector('i');
    if (state.isPlaying) {
        icon.classList.replace('fa-circle-play', 'fa-circle-pause');
    } else {
        icon.classList.replace('fa-circle-pause', 'fa-circle-play');
    }
}

themeToggle.addEventListener('click', toggleTheme);

// --- PLAYLIST MANAGEMENT ---

document.getElementById('add-playlist-btn').addEventListener('click', () => {
    openModal(null); // Open modal with no song, just for creating UI? Or just handle simple entry.
    // simpler: prompt or handle in modal text input alone
});

function savePlaylists() {
    localStorage.setItem('symphony_playlists', JSON.stringify(state.playlists));
    renderPlaylistsSidebar();
}

window.removePlaylist = function(e, id) {
    e.stopPropagation();
    if(confirm('Delete this playlist?')) {
        state.playlists = state.playlists.filter(p => p.id !== id);
        savePlaylists();
        if (state.currentView === id) loadLibraryView();
    }
};

window.removeFromPlaylist = function(songId) {
    const playlist = state.playlists.find(p => p.id === state.currentView);
    if (playlist) {
        playlist.songIds = playlist.songIds.filter(id => id !== songId);
        savePlaylists();
        loadPlaylistView(playlist.id); // Re-render
    }
};

// --- MODAL LOGIC ---

window.openModal = function(songId) {
    state.activeModalSongId = songId;
    
    modalPlaylistList.innerHTML = '';
    
    if (state.playlists.length === 0) {
        modalPlaylistList.innerHTML = '<p style="color:var(--text-secondary);font-size:14px;padding:10px 0;">No playlists found. Create one below.</p>';
    } else {
        state.playlists.forEach(pl => {
            const el = document.createElement('div');
            el.className = 'modal-playlist-item';
            el.textContent = pl.name;
            
            // Allow adding if a song is selected
            if (songId) {
                if (pl.songIds.includes(songId)) {
                    el.textContent += ' ✓ (Added)';
                    el.style.opacity = '0.5';
                    el.style.pointerEvents = 'none';
                } else {
                    el.addEventListener('click', () => {
                        pl.songIds.push(songId);
                        savePlaylists();
                        showToast(`Added to ${pl.name}`);
                        closeModal();
                    });
                }
            } else {
                el.style.pointerEvents = 'none'; // Just viewing in add playlist path
            }
            modalPlaylistList.appendChild(el);
        });
    }
    
    modalOverlay.classList.add('active');
    newPlaylistInput.focus();
};

function closeModal() {
    modalOverlay.classList.remove('active');
    newPlaylistInput.value = '';
    state.activeModalSongId = null;
}

closeModalBtn.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
});

createPlaylistBtn.addEventListener('click', () => {
    const name = newPlaylistInput.value.trim();
    if (!name) return;
    
    const newPlaylist = {
        id: generateId(),
        name: name,
        songIds: []
    };
    
    // If a song was active, add it immediately
    if (state.activeModalSongId) {
        newPlaylist.songIds.push(state.activeModalSongId);
    }
    
    state.playlists.push(newPlaylist);
    savePlaylists();
    
    if (state.activeModalSongId) {
        showToast(`Playlist created and song added!`);
        closeModal();
    } else {
        showToast(`Playlist "${name}" created.`);
        newPlaylistInput.value = '';
        openModal(null); // refresh modal view
    }
});

// Run Init
initApp();
