// like.js

// Import Firebase functions needed
import { getFirestore, doc, onSnapshot, getDoc, updateDoc, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";


// Configuração do Firebase para a sua aplicação web
const firebaseConfig = {
    apiKey: "AIzaSyD4gKKJh59ljwOe0PDYaJSsfEp_7PMBD8s",
    authDomain: "tune-8cafb.firebaseapp.com",
    projectId: "tune-8cafb",
    storageBucket: "tune-8cafb.firebasestorage.app",
    messagingSenderId: "599729070480",
    appId: "1:599729070480:web:4b2a7d806a8b7732c39315"
};

// Ensure the 'db' instance is accessible
const db = getFirestore(app); // Assuming 'app' is defined elsewhere in your setup

// Get the current user UID (this should be provided by your authentication system)
const currentUserUid = "your-current-user-uid"; // Replace with actual user UID logic

/**
 * Toggles a like for a given item (album, playlist, or artist).
 * @param {string} type The type of item being liked ('albums', 'playlists', or 'artists').
 * @param {string} itemId The ID of the item.
 * @param {HTMLElement} buttonElement The button element that was clicked.
 */
export async function toggleLike(type, itemId, buttonElement) {
    if (!currentUserUid) {
        console.warn("User not logged in. Cannot toggle like.");
        return;
    }

    const userDocRef = doc(db, "usuarios", currentUserUid);
    const userDocSnap = await getDoc(userDocRef);

    if (!userDocSnap.exists()) {
        console.error("User document not found.");
        return;
    }

    const userData = userDocSnap.data();
    let likedField;

    switch (type) {
        case 'albums':
            likedField = 'likedAlbums';
            break;
        case 'playlists':
            likedField = 'likedPlaylists';
            break;
        case 'artists':
            likedField = 'likedArtists';
            break;
        default:
            console.error("Invalid like type:", type);
            return;
    }

    const likedItems = userData[likedField] || [];
    const isLiked = likedItems.includes(itemId);

    if (isLiked) {
        // Remove the item from the array
        await updateDoc(userDocRef, {
            [likedField]: arrayRemove(itemId)
        });
        updateLikeButtonState(buttonElement, false);
        console.log(`Removed from ${likedField}: ${itemId}`);
    } else {
        // Add the item to the array
        await updateDoc(userDocRef, {
            [likedField]: arrayUnion(itemId)
        });
        updateLikeButtonState(buttonElement, true);
        console.log(`Added to ${likedField}: ${itemId}`);
    }
}

/**
 * Checks if an item is liked and updates the button state.
 * @param {string} type The type of item.
 * @param {string} itemId The ID of the item.
 * @param {HTMLElement} buttonElement The button element to update.
 */
export function checkAndSetLikeState(type, itemId, buttonElement) {
    if (!currentUserUid || !buttonElement) {
        updateLikeButtonState(buttonElement, false);
        return;
    }

    const userDocRef = doc(db, "usuarios", currentUserUid);
    
    // Use onSnapshot for real-time updates
    onSnapshot(userDocRef, (docSnap) => {
        if (docSnap.exists()) {
            const userData = docSnap.data();
            let likedField;
            switch (type) {
                case 'albums':
                    likedField = 'likedAlbums';
                    break;
                case 'playlists':
                    likedField = 'likedPlaylists';
                    break;
                case 'artists':
                    likedField = 'likedArtists';
                    break;
                default:
                    return;
            }
            const likedItems = userData[likedField] || [];
            const isLiked = likedItems.includes(itemId);
            updateLikeButtonState(buttonElement, isLiked);
        } else {
            updateLikeButtonState(buttonElement, false);
        }
    });
}

/**
 * Updates the visual state of a like button.
 * @param {HTMLElement} button The button element.
 * @param {boolean} isLiked Whether the item is currently liked.
 */
function updateLikeButtonState(button, isLiked) {
    const iconBase = "/assets/like.svg";
    const iconLiked = "/assets/liked.svg"; 

    const img = button.querySelector('img');
    if (img) {
        if (isLiked) {
            img.src = iconLiked;
            img.style.filter = "invert(1) sepia(1) saturate(1000%) hue-rotate(290deg)";
        } else {
            img.src = iconBase;
            img.style.filter = "none";
        }
    }
}

/**
 * Renders the grid of all liked items.
 */
export async function renderLikedItemsGrid() {
    const likedGridContainer = document.getElementById('liked-items-grid');
    if (!likedGridContainer || !currentUserUid) return;

    // Listen for real-time updates on the user's liked items
    const userDocRef = doc(db, "usuarios", currentUserUid);
    
    onSnapshot(userDocRef, async (docSnap) => {
        likedGridContainer.innerHTML = `<div class="loading-text text-gray-400">Carregando seus favoritos...</div>`;
        if (!docSnap.exists()) {
            likedGridContainer.innerHTML = `<p class="text-gray-400">Você não curtiu nenhum item ainda.</p>`;
            return;
        }

        const userData = docSnap.data();
        const likedItems = [];
        
        const likedAlbums = userData.likedAlbums || [];
        const likedPlaylists = userData.likedPlaylists || [];
        const likedArtists = userData.likedArtists || [];

        // Fetch data for liked albums
        for (const albumId of likedAlbums) {
            const albumDocSnap = await getDoc(doc(db, "albuns", albumId));
            if (albumDocSnap.exists()) {
                likedItems.push({ id: albumId, type: 'album', ...albumDocSnap.data() });
            }
        }

        // Fetch data for liked playlists
        for (const playlistId of likedPlaylists) {
            const playlistDocSnap = await getDoc(doc(db, "playlists", playlistId));
            if (playlistDocSnap.exists()) {
                likedItems.push({ id: playlistId, type: 'playlist', ...playlistDocSnap.data() });
            }
        }

        // Fetch data for liked artists
        for (const artistId of likedArtists) {
            const artistDocSnap = await getDoc(doc(db, "usuarios", artistId));
            if (artistDocSnap.exists()) {
                likedItems.push({ id: artistId, type: 'artist', ...artistDocSnap.data() });
            }
        }
        
        // Render the top 8 items
        const itemsToRender = likedItems.slice(0, 8);
        likedGridContainer.innerHTML = '';
        
        if (itemsToRender.length === 0) {
            likedGridContainer.innerHTML = `<p class="text-gray-400">Você não curtiu nenhum item ainda.</p>`;
            return;
        }

        itemsToRender.forEach(item => {
            const card = createLikedItemCard(item);
            likedGridContainer.appendChild(card);
        });
    });
}

/**
 * Creates an HTML card for a liked item (album, playlist, or artist).
 * @param {object} item The item data.
 * @returns {HTMLElement} The created card element.
 */
function createLikedItemCard(item) {
    const card = document.createElement("div");
    card.className = "liked-card flex flex-col items-center text-center cursor-pointer";
    
    let coverUrl;
    let title;
    let description;
    let redirectPage;

    switch (item.type) {
        case 'album':
            coverUrl = item.cover || 'https://placehold.co/150x150/333333/FFFFFF?text=Sem+Capa';
            title = item.album;
            description = item.artist;
            redirectPage = 'album';
            break;
        case 'playlist':
            coverUrl = item.cover || 'https://placehold.co/150x150/333333/FFFFFF?text=Sem+Capa';
            title = item.name;
            description = item.genres?.join(', ') || 'Playlist';
            redirectPage = 'playlist';
            break;
        case 'artist':
            coverUrl = item.foto || 'https://placehold.co/150x150/333333/FFFFFF?text=Sem+Capa';
            title = item.apelido;
            description = 'Artista';
            redirectPage = 'artist';
            break;
        default:
            return document.createElement('div');
    }

    const isArtist = item.type === 'artist';

    card.innerHTML = `
        <div class="relative w-full pb-[100%]">
            <img src="${coverUrl}" alt="${title}" class="absolute top-0 left-0 w-full h-full object-cover rounded-${isArtist ? 'full' : 'md'} shadow-lg block">
        </div>
        <div class="mt-2 w-full">
            <h3 class="text-sm font-semibold text-white truncate">${title}</h3>
            <p class="text-gray-400 text-xs truncate">${description}</p>
        </div>
    `;

    card.addEventListener('click', () => {
        loadContent(redirectPage, item.id);
    });

    return card;
}

class Storyline {
  constructor(selector, options) {
    this.options = {
      storyTime: 4500,
      ...options,
    };
    this.storyline = document.querySelector(selector);
    this.currentSlide = 0;
    this.slider = null;
    this.element = null;
    this.prev = null;
    this.next = null;
    this.time = null;
    this.slides = [];
    this.indicators = [];
    this.nextHandler = this.slideNext.bind(this);
    this.prevHandler = this.slidePrev.bind(this);
  }

  init() {
    this.slider = this.storyline.querySelector('.storyline-slider');
    this.slides = this.slider.querySelectorAll('.storyline-slide');
    return this.slides.length > 1 ? this.multipleStoryline() : this.singleStoryline();
  }

  singleStoryline() {
    this.slides.classList.add('slide-active');
    this.slides.setAttribute('aria-hidden', false);
  }

  multipleStoryline() {
    this.createIndicators();
    this.createControls();
    this.changeSlide(this.currentSlide);
  }

  createIndicators() {
    const storyLineHeader = this.storyline.querySelector('.storyline-header');
    const indicatorWrapper = document.createElement('ul');
    indicatorWrapper.classList.add('storyline-indicator');
    indicatorWrapper.setAttribute('aria-label', 'Storyline indicators');
    for (let i = this.slides.length; i > 0; i -= 1) {
      const indicator = document.createElement('li');
      const indicatorBar = document.createElement('span');
      indicator.classList.add('indicator-item');
      indicatorBar.classList.add('indicator-bar');
      indicatorBar.style.animationDuration = `${this.options.storyTime / 1000}s`;
      indicator.appendChild(indicatorBar);
      indicatorWrapper.appendChild(indicator);
    }
    storyLineHeader.appendChild(indicatorWrapper);
    this.indicators = [...this.storyline.querySelectorAll('.indicator-item')];
  }

  createControls() {
    const controlsWrapper = document.createElement('div');
    controlsWrapper.classList.add('storyline-controls');

    this.prev = document.createElement('button');
    this.prev.type = 'button';
    this.prev.classList.add('storyline-control');
    this.prev.classList.add('storyline-control-prev');
    this.prev.setAttribute('disabled', 'true');
    this.prev.addEventListener('click', this.prevHandler);

    this.next = document.createElement('button');
    this.next.type = 'button';
    this.next.classList.add('storyline-control');
    this.next.classList.add('storyline-control-next');
    this.next.addEventListener('click', this.nextHandler);

    controlsWrapper.appendChild(this.prev);
    controlsWrapper.appendChild(this.next);

    this.slider.appendChild(controlsWrapper);
  }

  changeSlide(index) {
    this.slides.forEach(slide => {
      slide.classList.remove('slide-active');
      slide.setAttribute('aria-hidden', true);
    });

    this.currentSlide = index;

    this.slides[this.currentSlide].classList.add('slide-active');
    this.slides[this.currentSlide].setAttribute('aria-hidden', false);

    this.indicators[this.currentSlide].classList.add('item-loading');

    clearTimeout(this.time);
    this.time = setTimeout(() => {
      if (this.currentSlide !== this.slides.length - 1) {
        this.slideNext();
      } else {
        this.indicators[this.currentSlide].classList.add('item-loaded');
        this.indicators[this.currentSlide].classList.remove('item-loading');
      }
    }, this.options.storyTime);
  }

  slidePrev() {
    this.currentSlide -= 1;
    this.indicators[this.currentSlide + 1].classList.remove('item-loaded');
    this.indicators[this.currentSlide + 1].classList.remove('item-loading');
    this.indicators[this.currentSlide].classList.remove('item-loaded');
    if (this.currentSlide === 0) {
      this.prev.setAttribute('disabled', 'true');
    }
    if (this.currentSlide !== this.slides.length) {
      this.next.removeAttribute('disabled');
      this.changeSlide(this.currentSlide);
    }
  }

  slideNext() {
    this.currentSlide += 1;
    this.indicators[this.currentSlide - 1].classList.remove('item-loading');
    this.indicators[this.currentSlide - 1].classList.add('item-loaded');
    if (this.currentSlide === this.slides.length - 1) {
      this.next.setAttribute('disabled', 'true');
    }
    if (this.currentSlide > 0) {
      this.prev.removeAttribute('disabled');
      this.changeSlide(this.currentSlide);
    }
  }
}

const storyline = new Storyline('.storyline');

document.addEventListener('DOMContentLoaded', () => {
  storyline.init();
});
