// search.js

import { collection, getDocs, query, where, limit } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";
// Se estão na mesma pasta (js/), use ./
import { db } from './main.js';


/**
 * Função principal de inicialização da tela de busca
 * Chamada dinamicamente pelo main.js
 */
export function setupSearchPage() {
    const searchInput = document.getElementById('searchInput');
    const searchResultsDropdown = document.getElementById('searchResultsDropdown');
    const defaultSections = document.getElementById('defaultSections');

    if (!searchInput || !searchResultsDropdown) {
        console.error("Elementos da tela de busca não encontrados.");
        return;
    }

    let debounceTimeout;

    searchInput.addEventListener('input', () => {
        clearTimeout(debounceTimeout);
        debounceTimeout = setTimeout(() => {
            const queryText = searchInput.value.trim();
            if (queryText.length > 0) {
                performSearch(queryText, searchResultsDropdown);
                if (defaultSections) defaultSections.classList.add('hidden');
            } else {
                searchResultsDropdown.classList.add('hidden');
                if (defaultSections) defaultSections.classList.remove('hidden');
            }
        }, 300);
    });
}

async function performSearch(queryText, container) {
    const qLower = queryText.toLowerCase();
    const results = { albums: [], playlists: [], artists: [] };

    try {
        // --- BUSCA POR ÁLBUNS ---
        const albumsRef = collection(db, 'albuns');
        const albumsSnap = await getDocs(albumsRef);
        albumsSnap.forEach(doc => {
            const data = doc.data();
            if (data.album && data.album.toLowerCase().includes(qLower)) {
                // ✅ Armazena o ID do documento
                results.albums.push({ id: doc.id, ...data });
            }
        });

        // --- BUSCA POR ARTISTAS ---
        const usersRef = collection(db, 'usuarios');
        const usersSnap = await getDocs(usersRef);
        usersSnap.forEach(doc => {
            const data = doc.data();
            if (data.artista === "true" && (data.nomeArtistico || data.apelido)) {
                const nome = data.nomeArtistico || data.apelido;
                if (nome.toLowerCase().includes(qLower)) {
                    // ✅ Armazena o ID do documento
                    results.artists.push({ id: doc.id, ...data });
                }
            }
        });

        // --- BUSCA POR PLAYLISTS ---
        const playlistsRef = collection(db, 'playlists');
        const playlistsSnap = await getDocs(playlistsRef);
        playlistsSnap.forEach(doc => {
            const data = doc.data();
            if (data.name && data.name.toLowerCase().includes(qLower)) {
                // ✅ Armazena o ID do documento
                results.playlists.push({ id: doc.id, ...data });
            }
        });

        displayResults(results, container);
    } catch (err) {
        console.error("Erro na busca:", err);
        container.innerHTML = '<p class="p-4 text-red-500">Erro ao buscar. Tente novamente.</p>';
        container.classList.remove('hidden');
    }
}

function displayResults(results, container) {
    let html = '';

    if (results.albums.length > 0) {
        html += '<h3 class="text-xl font-bold p-2">Álbuns</h3>';
        results.albums.forEach(a => {
            html += `
                <a href="menu.html?page=album&id=${a.id}" class="flex items-center p-3 hover:bg-gray-700 rounded-lg">
                    <img src="${a.cover || ''}" alt="${a.album}" class="w-12 h-12 rounded-md mr-3">
                    <div>
                        <p class="font-semibold text-white">${a.album}</p>
                        <p class="text-gray-400 text-sm">${a.artist || ''}</p>
                    </div>
                </a>`;
        });
    }

    if (results.artists.length > 0) {
        html += '<h3 class="text-xl font-bold p-2">Artistas</h3>';
        results.artists.forEach(ar => {
            html += `
                <a href="menu.html?page=artist&id=${ar.id}" class="flex items-center p-3 hover:bg-gray-700 rounded-lg">
                    <img src="${ar.foto || ''}" alt="${ar.nomeArtistico || ar.apelido}" class="w-12 h-12 rounded-full mr-3">
                    <div>
                        <p class="font-semibold text-white">${ar.nomeArtistico || ar.apelido}</p>
                        <p class="text-gray-400 text-sm">Artista</p>
                    </div>
                </a>`;
        });
    }

    if (results.playlists.length > 0) {
        html += '<h3 class="text-xl font-bold p-2">Playlists</h3>';
        results.playlists.forEach(p => {
            html += `
                <a href="menu.html?page=playlist&id=${p.id}" class="flex items-center p-3 hover:bg-gray-700 rounded-lg">
                    <img src="${p.cover || ''}" alt="${p.name}" class="w-12 h-12 rounded-md mr-3">
                    <div>
                        <p class="font-semibold text-white">${p.name}</p>
                        <p class="text-gray-400 text-sm">Playlist</p>
                    </div>
                </a>`;
        });
    }


    if (html === '') {
        html = '<p class="p-4 text-gray-400">Nenhum resultado encontrado.</p>';
    }

    container.innerHTML = html;
    container.classList.remove('hidden');
}
