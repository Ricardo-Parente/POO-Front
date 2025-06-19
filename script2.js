const API_BASE_URL = 'http://localhost:8080/api'; // Ajuste se seu backend rodar em outra porta
const AUTH_BASE_URL = 'http://localhost:8080/auth'; // Ajuste para autenticação

let currentChallenge = null; // O desafio diário atual
let userToken = localStorage.getItem('jwtToken'); // Obtém o token do armazenamento local
let loggedInUser = null; // Informações do usuário logado

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

// Modais
const loginModal = document.getElementById('loginModal');
const registerModal = document.getElementById('registerModal');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const loginMessage = document.getElementById('loginMessage');
const registerMessage = document.getElementById('registerMessage');

// Listeners de Eventos
document.addEventListener('DOMContentLoaded', () => {
    checkUserLoginStatus();
    fetchDailyChallenge();
    fetchWeeklyRanking();
    inputJogo.addEventListener('input', handleInputChange);
    // Adiciona listener para submeter palpite ao pressionar Enter
    inputJogo.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            submitGuess();
        }
    });
});

/**
 * Verifica o status de login do usuário, validando o token JWT com o backend
 * e atualiza a interface do usuário.
 */
async function checkUserLoginStatus() {
    if (userToken) {
        try {
            // Assume que existe um endpoint /auth/profile no backend para obter informações do usuário
            const response = await fetch(`${AUTH_BASE_URL}/profile`, {
                headers: {
                    'Authorization': `Bearer ${userToken}`
                }
            });
            if (response.ok) {
                loggedInUser = await response.json(); // Espera um UserSummaryDTO
                displayUserProfile(loggedInUser.name || loggedInUser.email); // Assume 'name' ou 'email'
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

/**
 * Exibe as informações do perfil do usuário logado e um botão de sair.
 * @param {string} username O nome ou e-mail do usuário logado.
 */
function displayUserProfile(username) {
    userProfileDiv.innerHTML = `<span>Olá, ${username}!</span> <button onclick="logout()">Sair</button>`;
}

/**
 * Exibe um botão de login quando nenhum usuário está logado.
 */
function displayLoginButton() {
    userProfileDiv.innerHTML = `<button onclick="showLogin()">Login</button>`;
}

/**
 * Limpa a sessão do usuário, removendo o token JWT do armazenamento local.
 */
function clearUserSession() {
    localStorage.removeItem('jwtToken');
    userToken = null;
    loggedInUser = null;
    displayLoginButton();
}

/**
 * Lida com o login do usuário. Envia as credenciais para o backend e armazena o token JWT.
 * @param {string} email Email do usuário.
 * @param {string} password Senha do usuário.
 */
async function login(email, password) {
    try {
        const response = await fetch(`${AUTH_BASE_URL}/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();
        if (response.ok) {
            localStorage.setItem('jwtToken', data.token);
            userToken = data.token;
            await checkUserLoginStatus(); // Atualiza a interface com o nome de usuário
            await fetchDailyChallenge(); // Busca o desafio após o login para estado específico do usuário
            closeModal();
            displayMessage('', 'info'); // Limpa mensagens anteriores
        } else {
            displayMessage(data.message || "Credenciais inválidas. Verifique seu email e senha.", "error");
        }
    } catch (error) {
        console.error("Erro ao fazer login:", error);
        displayMessage("Erro ao conectar com o servidor. Tente novamente mais tarde.", "error");
    }
}

/**
 * Lida com o registro do usuário. Envia os detalhes do usuário para o backend e armazena o token JWT.
 * @param {string} name Nome do usuário.
 * @param {string} email Email do usuário.
 * @param {string} password Senha do usuário.
 */
async function register(name, email, password) {
    try {
        const response = await fetch(`${AUTH_BASE_URL}/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, email, password })
        });

        const data = await response.json();
        if (response.ok) {
            localStorage.setItem('jwtToken', data.token);
            userToken = data.token;
            await checkUserLoginStatus(); // Atualiza a interface com o nome de usuário
            await fetchDailyChallenge(); // Busca o desafio após o registro
            closeModal();
            displayMessage('', 'info'); // Limpa mensagens anteriores
        } else {
            displayMessage(data.message || "Erro ao registrar usuário. Tente outro email.", "error");
        }
    } catch (error) {
        console.error("Erro ao registrar:", error);
        displayMessage("Erro ao conectar com o servidor. Tente novamente mais tarde.", "error");
    }
}

/**
 * Faz logout do usuário e recarrega a página.
 */
function logout() {
    clearUserSession();
    location.reload(); // Recarrega para resetar o estado do jogo e da interface
}

/** Exibe o modal de login. */
function showLogin() {
    loginModal.style.display = 'flex';
    registerModal.style.display = 'none';
    loginMessage.textContent = ''; // Limpa mensagens anteriores
    loginForm.reset();
}

/** Exibe o modal de registro. */
function showRegister() {
    registerModal.style.display = 'flex';
    loginModal.style.display = 'none';
    registerMessage.textContent = ''; // Limpa mensagens anteriores
    registerForm.reset();
}

/** Esconde ambos os modais. */
function closeModal() {
    loginModal.style.display = 'none';
    registerModal.style.display = 'none';
}

// Submissões de formulário de Login e Registro
loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    login(email, password);
});

registerForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('registerName').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    register(name, email, password);
});

/**
 * Busca o desafio diário do backend.
 * Adaptação: Usa os campos disponíveis na ChallengeDTO do Java.
 * Como `currentFrameUrl`, `solved`, `framesShown` e `guesses`
 * NÃO estão no seu ChallengeDTO atual, essas funcionalidades
 * não serão totalmente suportadas na carga inicial ou precisarão
 * de lógica adicional no backend ou suposições no frontend.
 */
async function fetchDailyChallenge() {
    try {
        const headers = userToken ? { 'Authorization': `Bearer ${userToken}` } : {};
        const response = await fetch(`${API_BASE_URL}/today`, { headers });
        if (!response.ok) {
            throw new Error(`Erro HTTP! status: ${response.status}`);
        }
        currentChallenge = await response.json(); // currentChallenge é um ChallengeDTO (date, frames, remainingGuesses)

        challengeDateElement.textContent = `Desafio de ${new Date(currentChallenge.date).toLocaleDateString('pt-BR')}`;
        // Assumindo que o primeiro frame é sempre exibido inicialmente e está em frames[0]
        imagemElement.src = currentChallenge.frames[0];
        remainingGuessesElement.textContent = `Tentativas restantes: ${currentChallenge.remainingGuesses}`;

        // Como `framesShown` e `guesses` não estão em ChallengeDTO, vamos fazer suposições:
        // Se o usuário tem 5 tentativas restantes, assumimos que apenas 1 frame foi mostrado (início do jogo).
        // A lista de jogos (palpites anteriores) não pode ser preenchida aqui sem os dados do backend.
        renderFrameButtons(5 - currentChallenge.remainingGuesses); // Renderiza botões para tentativas já feitas
        listaJogos.innerHTML = ""; // Limpa palpites anteriores ao carregar novo desafio
        updateGameState(currentChallenge.remainingGuesses, false); // Assume não resolvido na carga inicial

        displayMessage('', 'info'); // Limpa mensagens anteriores
    } catch (error) {
        console.error("Erro ao buscar o desafio diário:", error);
        displayMessage("Não foi possível carregar o desafio de hoje. Tente novamente mais tarde.", "error");
        inputJogo.disabled = true;
        document.querySelector('.game button').disabled = true;
    }
}

/**
 * Submete o palpite do usuário para o desafio atual.
 * Adaptação: Lê diretamente os campos da AttemptResultDTO do Java.
 */
async function submitGuess() {
    const guess = inputJogo.value.trim();
    if (guess === "") {
        displayMessage("Por favor, digite um palpite!", "error");
        return;
    }

    // Desabilita input e botão temporariamente
    inputJogo.disabled = true;
    document.querySelector('.game button').disabled = true;

    try {
        const headers = { 'Content-Type': 'application/json' };
        if (userToken) {
            headers['Authorization'] = `Bearer ${userToken}`;
        }

        const response = await fetch(`${API_BASE_URL}/try`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({ guess: guess }) // Envia como { guess: "..." }
        });

        // Adaptação: Lida com o status 400 diretamente para mensagens de erro do backend
        if (response.status === 400) {
            const errorData = await response.json();
            displayMessage(errorData.message || "Erro desconhecido ao processar o palpite.", "error");
            inputJogo.disabled = false; // Reabilita em caso de erro de validação (não fim de jogo)
            document.querySelector('.game button').disabled = false;
            return;
        }

        if (!response.ok) {
            throw new Error(`Erro HTTP! status: ${response.status}`);
        }

        // Adaptação: Lê os campos diretamente da AttemptResultDTO do backend
        const result = await response.json(); // AttemptResultDTO (isCorrect, order, currentFrame, remainingGuesses, challengeAnswer, user)

        let newGuessItem = document.createElement("li");
        newGuessItem.textContent = guess;

        if (result.isCorrect) {
            displayMessage(`Parabéns! Você acertou: ${result.challengeAnswer}!`, "success");
            newGuessItem.classList.add('correct-guess');
            // Assumimos que 'currentFrame' no result é a URL do frame final/correto
            imagemElement.src = result.currentFrame;
            // Desabilita entrada após acerto
            inputJogo.disabled = true;
            document.querySelector('.game button').disabled = true;
        } else {
            displayMessage("Você errou. Tente novamente!", "error");
            newGuessItem.classList.add('incorrect-guess');
            // Atualiza a imagem para o próximo frame revelado pelo backend
            imagemElement.src = result.currentFrame;
            remainingGuessesElement.textContent = `Tentativas restantes: ${result.remainingGuesses}`;
            // Adaptação: 'order' do backend é o índice da tentativa (0-indexed).
            // Usamos 'order + 1' para o número de tentativas feitas para renderizar botões.
            renderFrameButtons(result.order + 1);

            if (result.remainingGuesses === 0 && !result.isCorrect) {
                displayMessage(`Suas tentativas acabaram! O desenho era: ${result.challengeAnswer}`, "error");
                inputJogo.disabled = true;
                document.querySelector('.game button').disabled = true;
                // imagemElement.src já deve estar no último frame via result.currentFrame
            } else {
                inputJogo.disabled = false; // Reabilita input para próxima tentativa
                document.querySelector('.game button').disabled = false;
            }
        }

        listaJogos.prepend(newGuessItem); // Adiciona novo palpite no topo da lista
        inputJogo.value = "";
        // Adaptação: Passamos o estado atual do jogo para updateGameState
        updateGameState(result.remainingGuesses, result.isCorrect);

    } catch (error) {
        console.error("Erro ao enviar palpite:", error);
        displayMessage("Ocorreu um erro ao processar seu palpite.", "error");
        inputJogo.disabled = false; // Reabilita input em caso de erro de conexão/servidor
        document.querySelector('.game button').disabled = false;
    }
}

/**
 * Renderiza botões para navegar entre os frames revelados.
 * @param {number} numFramesShown O número de frames que foram mostrados até agora.
 */
function renderFrameButtons(numFramesShown) {
    frameNavigation.innerHTML = ''; // Limpa botões existentes
    // Renderiza botões para cada frame 'revelado'
    for (let i = 0; i < numFramesShown; i++) {
        const button = document.createElement('button');
        button.textContent = i + 1;
        // Adaptação: currentChallenge.frames contém todos os frames do ChallengeDTO
        button.onclick = () => showSpecificFrame(i);
        frameNavigation.appendChild(button);
    }
}

/**
 * Exibe um frame específico do desafio.
 * @param {number} frameIndex O índice do frame a ser exibido.
 */
function showSpecificFrame(frameIndex) {
    // Adaptação: Usa currentChallenge.frames para acessar todos os frames
    if (currentChallenge && currentChallenge.frames && currentChallenge.frames[frameIndex]) {
        imagemElement.src = currentChallenge.frames[frameIndex];
    }
}

/**
 * Renderiza os palpites anteriores do usuário.
 * Adaptação: Esta função não pode preencher palpites persistidos do backend
 * na carga inicial do desafio, pois o ChallengeDTO atual não os inclui.
 * Ela apenas gerencia os palpites feitos durante a sessão atual.
 * @param {Array<Object>} guesses Lista de objetos de palpite (ex: { guessText: "...", isCorrect: true/false }).
 * No seu caso, o backend não envia essa lista na carga inicial.
 */
function renderPreviousGuesses(guesses = []) { // Default para array vazio
    // Esta função foi mantida, mas a capacidade de carregar palpites
    // persistidos depende da ChallengeDTO (ou outro endpoint) fornecer esses dados.
    // Atualmente, ela só será chamada com os palpites recebidos no AttemptResultDTO
    // ou com um array vazio na carga inicial.
    // O submitGuess já adiciona o novo palpite via prepend.
    // Para mostrar palpites históricos ao carregar, ChallengeDTO precisaria de 'guesses'.
}


/**
 * Atualiza o estado do jogo (habilita/desabilita inputs e botões).
 * @param {number} remainingGuesses Número de tentativas restantes.
 * @param {boolean} isCorrect Indica se o último palpite foi correto.
 */
function updateGameState(remainingGuesses, isCorrect) {
    const isGameOver = isCorrect || remainingGuesses <= 0;
    inputJogo.disabled = isGameOver;
    document.querySelector('.game button').disabled = isGameOver;
}

/**
 * Exibe uma mensagem ao usuário com um tipo específico (para estilização).
 * @param {string} text O texto da mensagem.
 * @param {string} type O tipo da mensagem ('success', 'error', 'info').
 */
function displayMessage(text, type) {
    mensagem.textContent = text;
    mensagem.className = `message ${type}`; // Aplica classes para estilização
}

// Autocomplete/Sugestões (simulação no cliente)
async function handleInputChange() {
    const input = inputJogo.value.trim().toLowerCase();
    suggestionsDatalist.innerHTML = ''; // Limpa sugestões anteriores

    if (input.length < 2) { // Sugere apenas após 2 caracteres
        return;
    }

    // Lista de desenhos animados (exemplo)
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

/**
 * Busca o ranking semanal do backend.
 * Assume que o endpoint `/api/challenge/ranking/weekly` retorna uma lista de UserSummaryDTOs.
 */
async function fetchWeeklyRanking() {
    try {
        const response = await fetch(`${API_BASE_URL}/ranking/weekly`);
        if (!response.ok) {
            throw new Error(`Erro HTTP! status: ${response.status}`);
        }
        const rankingData = await response.json(); // Espera uma lista de UserSummaryDTO

        rankingListElement.innerHTML = ''; // Limpa ranking anterior
        if (rankingData && rankingData.length > 0) {
            rankingData.forEach((user, index) => {
                let listItem = document.createElement('li');
                // Adaptação: Usa 'name' ou 'email' como padrão para o nome no ranking
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