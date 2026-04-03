// album.js

import { db } from './main.js'; // Garante que exportaste o 'db' no teu main.js
import { doc, getDoc, collection, query, where, getDocs, orderBy } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

async function initAlbumPage() {
    const params = new URLSearchParams(window.location.search);
    const albumId = params.get('id');

    if (!albumId) {
        console.error("ID do álbum não encontrado na URL");
        return;
    }

    try {
        // 1. Carregar Detalhes do Álbum (Capa, Nome, Ano)
        const albumRef = doc(db, "albuns", albumId);
        const albumSnap = await getDoc(albumRef);

        if (albumSnap.exists()) {
            renderAlbumHeader(albumSnap.data());
            // 2. Carregar as Músicas deste Álbum
            loadAlbumTracks(albumId);
        } else {
            console.error("Álbum não existe no banco de dados");
        }
    } catch (error) {
        console.error("Erro ao carregar álbum:", error);
    }
}

// Preenche o cabeçalho (Capa e Título)
function renderAlbumHeader(data) {
    document.getElementById('album-title').textContent = data.album;
    document.getElementById('album-cover').src = data.cover || 'https://placehold.co/300';
    document.getElementById('artist-name').textContent = data.artist || "Artista";
}