const API_BASE_URL = 'http://localhost:8080/api'; // Ajuste se seu backend rodar em outra porta
const AUTH_BASE_URL = 'http://localhost:8080/auth'; // Ajuste para autenticação
const PASSWORD_RESET_BASE_URL = 'http://localhost:8080/password-reset'; // Novo endpoint para redefinição de senha

let currentChallenge = null;
let userToken = localStorage.getItem('jwtToken');
let loggedInUser = null;
let currentResetEmail = null; // Para armazenar o email durante o fluxo de redefinição de senha

let sessionId = localStorage.getItem('sessionId'); // Variável global para o Session ID

// Elementos do DOM
const imagemElement = document.getElementById("imagemDoJogo");
const inputJogo = document.getElementById("inputJogo");
const mensagem = document.getElementById("mensagem");
const listaJogos = document.getElementById("listaJogos");
const remainingGuessesElement = document.getElementById("remainingGuesses");
const frameNavigation = document.getElementById("frameNavigation");
const userProfileDiv = document.getElementById("userProfile");
const challengeDateElement = document.getElementById("challengeDate");
const rankingListElement = document.getElementById("rankingList");
const suggestionsDatalist = document.getElementById('suggestions');

// Modals
const loginModal = document.getElementById('loginModal');
const registerModal = document.getElementById('registerModal');
const forgotPasswordModal = document.getElementById('forgotPasswordModal');
const resetCodeModal = document.getElementById('resetCodeModal');
const newPasswordModal = document.getElementById('newPasswordModal');

// Forms
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const forgotPasswordForm = document.getElementById('forgotPasswordForm');
const resetCodeForm = document.getElementById('resetCodeForm');
const newPasswordForm = document.getElementById('newPasswordForm');

// Messages
const loginMessage = document.getElementById('loginMessage');
const registerMessage = document.getElementById('registerMessage');
const forgotMessage = document.getElementById('forgotMessage');
const resetCodeMessage = document.getElementById('resetCodeMessage');
const newPasswordMessage = document.getElementById('newPasswordMessage');

/**
 * Função para gerar um UUID (Identificador Único Universal) v4.
 * Usado para criar um Session ID único para usuários anônimos.
 * Fonte: https://stackoverflow.com/questions/105034/how-to-create-a-guid-uuid
 */
function generateUuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * Função para formatar a data ignorando o timezone,
 * retornando a data no formato DD/MM/YYYY exatamente da string ISO recebida
 */
function formatDateWithoutTimezone(dateString) {
    const [year, month, day] = dateString.split('T')[0].split('-');
    return `${day}/${month}/${year}`;
}

/**
 * Função que retorna os headers adequados para a requisição.
 * Prioriza o JWT se o usuário estiver logado, caso contrário, envia o Session ID
 * para rotas onde o backend precisa rastrear usuários anônimos.
 * @param {string} fullRoute - A rota completa que está sendo chamada.
 * @param {boolean} isJson - Indica se o Content-Type deve ser 'application/json'.
 * @returns {Object} Headers para a requisição.
 */
function getHeadersForRoute(fullRoute, isJson = false) {
    let headers = {};

    if (isJson) {
        headers['Content-Type'] = 'application/json';
    }

    // Se houver um JWT válido, sempre o envie
    if (userToken && userToken !== 'null' && userToken !== 'undefined') {
        headers['Authorization'] = `Bearer ${userToken}`;
    } else {
        // Se NÃO houver JWT (usuário anônimo), mas houver um Session ID, envie-o.
        // Isso é crucial para que o backend rastreie usuários anônimos em /challenge/today e /challenge/try
        if (sessionId) {
            headers['X-Session-ID'] = sessionId;
        }
    }
    return headers;
}

// Listeners de Eventos
document.addEventListener('DOMContentLoaded', () => {
    // Inicializa o Session ID para usuários anônimos
    if (!sessionId) {
        sessionId = generateUuidv4();
        localStorage.setItem('sessionId', sessionId);
        console.log("Novo Session ID gerado e guardado:", sessionId);
    } else {
        console.log("Session ID existente:", sessionId);
    }

    checkUserLoginStatus();
    fetchDailyChallenge();
    fetchWeeklyRanking();
    inputJogo.addEventListener('input', handleInputChange);
    inputJogo.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            submitGuess();
        }
    });
});

async function checkUserLoginStatus() {
    if (userToken) {
        try {
            const response = await fetch(`${AUTH_BASE_URL}/profile`, {
                headers: getHeadersForRoute(`${AUTH_BASE_URL}/profile`)
            });
            if (response.ok) {
                loggedInUser = await response.json();
                displayUserProfile(loggedInUser.name || loggedInUser.nickname || loggedInUser.email);
            } else {
                console.error("Falha ao buscar perfil do usuário, token inválido ou expirado. Status:", response.status);
                clearUserSession();
            }
        } catch (error) {
            console.error("Erro ao verificar status de login do usuário:", error);
            clearUserSession();
        }
    } else {
        displayLoginButton();
    }
}

function displayUserProfile(username) {
    userProfileDiv.innerHTML = `<span>Olá, ${username}!</span> <button onclick="logout()">Sair</button>`;
}

function displayLoginButton() {
    userProfileDiv.innerHTML = `<button onclick="showLogin()">Login</button>`;
}

function clearUserSession() {
    localStorage.removeItem('jwtToken');
    userToken = null;
    loggedInUser = null;
    displayLoginButton();
}

async function login(identifier, password) {
    try {
        const response = await fetch(`${AUTH_BASE_URL}/login`, {
            method: 'POST',
            headers: getHeadersForRoute(`${AUTH_BASE_URL}/login`, true),
            body: JSON.stringify({ identifier, password })
        });

        const data = await response.json();
        if (response.ok) {
            localStorage.setItem('jwtToken', data.token);
            userToken = data.token;
            localStorage.removeItem('sessionId'); // Remove session ID on login
            sessionId = null;
            await checkUserLoginStatus();
            await fetchDailyChallenge();
            closeModal();
            displayMessage('', 'info');
        } else {
            displayMessage(data.message || "Credenciais inválidas. Verifique seu email/nickname e senha.", "error", loginMessage);
        }
    } catch (error) {
        console.error("Erro ao fazer login:", error);
        displayMessage("Erro ao conectar com o servidor. Tente novamente mais tarde.", "error", loginMessage);
    }
}

async function register(name, nickname, email, password) {
    try {
        const response = await fetch(`${AUTH_BASE_URL}/register`, {
            method: 'POST',
            headers: getHeadersForRoute(`${AUTH_BASE_URL}/register`, true),
            body: JSON.stringify({ name, nickname, email, password })
        });

        const data = await response.json();
        if (response.ok) {
            localStorage.setItem('jwtToken', data.token);
            userToken = data.token;
            localStorage.removeItem('sessionId'); // Remove session ID on register
            sessionId = null;
            await checkUserLoginStatus();
            await fetchDailyChallenge();
            closeModal();
            displayMessage('', 'info', registerMessage);
        } else {
            displayMessage(data.message || "Erro ao registrar usuário. Tente outro email ou nickname.", "error", registerMessage);
        }
    } catch (error) {
        console.error("Erro ao registrar:", error);
        displayMessage("Erro ao conectar com o servidor. Tente novamente mais tarde.", "error", registerMessage);
    }
}

// --- Funções para o fluxo de "Esqueceu a Senha" ---
async function requestPasswordResetCode(email) {
    try {
        const response = await fetch(`${PASSWORD_RESET_BASE_URL}/request-code`, {
            method: 'POST',
            headers: getHeadersForRoute(`${PASSWORD_RESET_BASE_URL}/request-code`, true),
            body: JSON.stringify({ email })
        });
        const data = await response.json();
        if (response.ok) {
            currentResetEmail = email;
            displayMessage(data.message || "Código de redefinição enviado para seu email.", "success", forgotMessage);
            setTimeout(showResetCodeForm, 1500);
        } else {
            displayMessage(data.message || "Erro ao solicitar código. Verifique o email.", "error", forgotMessage);
        }
    } catch (error) {
        console.error("Erro ao solicitar código de redefinição:", error);
        displayMessage("Erro ao conectar com o servidor.", "error", forgotMessage);
    }
}

async function confirmPasswordResetCode(code) {
    if (!currentResetEmail) {
        displayMessage("Por favor, comece o processo de redefinição de senha novamente.", "error", resetCodeMessage);
        showForgotPassword();
        return;
    }
    try {
        const response = await fetch(`${PASSWORD_RESET_BASE_URL}/confirm-code`, {
            method: 'POST',
            headers: getHeadersForRoute(`${PASSWORD_RESET_BASE_URL}/confirm-code`, true),
            body: JSON.stringify({ email: currentResetEmail, code })
        });
        const data = await response.json();
        if (response.ok) {
            displayMessage(data.message || "Código confirmado com sucesso!", "success", resetCodeMessage);
            setTimeout(showNewPasswordForm, 1500);
        } else {
            displayMessage(data.message || "Código inválido ou expirado.", "error", resetCodeMessage);
        }
    } catch (error) {
        console.error("Erro ao confirmar código:", error);
        displayMessage("Erro ao conectar com o servidor.", "error", resetCodeMessage);
    }
}

async function resetPassword(newPassword, confirmNewPassword) {
    if (newPassword !== confirmNewPassword) {
        displayMessage("As senhas não coincidem.", "error", newPasswordMessage);
        return;
    }
    if (!currentResetEmail) {
        displayMessage("Erro: email não registrado para redefinição. Comece novamente.", "error", newPasswordMessage);
        showForgotPassword();
        return;
    }
    try {
        const response = await fetch(`${PASSWORD_RESET_BASE_URL}/reset-password`, {
            method: 'POST',
            headers: getHeadersForRoute(`${PASSWORD_RESET_BASE_URL}/reset-password`, true),
            body: JSON.stringify({ email: currentResetEmail, newPassword })
        });
        const data = await response.json();
        if (response.ok) {
            displayMessage(data.message || "Senha redefinida com sucesso! Redirecionando para login...", "success", newPasswordMessage);
            currentResetEmail = null;
            setTimeout(showLogin, 2000);
        } else {
            displayMessage(data.message || "Erro ao redefinir senha.", "error", newPasswordMessage);
        }
    } catch (error) {
        console.error("Erro ao redefinir senha:", error);
        displayMessage("Erro ao conectar com o servidor.", "error", newPasswordMessage);
    }
}

// --- Funções de exibição de Modais ---
function showLogin() {
    loginModal.style.display = 'flex';
    registerModal.style.display = 'none';
    forgotPasswordModal.style.display = 'none';
    resetCodeModal.style.display = 'none';
    newPasswordModal.style.display = 'none';
    loginMessage.textContent = '';
    loginForm.reset();
}

function showRegister() {
    registerModal.style.display = 'flex';
    loginModal.style.display = 'none';
    forgotPasswordModal.style.display = 'none';
    resetCodeModal.style.display = 'none';
    newPasswordModal.style.display = 'none';
    registerMessage.textContent = '';
    registerForm.reset();
}

function showForgotPassword() {
    forgotPasswordModal.style.display = 'flex';
    loginModal.style.display = 'none';
    registerModal.style.display = 'none';
    resetCodeModal.style.display = 'none';
    newPasswordModal.style.display = 'none';
    forgotMessage.textContent = '';
    forgotPasswordForm.reset();
}

function showResetCodeForm() {
    resetCodeModal.style.display = 'flex';
    forgotPasswordModal.style.display = 'none';
    loginModal.style.display = 'none';
    newPasswordModal.style.display = 'none';
    resetCodeMessage.textContent = '';
    resetCodeForm.reset();
}

function showNewPasswordForm() {
    newPasswordModal.style.display = 'flex';
    resetCodeModal.style.display = 'none';
    loginModal.style.display = 'none';
    newPasswordMessage.textContent = '';
    newPasswordForm.reset();
}

function closeModal() {
    loginModal.style.display = 'none';
    registerModal.style.display = 'none';
    forgotPasswordModal.style.display = 'none';
    resetCodeModal.style.display = 'none';
    newPasswordModal.style.display = 'none';
}

// --- Listeners de submissão de formulários ---
loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const identifier = document.getElementById('loginIdentifier').value;
    const password = document.getElementById('loginPassword').value;
    login(identifier, password);
});

registerForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('registerName').value;
    const nickname = document.getElementById('registerNickname').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    register(name, nickname, email, password);
});

forgotPasswordForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('forgotEmail').value;
    requestPasswordResetCode(email);
});

resetCodeForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const code = document.getElementById('resetCode').value;
    confirmPasswordResetCode(code);
});

newPasswordForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const newPassword = document.getElementById('newPassword').value;
    const confirmNewPassword = document.getElementById('confirmNewPassword').value;
    resetPassword(newPassword, confirmNewPassword);
});

// --- Lógica de Jogo (Imagens e Botões) ---

async function fetchDailyChallenge() {
    console.log("[IMAGEM LOG] Início de fetchDailyChallenge.");
    try {
        const requestHeaders = getHeadersForRoute(`${API_BASE_URL}/challenge/today`);
        console.log("[IMAGEM LOG] Headers para /challenge/today:", requestHeaders);

        const response = await fetch(`${API_BASE_URL}/challenge/today`, {
            headers: requestHeaders
        });
        if (!response.ok) {
            throw new Error(`Erro HTTP! status: ${response.status}`);
        }
        currentChallenge = await response.json();
        console.log("[IMAGEM LOG] currentChallenge recebido:", currentChallenge);
        console.log("[IMAGEM LOG] currentChallenge.frames:", currentChallenge.frames);

        challengeDateElement.textContent = `Desafio de ${formatDateWithoutTimezone(currentChallenge.date)}`;

        const imageUrl = `http://localhost:8080/image-proxy?url=${encodeURIComponent(currentChallenge.frames[0])}`;
        console.log("[IMAGEM LOG] Definindo imagem inicial para:", imageUrl);
        imagemElement.src = imageUrl;
        remainingGuessesElement.textContent = `Tentativas restantes: ${currentChallenge.remainingGuesses}`;

        const framesInitiallyShown = (5 - currentChallenge.remainingGuesses) + 1;
        console.log("[IMAGEM LOG] Frames inicialmente visíveis para botões:", framesInitiallyShown);
        renderFrameButtons(framesInitiallyShown);

        listaJogos.innerHTML = "";
        updateGameState(currentChallenge.remainingGuesses, false);
        displayMessage('', 'info');
    } catch (error) {
        console.error("Erro ao buscar o desafio diário:", error);
        displayMessage("Não foi possível carregar o desafio de hoje. Tente novamente mais tarde.", "error");
        inputJogo.disabled = true;
        document.querySelector('.game button').disabled = true;
    }
}

async function submitGuess() {
    console.log("[IMAGEM LOG] Início de submitGuess.");
    const guess = inputJogo.value.trim();
    if (guess === "") {
        displayMessage("Por favor, digite um palpite!", "error");
        return;
    }

    inputJogo.disabled = true;
    document.querySelector('.game button').disabled = true;

    try {
        const requestHeaders = getHeadersForRoute(`${API_BASE_URL}/challenge/try`, true);
        console.log("[IMAGEM LOG] Headers para /challenge/try:", requestHeaders);

        const response = await fetch(`${API_BASE_URL}/challenge/try`, {
            method: 'POST',
            headers: requestHeaders,
            body: JSON.stringify({ guess: guess })
        });

        if (response.status === 400) {
            const errorData = await response.json();
            displayMessage(errorData.message || "Erro ao processar o palpite.", "error");
            inputJogo.disabled = false;
            document.querySelector('.game button').disabled = false;
            return;
        }

        if (!response.ok) {
            throw new Error(`Erro HTTP! status: ${response.status}`);
        }

        const result = await response.json();
        console.log("[IMAGEM LOG] Resultado da tentativa (result):", result);

        let newGuessItem = document.createElement("li");
        newGuessItem.textContent = guess;

        if (result.isCorrect) {
            displayMessage(`Parabéns! Você acertou: ${result.challengeAnswer}!`, "success");
            newGuessItem.classList.add('correct-guess');
            const imageUrl = `http://localhost:8080/image-proxy?url=${encodeURIComponent(currentChallenge.frames[currentChallenge.frames.length - 1])}`;
            console.log("[IMAGEM LOG] Acertou! Definindo imagem final para:", imageUrl);
            imagemElement.src = imageUrl;
            inputJogo.disabled = true;
            document.querySelector('.game button').disabled = true;
            console.log("[IMAGEM LOG] Renderizando TODOS os botões de frame após acerto.");
            renderFrameButtons(currentChallenge.frames.length);
        } else {
            displayMessage("Você errou. Tente novamente!", "error");
            newGuessItem.classList.add('incorrect-guess');

            const nextFrameIndexToShow = result.order + 1;
            const actualFrameToShow = Math.min(nextFrameIndexToShow, currentChallenge.frames.length - 1);
            const imageUrl = `http://localhost:8080/image-proxy?url=${encodeURIComponent(currentChallenge.frames[actualFrameToShow])}`;
            console.log(`[IMAGEM LOG] Errou. Próximo frame a ser mostrado (índice ${actualFrameToShow}):`, imageUrl);
            imagemElement.src = imageUrl;
            remainingGuessesElement.textContent = `Tentativas restantes: ${result.remainingGuesses}`;

            const framesToRenderButtons = (result.order + 1) + 1;
            console.log("[IMAGEM LOG] Renderizando botões até o frame:", framesToRenderButtons);
            renderFrameButtons(framesToRenderButtons);

            if (result.remainingGuesses === 0 && !result.isCorrect) {
                displayMessage(`Suas tentativas acabaram! O desenho era: ${result.challengeAnswer}`, "error");
                inputJogo.disabled = true;
                document.querySelector('.game button').disabled = true;
                const finalImageUrl = `http://localhost:8080/image-proxy?url=${encodeURIComponent(currentChallenge.frames[currentChallenge.frames.length - 1])}`;
                console.log("[IMAGEM LOG] Fim das tentativas. Definindo imagem final para:", finalImageUrl);
                imagemElement.src = finalImageUrl;
                console.log("[IMAGEM LOG] Renderizando TODOS os botões de frame após fim das tentativas.");
                renderFrameButtons(currentChallenge.frames.length);
            } else {
                inputJogo.disabled = false;
                document.querySelector('.game button').disabled = false;
            }
        }

        listaJogos.prepend(newGuessItem);
        inputJogo.value = "";
        updateGameState(result.remainingGuesses, result.isCorrect);

    } catch (error) {
        console.error("Erro ao enviar palpite:", error);
        displayMessage("Ocorreu um erro ao processar seu palpite.", "error");
        inputJogo.disabled = false;
        document.querySelector('.game button').disabled = false;
    }
}

/**
 * Renderiza os botões de navegação dos frames.
 * @param {number} numFramesToRender O número total de frames para os quais botões devem ser criados (começando de 1).
 */
function renderFrameButtons(numFramesToRender) {
    console.log("[IMAGEM LOG] renderFrameButtons chamado com numFramesToRender:", numFramesToRender);
    frameNavigation.innerHTML = '';
    const actualNumButtons = Math.min(numFramesToRender, currentChallenge.frames.length);
    console.log("[IMAGEM LOG] Número REAL de botões a serem criados:", actualNumButtons);

    for (let i = 0; i < actualNumButtons; i++) {
        const button = document.createElement('button');
        button.textContent = i + 1;
        button.onclick = () => showSpecificFrame(i);
        frameNavigation.appendChild(button);
    }
}

/**
 * Exibe um frame específico do desafio com base no índice.
 * @param {number} frameIndex O índice (0-based) do frame a ser exibido do array `currentChallenge.frames`.
 */
function showSpecificFrame(frameIndex) {
    console.log("[IMAGEM LOG] showSpecificFrame chamado com frameIndex:", frameIndex);
    if (currentChallenge && currentChallenge.frames && currentChallenge.frames[frameIndex]) {
        const imageUrl = `http://localhost:8080/image-proxy?url=${encodeURIComponent(currentChallenge.frames[frameIndex])}`;
        console.log("[IMAGEM LOG] Definindo imagem para o frame:", frameIndex, "URL:", imageUrl);
        imagemElement.src = imageUrl;
    } else {
        console.warn("[IMAGEM LOG] Não foi possível mostrar o frame:", frameIndex, ". currentChallenge ou frames ausentes/inválidos.");
    }
}

function renderPreviousGuesses(guesses = []) {
    // Esta função é mantida, mas a lógica de carregar palpites persistidos do backend
    // para a lista de jogos dependeria de 'ChallengeDTO' incluir esses dados.
}

function updateGameState(remainingGuesses, isCorrect) {
    const isGameOver = isCorrect || remainingGuesses <= 0;
    inputJogo.disabled = isGameOver;
    document.querySelector('.game button').disabled = isGameOver;
}

/**
 * Exibe uma mensagem ao usuário com um tipo específico (para estilização).
 * @param {string} text - O texto da mensagem.
 * @param {string} type - O tipo da mensagem ('success', 'error', 'info').
 * @param {HTMLElement} [element=mensagem] - O elemento DOM onde a mensagem será exibida. Padrão é 'mensagem'.
 */
function displayMessage(text, type, element = mensagem) {
    element.textContent = text;
    element.className = `message ${type}`;
}

async function handleInputChange() {
    const input = inputJogo.value.trim().toLowerCase();
    suggestionsDatalist.innerHTML = '';

    if (input.length < 2) {
        return;
    }

    const potentialCartoonAnswers = [
        "Avatar: A Lenda de Aang", "Apenas um Show", "As Meninas Superpoderosas", "Ben 10",
        "Bob Esponja Calça Quadrada", "Caverna do Dragão", "Corrida Maluca", "Du, Dudu e Edu",
        "O Incrível Mundo de Gumball", "Os Simpsons", "Hora de Aventura", "Tom e Jerry",
        "Pernalonga", "Os Flintstones", "Looney Tunes", "Scooby-Doo", "Dragon Ball Z",
        "Pokémon", "Naruto", "Steven Universo", "Rick e Morty", "Gravity Falls",
        "Star vs. as Forças do Mal", "Kim Possible", "Phineas e Ferb", "A Família Addams",
        "Batman: A Série Animada", "Superman: A Série Animada", "Liga da Justiça",
        "X-Men: Evolution", "DuckTales", "Animaniacs", "Pinky e o Cérebro",
        "Hey Arnold!", "Rugrats", "A Turma da Mônica", "Jem e as Hologramas",
        "She-Ra: A Princesa do Poder", "He-Man e os Mestres do Universo", "ThunderCats",
        "Cavaleiros do Zodíaco", "Sailor Moon", "Digimon", "Yu-Gi-Oh!",
        "As Aventuras de Jackie Chan", "Coragem, o Cão Covarde", "Laboratório de Dexter",
        "A Vaca e o Frango"
    ];

    const filteredSuggestions = potentialCartoonAnswers.filter(cartoon =>
        cartoon.toLowerCase().includes(input)
    );

    filteredSuggestions.forEach(suggestion => {
        const option = document.createElement('option');
        option.value = suggestion;
        suggestionsDatalist.appendChild(option);
    });
}

async function fetchWeeklyRanking() {
    try {
        const response = await fetch(`${API_BASE_URL}/challenge/ranking/weekly`, {
            headers: getHeadersForRoute(`${API_BASE_URL}/challenge/ranking/weekly`)
        });
        if (!response.ok) {
            throw new Error(`Erro HTTP! status: ${response.status}`);
        }
        const rankingData = await response.json();

        rankingListElement.innerHTML = '';
        if (rankingData && rankingData.length > 0) {
            rankingData.forEach((user, index) => {
                let listItem = document.createElement('li');
                listItem.textContent = `${index + 1}. ${user.name || user.email} - ${user.score} pontos`;
                rankingListElement.appendChild(listItem);
            });
        } else {
            rankingListElement.innerHTML = '<li>Nenhum dado de ranking disponível.</li>';
        }
    } catch (error) {
        console.error("Erro ao buscar ranking semanal:", error);
        rankingListElement.innerHTML = '<li>Erro ao carregar ranking.</li>';
    }
}
