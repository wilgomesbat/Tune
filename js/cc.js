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

// Inicializa os serviços do Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

// --- Elementos do DOM ---
const profileFrame = document.querySelector('.profile-frame');
const profileIcon = document.querySelector('.profile-icon');
const registerForm = document.getElementById('registerForm');
const userInput = document.getElementById('user');

// Encontra o container pai, que é o form-group, para inserir o feedback corretamente
const formGroupUser = userInput.closest('.form-group');

const usernameFeedback = document.createElement('p');
usernameFeedback.classList.add('username-feedback');
formGroupUser.appendChild(usernameFeedback); // Insere o feedback no lugar certo

// --- Variáveis Globais ---
let profileFile = null;
let currentFileInput = null;
let isUsernameAvailable = false;
let debounceTimeout;


async function validarToken() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");

  if (!token) {
    window.location.href = "index.html";
    return;
  }

  const ref = doc(db, "tokens", token);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    window.location.href = "index.html";
    return;
  }

  const { expiresAt, used } = snap.data();

  if (Date.now() > expiresAt || used) {
    await deleteDoc(ref); // já limpa token inválido
    window.location.href = "index.html";
    return;
  }

  // ✅ Token válido → consome imediatamente
  await deleteDoc(ref); // apaga de vez (não dá pra usar mais)

  // segue normal a execução da página...
}

// --- Função para Exibir Toasts ---
function showToast(message, type) {
    const toastContainer = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    toastContainer.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => {
            toast.remove();
        }, 500); 
    }, 5000); 
}

// --- Handlers de Upload de Foto ---
function handleFileSelect(event) {
    const fileInput = event.target;
    profileFile = fileInput.files[0];
    console.log('Arquivo selecionado:', profileFile);

    if (profileFile) {
        const reader = new FileReader();
        reader.onload = (e) => {
            profileIcon.src = e.target.result;
        };
        reader.readAsDataURL(profileFile);
    } else {
        console.log('Seleção de arquivo cancelada ou fechada.');
    }

    fileInput.value = '';
    fileInput.removeEventListener('change', handleFileSelect);
    if (currentFileInput === fileInput) {
        currentFileInput = null;
    }
}

profileFrame.addEventListener('click', () => {
    if (currentFileInput) {
        console.log('Já existe um diálogo de arquivo aberto.');
        return; 
    }

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.style.display = 'none';

    fileInput.addEventListener('change', handleFileSelect);
    currentFileInput = fileInput;

    document.body.appendChild(fileInput);
    fileInput.click();
});

// --- Validação de Nome de Usuário em Tempo Real ---
userInput.addEventListener('input', () => {
    clearTimeout(debounceTimeout);
    isUsernameAvailable = false;
    
    // --- INÍCIO DA FORMATAÇÃO DO NOME DE USUÁRIO ---
    let username = userInput.value.trim(); // Remove espaços em branco do início e fim

    // Remove caracteres especiais e espaços internos, convertendo para minúsculas
    username = username
        .toLowerCase() // Converte para minúsculas
        .replace(/[^a-z0-9]/g, ''); // Remove tudo que NÃO for letra (a-z) ou número (0-9)

    // Atualiza o valor do input com o nome formatado (opcional, mas melhora a experiência do usuário)
    userInput.value = username; 
    // --- FIM DA FORMATAÇÃO DO NOME DE USUÁRIO ---

    // Limpa o feedback se o campo ficar vazio após a formatação
    if (username.length === 0) {
        usernameFeedback.textContent = '';
        usernameFeedback.style.color = '';
        return;
    }

    // Validação de comprimento mínimo (agora após a formatação)
    if (username.length < 3) {
        usernameFeedback.textContent = 'Nome de usuário muito curto.';
        usernameFeedback.style.color = '#e1a39eff';
        return;
    }

    usernameFeedback.textContent = 'Verificando...';
    usernameFeedback.style.color = '#fff';

    debounceTimeout = setTimeout(async () => {
        try {
            // Verifica a disponibilidade no Firestore usando o nome JÁ FORMATADO
            const usernameDocRef = doc(db, "nomes", username); // Usa o nome formatado diretamente
            const docSnap = await getDoc(usernameDocRef);

            if (docSnap.exists()) {
                usernameFeedback.textContent = 'Este nome de usuário já está em uso.';
                usernameFeedback.style.color = '#e1a39eff';
                isUsernameAvailable = false;
            } else {
                usernameFeedback.textContent = 'Disponível!';
                usernameFeedback.style.color = '#b3b3b3ff';
                isUsernameAvailable = true;
            }
        } catch (error) {
            console.error("Erro ao verificar nome de usuário:", error);
            usernameFeedback.textContent = 'Erro ao verificar. Tente novamente.';
            usernameFeedback.style.color = '#e1a39eff';
            isUsernameAvailable = false;
        }
    }, 500);
});



// --- Evento de Submissão do Formulário de Cadastro ---
registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const nome = document.getElementById('nome').value.trim();
    const user = document.getElementById('user').value.trim();
    const email = document.getElementById('email').value.trim();
    const senha = document.getElementById('senha').value;

    if (!nome || !user || !email || !senha) {
        showToast("Por favor, preencha todos os campos.", "error");
        return;
    }
    
    if (!isUsernameAvailable) {
        showToast("O nome de usuário não está disponível.", "error");
        return;
    }

    if (!profileFile) {
        showToast("Por favor, adicione uma foto de perfil.", "error");
        return;
    }

    try {
        // 1. Criar usuário no Firebase Auth
        const userCredential = await createUserWithEmailAndPassword(auth, email, senha);
        const userUid = userCredential.user.uid;

        // 2. Upload da foto para o Firebase Storage
        const storageRef = ref(storage, `fotos_perfil/${userUid}/${profileFile.name}`);
        await uploadBytes(storageRef, profileFile);
        const photoURL = await getDownloadURL(storageRef);

        // 3. Salvar o nome de usuário na coleção 'nomes'
        await setDoc(doc(db, "nomes", user.toLowerCase()), {
            uid: userUid,
            criadoEm: new Date().toISOString()
        });

        // 4. Salvar os dados do usuário no Firestore
        const userDocRef = doc(db, "usuarios", userUid);
        const agora = new Date();

        await setDoc(userDocRef, {
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
            criadoEm: agora.toLocaleString('pt-BR'),
            uid: userUid
        });

        showToast("Conta de artista criada com sucesso!", "success");
        setTimeout(() => window.location.href = "index.html", 4000);

    } catch (error) {
        console.error("Erro ao criar conta:", error);
        let errorMessage = "Ocorreu um erro desconhecido.";
        
        if (error.code === 'auth/email-already-in-use') {
            errorMessage = "Este email já está em uso. Tente outro.";
        } else if (error.code === 'auth/weak-password') {
            errorMessage = "Sua senha é muito fraca. Use uma combinação de letras, números e símbolos.";
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = "O formato do email é inválido.";
        } else if (error.code === 'storage/unauthorized') {
            errorMessage = "Permissão negada para fazer upload da foto. Verifique as regras de Storage.";
        } else {
            errorMessage = error.message;
        }
        showToast(`Erro: ${errorMessage}`, "error");
    } finally {
        profileFile = null;
        if (currentFileInput) {
            currentFileInput.remove();
            currentFileInput = null;
        }
    }
});