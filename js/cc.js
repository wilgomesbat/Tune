import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";
import { getAuth, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-storage.js";

const firebaseConfig = {
    apiKey: "AIzaSyD4gKKJh59ljwOe0PDYaJSsfEp_7PMBD8s",
    authDomain: "tune-8cafb.firebaseapp.com",
    projectId: "tune-8cafb",
    storageBucket: "tune-8cafb.firebasestorage.app",
    messagingSenderId: "599729070480",
    appId: "1:599729070480:web:4b2a7d806a8b7732c39315"
};

// Inicializa serviços
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

// Elementos do DOM
const registerForm = document.getElementById('registerForm');
const userInput = document.getElementById('user');
const tokenInput = document.getElementById('token'); // input para código
const tokenFeedback = document.getElementById('token-feedback');
const profileFrame = document.querySelector('.profile-frame');
const profileIcon = document.querySelector('.profile-icon');

const formGroupUser = userInput.closest('.form-group');
const usernameFeedback = document.createElement('p');
formGroupUser.appendChild(usernameFeedback);

// Variáveis globais
let profileFile = null;
let currentFileInput = null;
let isUsernameAvailable = false;
let debounceTimeout;
let isTokenValid = false;

// --- Upload de foto ---
function handleFileSelect(event) {
    const fileInput = event.target;
    profileFile = fileInput.files[0];

    if (profileFile) {
        const reader = new FileReader();
        reader.onload = (e) => profileIcon.src = e.target.result;
        reader.readAsDataURL(profileFile);
    }

    fileInput.value = '';
    fileInput.removeEventListener('change', handleFileSelect);
    if (currentFileInput === fileInput) currentFileInput = null;
}

profileFrame.addEventListener('click', () => {
    if (currentFileInput) return;
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.style.display = 'none';
    fileInput.addEventListener('change', handleFileSelect);
    currentFileInput = fileInput;
    document.body.appendChild(fileInput);
    fileInput.click();
});

// --- Toast ---
function showToast(message, type) {
    const toastContainer = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 500);
    }, 5000);
}

// --- Validação de username ---
userInput.addEventListener('input', () => {
    clearTimeout(debounceTimeout);
    isUsernameAvailable = false;

    let username = userInput.value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    userInput.value = username;

    if (!username) {
        usernameFeedback.textContent = '';
        return;
    }

    if (username.length < 3) {
        usernameFeedback.textContent = 'Nome de usuário muito curto.';
        usernameFeedback.style.color = '#e1a39eff';
        return;
    }

    usernameFeedback.textContent = 'Verificando...';
    usernameFeedback.style.color = '#fff';

    debounceTimeout = setTimeout(async () => {
        try {
            const usernameDocRef = doc(db, "nomes", username);
            const docSnap = await getDoc(usernameDocRef);
            if (docSnap.exists()) {
                usernameFeedback.textContent = 'Nome de usuário já em uso.';
                usernameFeedback.style.color = '#e1a39eff';
                isUsernameAvailable = false;
            } else {
                usernameFeedback.textContent = 'Disponível!';
                usernameFeedback.style.color = '#b3b3b3ff';
                isUsernameAvailable = true;
            }
        } catch (err) {
            console.error(err);
            usernameFeedback.textContent = 'Erro ao verificar.';
            usernameFeedback.style.color = '#e1a39eff';
            isUsernameAvailable = false;
        }
    }, 500);
});

// --- Validação de token ---
async function validarTokenCode(tokenCode) {
    const q = query(collection(db, "tokens"), where("tokenCode", "==", tokenCode));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) return false;

    const docSnap = querySnapshot.docs[0];
    const data = docSnap.data();

    if (data.used || Date.now() > data.expiresAt) return false;

    return { id: docSnap.id, ...data };
}

// --- Submit do formulário ---
registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const tokenCode = tokenInput.value.trim();
    if (!tokenCode) {
        showToast("Insira o código de verificação.", "error");
        return;
    }

    const tokenDoc = await validarTokenCode(tokenCode);
    if (!tokenDoc) {
        showToast("Código de verificação inválido.", "error");
        return;
    }

    const nome = document.getElementById('nome').value.trim();
    const user = userInput.value.trim();
    const email = document.getElementById('email').value.trim();
    const senha = document.getElementById('senha').value;

    if (!nome || !user || !email || !senha) {
        showToast("Preencha todos os campos.", "error");
        return;
    }

    if (!isUsernameAvailable) {
        showToast("Nome de usuário não disponível.", "error");
        return;
    }

    if (!profileFile) {
        showToast("Adicione uma foto de perfil.", "error");
        return;
    }

    try {
        // Marcar token como usado
        await setDoc(doc(db, "tokens", tokenDoc.id), { used: true }, { merge: true });

        // Criar usuário
        const userCredential = await createUserWithEmailAndPassword(auth, email, senha);
        const userUid = userCredential.user.uid;

        // Upload da foto
        const storageRef = ref(storage, `fotos_perfil/${userUid}/${profileFile.name}`);
        await uploadBytes(storageRef, profileFile);
        const photoURL = await getDownloadURL(storageRef);

        // Salvar nome de usuário
        await setDoc(doc(db, "nomes", user.toLowerCase()), {
            uid: userUid,
            criadoEm: new Date().toISOString()
        });

        // Salvar dados do usuário
        await setDoc(doc(db, "usuarios", userUid), {
            email,
            apelido: user,
            nomeArtistico: nome,
            artista: "true",
            admin: 0,
            verificado: "false",
            niveladmin: 0,
            seguidores: 0,
            banido: "false",
            instagram: "",
            twitter: "",
            youtube: "",
            streams: 0,
            status: "ativo",
            foto: photoURL,
            criadoEm: new Date().toLocaleString('pt-BR'),
            uid: userUid
        });

        showToast("Conta criada com sucesso!", "success");
        setTimeout(() => window.location.href = "index.html", 4000);

    } catch (err) {
        console.error(err);
        showToast(`Erro: ${err.message}`, "error");
    } finally {
        profileFile = null;
        if (currentFileInput) {
            currentFileInput.remove();
            currentFileInput = null;
        }
    }
});
