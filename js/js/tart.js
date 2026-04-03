import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyD4gKKJh59ljwOe0PDYaJSsfEp_7PMBD8s",
    authDomain: "tune-8cafb.firebaseapp.com",
    projectId: "tune-8cafb",
    storageBucket: "tune-8cafb.firebasestorage.app",
    messagingSenderId: "599729070480",
    appId: "1:599729070480:web:4b2a7d806a8b7732c39315"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// --- Elementos do DOM ---
const userProfileContainer = document.getElementById('user_profile_sidebar');
const guestProfileContainer = document.getElementById('guest_profile_sidebar');
const userProfileImg = document.getElementById('user-profile-img');
const userProfileButton = document.getElementById('user-profile-button');
const profileDropdown = document.getElementById('user-dropdown-menu');
const userDropdownLinks = document.getElementById('user_dropdown_links');
const logoutLink = document.getElementById('logout-link');
const userDisplayName = document.getElementById('user-display-name');

const artistLink = document.getElementById('artist-link');
const artistLinkIcon = document.getElementById('artist-link-icon');
const artistLinkText = document.getElementById('artist-link-text');

// --- Função para buscar e renderizar o perfil do usuário ---
async function fetchAndRenderUserProfile(user) {
    try {
        const userDocRef = doc(db, "usuarios", user.uid);
        const userDocSnap = await getDoc(userDocRef);

        const userData = userDocSnap.exists() ? userDocSnap.data() : {};

        let profileName = userData.apelido || user.displayName || 'Usuário';
        let profilePhoto = userData.foto || user.photoURL || './assets/artistpfp.png';

        // Lógica para verificar se o usuário é um artista
        if (artistLink && artistLinkIcon && artistLinkText) {
            if (userData.artista === "true") {
                // Se for um artista, busca os dados da coleção "artistas"
                const artistDocRef = doc(db, "artistas", user.uid);
                const artistDocSnap = await getDoc(artistDocRef);
                const artistData = artistDocSnap.exists() ? artistDocSnap.data() : null;

                if (artistData) {
                    profileName = artistData.nome || profileName;
                    profilePhoto = artistData.foto || profilePhoto;
                }
                
                artistLink.href = "tuneartists.html";
                artistLinkText.textContent = "Painel";
                artistLinkIcon.classList.add('hidden');
            } else {
                artistLink.href = "#";
                artistLinkText.textContent = "Suporte";
                artistLinkIcon.classList.remove('hidden');
            }
        }

        // Atualiza a imagem e o nome de perfil com os dados obtidos
        userProfileImg.src = profilePhoto;
        userProfileImg.alt = profileName;

        if (userDisplayName) {
            userDisplayName.textContent = profileName;
        }

        userProfileContainer.classList.remove('hidden');
        guestProfileContainer.classList.add('hidden');

    } catch (err) {
        console.error("Erro ao buscar dados do usuário ou artista:", err);
        userProfileImg.src = './assets/artistpfp.png';
        if (userDisplayName) {
            userDisplayName.textContent = 'Usuário';
        }
    }
}

// --- Autenticação ---
onAuthStateChanged(auth, user => {
    if (user) {
        fetchAndRenderUserProfile(user);
    } else {
        userProfileContainer.classList.add('hidden');
        guestProfileContainer.classList.remove('hidden');
    }
});