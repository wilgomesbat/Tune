import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";
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
const usernameStatusIcon = document.getElementById('username-status-icon');
const submitBtn = document.getElementById('submitBtn');
const nomeInput = document.getElementById('nome');
const userInputField = document.getElementById('user');
const emailInput = document.getElementById('email');
const senhaInput = document.getElementById('senha');
const imageInput = document.getElementById('profile-image-input');
const imageViewer = document.getElementById('profile-preview');
const termosCheckbox = document.getElementById('termos-uso');
const artistToggleButton = document.getElementById('artist-toggle-btn'); 


// Variáveis globais
let profileFile = null;
let isUsernameAvailable = false;
let debounceTimeout;
let isArtistSelected = false; // Deve começar como false (alpha 1.0)
// ----------------------------------------------------------------------
// FUNÇÕES DE UTILIDADE E INICIALIZAÇÃO (Manutencao e Toast)
// ----------------------------------------------------------------------

// Exemplo de lógica para colocar no seu arquivo de Login ou Auth check
auth.onAuthStateChanged(async (user) => {
    if (user) {
        const docSnap = await getDoc(doc(db, "usuarios", user.uid));
        if (docSnap.exists()) {
            const userData = docSnap.data();
            if (userData.aprovado === "false" && !window.location.href.includes("welcome")) {
                window.location.href = "welcome";
            }
        }
    }
});


// -------------------------------
// ☁️ Cloudinary (UPLOAD FRONT)
// -------------------------------
const CLOUD_NAME = "dsrrzjwuf";
const UPLOAD_PRESET = "tune_unsigned";

export async function uploadImageToCloudinary(file) {
    if (!file) throw new Error("Nenhum arquivo selecionado");

    if (file.size > 2 * 1024 * 1024) {
        throw new Error("Imagem maior que 2MB");
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", UPLOAD_PRESET);
    formData.append("folder", "tune/posts");

    const res = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
        { method: "POST", body: formData }
    );

    const data = await res.json();

    if (!data.secure_url) {
        console.error(data);
        throw new Error("Erro no upload");
    }

    return data.secure_url;
}

function showToast(message, type = "error") {
    const toastContainer = document.getElementById('toast-container');
    const targetContainer = toastContainer || document.body;
    
    const toast = document.createElement('div');
    
    const baseClass = 'fixed bottom-6 left-1/2 transform -translate-x-1/2 text-white px-4 py-2 rounded shadow-lg text-sm z-50 transition-opacity duration-300';
    const typeClass = type === 'success' ? 'bg-green-600' : 'bg-red-600';

    toast.className = `${baseClass} ${typeClass}`;
    toast.textContent = message;
    targetContainer.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('opacity-0');
        setTimeout(() => toast.remove(), 500);
    }, 5000);
}



// ----------------------------------------------------------------------
// EVENTOS DE UPLOAD DE FOTO
// ----------------------------------------------------------------------

imageInput.addEventListener('change', e => {
  if (!e.target.files || e.target.files.length === 0) return;

  profileFile = e.target.files[0];
  const reader = new FileReader();

  reader.onload = () => {
    imageViewer.src = reader.result;
    checkFormReady();
  };

  reader.readAsDataURL(profileFile);
});

// ----------------------------------------------------------------------
// EVENTOS DE VALIDAÇÃO (Username)
// ----------------------------------------------------------------------

userInput.addEventListener('input', () => {
    clearTimeout(debounceTimeout);
    isUsernameAvailable = false;

    usernameStatusIcon.classList.remove('success', 'error', 'visible');

    let username = userInput.value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    userInput.value = username;

    if (!username) {
        checkFormReady();
        return;
    }

    if (username.length < 3) {
        usernameStatusIcon.src = "assets/cancel_50dp_FFFFFF_FILL0_wght400_GRAD0_opsz48.svg";
        usernameStatusIcon.classList.remove('success');
        usernameStatusIcon.classList.add('error', 'visible');
        checkFormReady();
        return;
    }

debounceTimeout = setTimeout(async () => {
    try {
        const usernameDocRef = doc(db, "nomes", username);
        const docSnap = await getDoc(usernameDocRef);
        
        if (docSnap.exists()) {
            usernameStatusIcon.src = "assets/cancel_50dp_FFFFFF_FILL0_wght400_GRAD0_opsz48.svg";
            usernameStatusIcon.classList.remove('success');
            usernameStatusIcon.classList.add('error', 'visible');
            isUsernameAvailable = false;
        } else {
            usernameStatusIcon.src = "assets/check_circle_50dp_FFFFFF_FILL0_wght400_GRAD0_opsz48.svg";
            usernameStatusIcon.classList.remove('error');
            usernameStatusIcon.classList.add('success', 'visible');
            isUsernameAvailable = true;
        }
    } catch (err) {
        console.error(err);
        usernameStatusIcon.src = "assets/cancel_50dp_FFFFFF_FILL0_wght400_GRAD0_opsz48.svg";
        usernameStatusIcon.classList.remove('success');
        usernameStatusIcon.classList.add('error', 'visible');
        isUsernameAvailable = false;
    }
    checkFormReady();
}, 500);
});
// ----------------------------------------------------------------------
// SUBMIT DO FORMULÁRIO (REGISTRO COMPLETO)
// ----------------------------------------------------------------------

registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const nome = nomeInput.value.trim();
    const user = userInputField.value.trim();
    const email = emailInput.value.trim();
    const senha = senhaInput.value;

    // 1. Validações Iniciais
    if (!nome || !user || !email || !senha) {
        showToast("Preencha todos os campos.");
        return;
    }

    if (!isUsernameAvailable) {
        showToast("Nome de usuário não disponível.");
        return;
    }

    if (!profileFile) {
        showToast("Adicione uma foto de perfil.");
        return;
    }
    
    // Bloqueia o botão para evitar cliques duplos
    submitBtn.disabled = true;
    submitBtn.innerText = "Processando...";

    try {
        // 2. Upload da foto para o Cloudinary (Substituindo Firebase Storage)
        // Isso resolve o erro de CORS que você estava tendo com o Google
        let photoURL;
        try {
            photoURL = await uploadImageToCloudinary(profileFile);
        } catch (uploadError) {
            console.error("Erro Cloudinary:", uploadError);
            throw new Error("Falha ao subir imagem. Tente uma foto menor ou outro formato.");
        }

        // 3. Criar usuário no Firebase Auth
        const userCredential = await createUserWithEmailAndPassword(auth, email, senha);
        const userUid = userCredential.user.uid;

        // 4. Salvar nome de usuário (para garantir que ninguém use o mesmo)
        await setDoc(doc(db, "nomes", user.toLowerCase()), {
            uid: userUid,
            criadoEm: new Date().toISOString()
        });
        
        // 5. Definir os dados do usuário (Status aprovado: "false")
        const dadosUsuario = {
            email: email,
            apelido: user,
            nomeArtistico: nome,
            artista: "true", 
            admin: "false",
            verificado: "false",
            niveladmin: 0,
            aprovado: "false", // Será verificado para redirecionamento
            seguidores: 0,
            banido: "false",
            instagram: "",
            twitter: "",
            youtube: "",
            streams: 0,
            status: "ativo",
            foto: photoURL, // URL retornada pelo Cloudinary
            criadoEm: new Date().toLocaleString('pt-BR'),
            uid: userUid
        };

        // 6. Salvar no Firestore
        await setDoc(doc(db, "usuarios", userUid), dadosUsuario);

        showToast("Conta criada com sucesso!", "success");

        // 7. Lógica de Redirecionamento (72h / Welcome)
        setTimeout(() => {
            // Se aprovado for "false", vai para a tela de análise
            if (dadosUsuario.aprovado === "false") {
                window.location.href = "welcome.html";
            } else {
                window.location.href = "index.html";
            }
        }, 2000);

    } catch (err) {
        console.error("Erro completo no registro:", err);
        let userMessage = 'Erro ao criar conta. Tente novamente.';

        // Tratamento amigável de erros do Firebase
        if (err.code === 'auth/email-already-in-use') {
            userMessage = 'Este e-mail já está cadastrado.';
        } else if (err.code === 'auth/weak-password') {
            userMessage = 'A senha precisa de pelo menos 6 dígitos.';
        } else if (err.message) {
            userMessage = err.message;
        }
        
        showToast(userMessage);
        submitBtn.disabled = false;
        submitBtn.innerText = "Criar";
    }
});

// ----------------------------------------------------------------------
// LÓGICA DO BOTÃO DINÂMICO
// ----------------------------------------------------------------------

function checkFormReady() {
    const nome = nomeInput.value.trim();
    const user = userInputField.value.trim();
    const email = emailInput.value.trim();
    const senha = senhaInput.value.trim();


    if (nome && user && email && senha && profileFile && isUsernameAvailable) {
        submitBtn.style.opacity = "1";
        submitBtn.style.pointerEvents = "auto";
    } else {
        submitBtn.style.opacity = "0.5";
        submitBtn.style.pointerEvents = "none";
    }
}

// Eventos de input para atualizar dinamicamente o estado do botão
[nomeInput, userInputField, emailInput, senhaInput, termosCheckbox].forEach(input => {
    input.addEventListener('input', checkFormReady);
    if (input.type === 'checkbox') {
        input.addEventListener('change', checkFormReady);
    }
});

checkFormReady();