import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyD4gKKJh59ljwOe0PDYaJSsfEp_7PMBD8s",
    authDomain: "tune-8cafb.firebaseapp.com",
    projectId: "tune-8cafb",
    storageBucket: "tune-8cafb.firebasestorage.app",
    messagingSenderId: "599729070480",
    appId: "1:599729070480:web:4b2a7d806a8b7732c39315"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// 🔁 Se já estiver logado, vai direto para o menu
onAuthStateChanged(auth, (user) => {
  if (user) {
    window.location.href = "menu.html";
  }
});

// ----------------------------------------------------------------------
// ▶️ Formulário de login (E-mail/Usuário e Senha)
// ----------------------------------------------------------------------
document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  // ⚠️ CORRIGIDO: Captura o valor do campo com o ID correto do novo HTML
  const email = document.getElementById("username_email").value.trim();
  const password = document.getElementById("password").value;

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // Validação básica
  if (!emailRegex.test(email)) {
    showToast("Digite um e-mail válido.");
    return;
  }

  if (password.length < 4) {
    showToast("A senha deve ter pelo menos 4 caracteres.");
    return;
  }

  // Tentar login
try {
  await signInWithEmailAndPassword(auth, email, password);
  window.location.href = "menu.html";
} catch (error) {
  if (error.code === "auth/user-not-found") {
    showToast("Este usuário não está cadastrado. Criando sua conta...");
    setTimeout(() => {
      // Redireciona para a página de Cadastro após a mensagem de erro
      window.location.href = "cadastro.html"; 
    }, 2000);
  } else if (error.code === "auth/wrong-password") {
    showToast("Senha incorreta.");
  } else if (error.code === "auth/invalid-login-credentials") {
    showToast("Seu e-mail ou senha estão incorretos.");
  } else {
    showToast("Erro ao fazer login: " + error.message);
  }
}
});



// ----------------------------------------------------------------------
// ▶️ Função de toast personalizado
// ----------------------------------------------------------------------
function showToast(message) {
  let toast = document.createElement("div");
  toast.innerText = message;
  
  // Estilos Tailwind para o Toast (fundo branco, texto preto para contraste)
  toast.className = "fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-white text-black px-4 py-2 rounded shadow-lg text-sm z-50 transition-all duration-300 ease-out";

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("opacity-0");
    setTimeout(() => toast.remove(), 500);
  }, 3000);
}