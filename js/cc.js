import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";
import { getAuth, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

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

const registerForm = document.getElementById('registerForm');
const submitBtn = document.getElementById('submitBtn');
const nomeInput = document.getElementById('nome');
const emailInput = document.getElementById('email');
const senhaInput = document.getElementById('senha');
const termosCheckbox = document.getElementById('termos-uso');

// --- VERIFICAÇÃO DE MANUTENÇÃO ---
async function verificarManutencao() {
    const docRef = doc(db, "config", "status");
    try {
        const docSnap = await getDoc(docRef);
        if (docSnap.exists() && docSnap.data().manutencao) {
            window.location.href = "man";
        }
    } catch (e) { console.error(e); }
}
verificarManutencao();

// --- FUNÇÃO TOAST ---
function showToast(message, type = "error") {
    const targetContainer = document.getElementById('toast-container') || document.body;
    const toast = document.createElement('div');
    toast.className = `toast ${type === 'success' ? 'success' : 'error'}`;
    toast.textContent = message;
    targetContainer.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 500);
    }, 5000);
}

// ----------------------------------------------------------------------
// SUBMIT DO FORMULÁRIO (REGISTRO COM CLOUDINARY)
// ----------------------------------------------------------------------

registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
const nome = nomeInput.value.trim();
const user = nome; // Usando o nome como apelido, já que não tem campo "username"
const email = emailInput.value.trim();
const senha = senhaInput.value;

    // Validações básicas
    if (!nome || !user || !email || !senha) {
        showToast("Preencha todos os campos.");
        return;
    }
    
    submitBtn.disabled = true;
    submitBtn.innerText = "Criando...";

    try {
        // 1. Criar usuário no Firebase Auth
        const userCredential = await createUserWithEmailAndPassword(auth, email, senha);
        const userUid = userCredential.user.uid;

        // 2. Salvar nome de usuário para evitar duplicatas
        await setDoc(doc(db, "nomes", user.toLowerCase()), {
            uid: userUid,
            criadoEm: new Date().toISOString()
        });
        
        // 3. Organizar os dados (Removido o que não existe no formulário)
        const dadosUsuario = {
            email: email,
            apelido: user,
            nomeArtistico: nome,
            artista: "true", 
            admin: "false",
            verificado: "false",
            niveladmin: 0,
            aprovado: "true",
            seguidores: 0,
            banido: "false",
            instagram: "",
            twitter: "",
            youtube: "",
            streams: 0,
            status: "ativo",
            foto: "", // Como não tem upload, deixamos vazio para não dar erro
            criadoEm: new Date().toLocaleString('pt-BR'),
            uid: userUid
        };

        // 4. Salvar no Firestore
        await setDoc(doc(db, "usuarios", userUid), dadosUsuario);

        showToast("Conta criada com sucesso!", "success");

        // 5. Redirecionamento
        setTimeout(() => {
            if (dadosUsuario.aprovado === "false") {
                window.location.href = "welcome.html";
            } else {
                window.location.href = "index.html";
            }
        }, 2000);

    } catch (err) {
        console.error(err);
        let userMessage = 'Erro desconhecido. Tente novamente.';

        // Tratamento de erros específicos
        if (err.message.includes("Imagem maior que 2MB")) {
            userMessage = "A foto deve ter no máximo 2MB.";
        } else if (err.code === 'auth/email-already-in-use') {
            userMessage = 'O e-mail já está em uso.';
        } else if (err.code === 'auth/weak-password') {
            userMessage = 'A senha deve ter pelo menos 6 caracteres.';
        } else {
            userMessage = err.message || "Erro ao criar conta.";
        }
        
        showToast(userMessage);

    } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = "Criar";
    }
});

// --- VALIDAÇÃO DO BOTÃO ---
function checkFormReady() {
    const nome = nomeInput.value.trim();
    const email = emailInput.value.trim();
    const senha = senhaInput.value.trim();
    const termosAceitos = termosCheckbox.checked;

    if (nome && email && senha && termosAceitos) {
        submitBtn.style.opacity = "1";
        submitBtn.style.pointerEvents = "auto";
    } else {
        submitBtn.style.opacity = "0.5";
        submitBtn.style.pointerEvents = "none";
    }
}

[nomeInput, emailInput, senhaInput].forEach(input => {
    input.addEventListener('input', checkFormReady);
});
termosCheckbox.addEventListener('change', checkFormReady);

checkFormReady();