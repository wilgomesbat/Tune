import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

// Configuração do Firebase para a sua aplicação web (APENAS ESTA SEÇÃO)
const firebaseConfig = {
    apiKey: "AIzaSyD4gKKJh59ljwOe0PDYaJSsfEp_7PMBD8s",
    authDomain: "tune-8cafb.firebaseapp.com",
    projectId: "tune-8cafb",
    storageBucket: "tune-8cafb.appspot.com",
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
const logoutLink = document.getElementById('logout-link');
const userDisplayName = document.getElementById('user-display-name');
const userPlanName = document.getElementById('user-plan-name');
const userPlanDescription = document.getElementById('user-plan-description');

// --- Função para buscar e renderizar o perfil do usuário ---
async function fetchAndRenderUserProfile(user) {
    try {
        const userDocRef = doc(db, "usuarios", user.uid);
        const docSnap = await getDoc(userDocRef);

        const userData = docSnap.exists() ? docSnap.data() : {};

        // Atualiza a imagem de perfil
        if (userProfileImg) {
            userProfileImg.src = userData.foto || user.photoURL || './assets/artistpfp.png';
            userProfileImg.alt = userData.apelido || user.displayName || 'Profile Picture';
        }

        // Atualiza o nome de exibição
        if (userDisplayName) {
            userDisplayName.textContent = userData.apelido || user.displayName || 'Usuário';
        }

        // Atualiza as informações do plano
        if (userPlanName && userPlanDescription) {
            if (userData.plano) {
                userPlanName.textContent = userData.plano.nome;
                userPlanDescription.textContent = userData.plano.descricao;
            } else {
                userPlanName.textContent = 'Free';
                userPlanDescription.textContent = 'Escute e acesse gratuitamente onde quiser, sem pagar por nada.';
            }
        }
    } catch (err) {
        console.error("Erro ao buscar dados do usuário:", err);
    }
}

// --- Autenticação ---
onAuthStateChanged(auth, user => {
    if (user) {
        // Se o usuário estiver logado, busca e exibe as informações
        fetchAndRenderUserProfile(user);
    } else {
        // Se o usuário não estiver logado, exibe os placeholders
        if (userDisplayName) userDisplayName.textContent = 'Usuário';
        if (userPlanName) userPlanName.textContent = 'Free';
        if (userPlanDescription) userPlanDescription.textContent = 'Escute e acesse gratuitamente onde quiser, sem pagar por nada.';
        if (userProfileImg) userProfileImg.src = './assets/artistpfp.png';
    }
});

// --- Logout ---
if (logoutLink) {
    logoutLink.addEventListener('click', e => {
        e.preventDefault();
        signOut(auth)
            .then(() => window.location.reload())
            .catch(err => console.error("Erro logout:", err));
    });
}

// --- Lógica do Dropdown ---
if (userProfileButton && profileDropdown) {
    userProfileButton.addEventListener('click', (event) => {
        event.stopPropagation();
        profileDropdown.classList.toggle('hidden');
    });

    window.addEventListener('click', (event) => {
        if (!userProfileButton.contains(event.target) && !profileDropdown.contains(event.target)) {
            profileDropdown.classList.add('hidden');
        }
    });
}