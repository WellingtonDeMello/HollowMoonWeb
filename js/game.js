let ctx = null;
let dotNetRef = null;

const keys = {};
let facingLeft = false;

// ============================================================
// ÁUDIO
// ============================================================

const waterfallMusic = new Audio("/audio/waterfall.mp3");
const goblinMusic = new Audio("/audio/Goblin.mp3");
const skeletonMusic = new Audio("/audio/EsqueletoYundyne.mp3");

waterfallMusic.loop = true;
goblinMusic.loop = true;
skeletonMusic.loop = true;

waterfallMusic.preload = "auto";
goblinMusic.preload = "auto";
skeletonMusic.preload = "auto";

waterfallMusic.volume = 0.45;
goblinMusic.volume = 0.50;
skeletonMusic.volume = 0.50;

let audioUnlocked = false;
let tickInFlight = false;

function safePause(audio) {
    audio.pause();
}

function safeReset(audio) {
    try {
        audio.currentTime = 0;
    }
    catch {
    }
}

function stopWaterfallMusic() {
    safePause(waterfallMusic);
}

function stopGoblinMusic() {
    safePause(goblinMusic);
    safeReset(goblinMusic);
}

function stopSkeletonMusic() {
    safePause(skeletonMusic);
    safeReset(skeletonMusic);
}

function startWaterfallMusic() {
    if (!audioUnlocked || gameMode !== "world")
        return;

    stopGoblinMusic();
    stopSkeletonMusic();

    if (waterfallMusic.paused) {
        waterfallMusic
            .play()
            .catch(error => console.error("Erro ao tocar waterfall:", error));
    }
}

function startGoblinMusic() {
    stopWaterfallMusic();
    stopSkeletonMusic();
    safeReset(goblinMusic);

    if (!audioUnlocked)
        return;

    goblinMusic
        .play()
        .catch(error => console.error("Erro ao tocar Goblin.mp3:", error));
}

function startSkeletonMusic() {
    stopWaterfallMusic();
    stopGoblinMusic();
    safeReset(skeletonMusic);

    if (!audioUnlocked)
        return;

    skeletonMusic
        .play()
        .catch(error => console.error("Erro ao tocar EsqueletoYundyne.mp3:", error));
}

function unlockAudio() {
    if (audioUnlocked)
        return;

    audioUnlocked = true;

    if (gameMode === "battle")
        startGoblinMusic();
    else if (gameMode === "skeletonBattle")
        startSkeletonMusic();
    else
        startWaterfallMusic();
}

waterfallMusic.addEventListener("error", () =>
    console.error("Não foi possível carregar:", waterfallMusic.src)
);

goblinMusic.addEventListener("error", () =>
    console.error("Não foi possível carregar:", goblinMusic.src)
);

skeletonMusic.addEventListener("error", () =>
    console.error("Não foi possível carregar:", skeletonMusic.src)
);


// ============================================================
// CONFIGURAÇÕES
// ============================================================

const WORLD_WIDTH = 1280;
const WORLD_HEIGHT = 720;
const LEVEL_WIDTH = 3600;
const TILE = 16;


// ============================================================
// GOBLIN
// ============================================================

const goblin = {
    x: 2050,
    y: 520,

    width: 150,
    height: 120,

    defeated: false,
    spared: false
};


const skeleton = {
    x: 3215,
    y: 208,

    width: 64,
    height: 80,

    defeated: false,
    spared: false
};


// ============================================================
// ESTADO DO JOGO
// ============================================================

let gameMode = "world";
let battleStarted = false;
let skeletonBattleStarted = false;

const playerMaxHP = 20;
let playerHP = playerMaxHP;

const goblinMaxHP = 45;
let goblinHP = goblinMaxHP;

const skeletonMaxHP = 60;
let skeletonHP = skeletonMaxHP;


// ============================================================
// ESTADO DA BATALHA
// ============================================================

let battlePhase = "menu";

// menu
// message
// attackBar
// enemyAttack
// ended

let battleTimer = 0;
let battlePending = null;

let battleMenu = 0;
let battleMessage = "";


// ============================================================
// ESTADO DA BATALHA DO ESQUELETO
// ============================================================

let skeletonBattlePhase = "menu";
let skeletonBattleTimer = 0;
let skeletonBattlePending = null;

let skeletonBattleMenu = 0;
let skeletonBattleMessage = "";

let skeletonAttackType = 0;
let lastSkeletonAttackType = -1;


// ============================================================
// BARRA DE ATAQUE
// ============================================================

let attackBarPosition = 0;
let attackBarDirection = 1;

const ATTACK_BAR_SPEED = 0.018;


// ============================================================
// ATAQUES DO GOBLIN
// ============================================================

let enemyAttackType = 0;
let enemyAttackTimer = 0;
let enemyAttackDuration = 260;

let invulnTimer = 0;

let projectiles = [];


// ============================================================
// CORAÇÃO
// ============================================================

const heart = {
    x: 640,
    y: 470,
    speed: 5.2,
    size: 10
};


// ============================================================
// INPUT
// ============================================================

let prevLeft = false;
let prevRight = false;
let prevConfirm = false;


// ============================================================
// ARENA
// ============================================================

function getBattleArena() {
    return {
        x: 370,
        y: 390,
        width: 540,
        height: 220
    };
}


// ============================================================
// INICIALIZAÇÃO
// ============================================================

export function init(canvas, dotNetHelper) {

    ctx = canvas.getContext("2d");

    dotNetRef = dotNetHelper;

    window.addEventListener("keydown", e => {

        keys[e.code] = true;

        unlockAudio();

        if (
            [
                "ArrowUp",
                "ArrowDown",
                "ArrowLeft",
                "ArrowRight",
                "Space",
                "Enter"
            ].includes(e.code)
        ) {
            e.preventDefault();
        }
    });

    window.addEventListener("keyup", e => {
        keys[e.code] = false;
    });

    window.addEventListener(
        "pointerdown",
        unlockAudio
    );

    setupHighDpiCanvas(canvas);

    window.addEventListener(
        "resize",
        () => setupHighDpiCanvas(canvas)
    );

    requestAnimationFrame(loop);
}


// ============================================================
// CANVAS
// ============================================================

function setupHighDpiCanvas(canvas) {

    const dpr = window.devicePixelRatio || 1;

    const scale = Math.min(
        window.innerWidth / WORLD_WIDTH,
        window.innerHeight / WORLD_HEIGHT
    );

    canvas.style.width =
        WORLD_WIDTH * scale + "px";

    canvas.style.height =
        WORLD_HEIGHT * scale + "px";

    canvas.width =
        WORLD_WIDTH * dpr;

    canvas.height =
        WORLD_HEIGHT * dpr;

    ctx = canvas.getContext("2d");

    ctx.setTransform(
        dpr,
        0,
        0,
        dpr,
        0,
        0
    );

    ctx.imageSmoothingEnabled = false;
}


// ============================================================
// LOOP PRINCIPAL
// ============================================================

function loop(timestamp) {

    if (gameMode === "world") {

        updateFacing();
        requestWorldTick(timestamp);

    }
    else if (gameMode === "battle") {

        updateBattle();
        drawBattle(timestamp);

    }
    else if (gameMode === "skeletonBattle") {

        updateSkeletonBattle();
        drawSkeletonBattle(timestamp);
    }

    requestAnimationFrame(loop);
}


function requestWorldTick(timestamp) {

    if (tickInFlight)
        return;

    tickInFlight = true;

    dotNetRef
        .invokeMethodAsync(
            "Tick",
            {
                left:
                    !!keys["ArrowLeft"] ||
                    !!keys["KeyA"],

                right:
                    !!keys["ArrowRight"] ||
                    !!keys["KeyD"],

                jump:
                    !!keys["Space"] ||
                    !!keys["ArrowUp"] ||
                    !!keys["KeyW"],

                restart:
                    !!keys["KeyR"]
            }
        )
        .then(state => {

            if (!state)
                return;

            checkGoblinEncounter(state.player);

            if (gameMode !== "world")
                return;

            checkSkeletonEncounter(state.player);

            if (gameMode !== "world")
                return;

            draw(
                state,
                timestamp
            );
        })
        .catch(error => {
            console.error("Erro no Tick:", error);
        })
        .finally(() => {
            tickInFlight = false;
        });
}


// ============================================================
// DIREÇÃO DO PERSONAGEM
// ============================================================

function updateFacing() {

    if (
        keys["ArrowLeft"] ||
        keys["KeyA"]
    ) {
        facingLeft = true;
    }

    if (
        keys["ArrowRight"] ||
        keys["KeyD"]
    ) {
        facingLeft = false;
    }
}


// ============================================================
// ENCONTRO COM O GOBLIN
// ============================================================

function checkGoblinEncounter(player) {

    if (
        goblin.defeated ||
        goblin.spared ||
        battleStarted
    ) {
        return;
    }

    const playerCenter =
        player.x + player.width / 2;

    const goblinCenter =
        goblin.x + goblin.width / 2;

    const distance =
        Math.abs(
            playerCenter -
            goblinCenter
        );

    const verticalDistance =
        Math.abs(
            (player.y + player.height) -
            (goblin.y + goblin.height)
        );

    if (
        distance < 120 &&
        verticalDistance < 100
    ) {
        startGoblinBattle();
    }
}


// ============================================================
// COMEÇAR BATALHA
// ============================================================

function startGoblinBattle() {

    battleStarted = true;

    gameMode = "battle";

    playerHP = playerMaxHP;
    goblinHP = goblinMaxHP;

    battleMenu = 0;

    startGoblinMusic();

    battleMessage =
        "* Um goblin selvagem apareceu!";

    setPhase(
        "message",
        70,
        () => setPhase(
            "menu",
            0,
            null
        )
    );
}


// ============================================================
// SISTEMA DE FASES
// ============================================================

function setPhase(
    phase,
    timer,
    pending
) {

    battlePhase = phase;

    battleTimer = timer;

    battlePending = pending;
}


// ============================================================
// ATUALIZAÇÃO DA BATALHA
// ============================================================

function updateBattle() {

    if (
        battlePhase === "menu"
    ) {

        updateBattleMenuInput();

    }
    else if (
        battlePhase === "message" ||
        battlePhase === "ended"
    ) {

        battleTimer--;

        if (
            battleTimer <= 0 &&
            battlePending
        ) {

            const next =
                battlePending;

            battlePending = null;

            next();
        }

    }
    else if (
        battlePhase === "attackBar"
    ) {

        updateAttackBar();

    }
    else if (
        battlePhase === "enemyAttack"
    ) {

        updateEnemyAttack();
    }
}


// ============================================================
// MENU
// ============================================================

function updateBattleMenuInput() {

    const left =
        !!keys["ArrowLeft"] ||
        !!keys["KeyA"];

    const right =
        !!keys["ArrowRight"] ||
        !!keys["KeyD"];

    const confirm =
        !!keys["Enter"] ||
        !!keys["Space"];

    if (
        left &&
        !prevLeft
    ) {

        battleMenu =
            (battleMenu + 3) % 4;
    }

    if (
        right &&
        !prevRight
    ) {

        battleMenu =
            (battleMenu + 1) % 4;
    }

    if (
        confirm &&
        !prevConfirm
    ) {

        selectBattleMenu();
    }

    prevLeft = left;
    prevRight = right;
    prevConfirm = confirm;
}


// ============================================================
// ESCOLHA DO MENU
// ============================================================

function selectBattleMenu() {

    if (battleMenu === 0) {

        attackBarPosition = 0;
        attackBarDirection = 1;

        battleMessage =
            "* Escolha o momento certo!";

        setPhase(
            "attackBar",
            0,
            null
        );

        return;
    }

    if (battleMenu === 1) {

        battleMessage =
            "* Você observa o goblin.";

        setPhase(
            "message",
            60,
            startEnemyAttack
        );

        return;
    }

    if (battleMenu === 2) {

        if (
            playerHP >= playerMaxHP
        ) {

            battleMessage =
                "* Seu HP já está cheio.";

            setPhase(
                "message",
                45,
                () => setPhase(
                    "menu",
                    0,
                    null
                )
            );

        }
        else {

            playerHP =
                Math.min(
                    playerMaxHP,
                    playerHP + 8
                );

            battleMessage =
                "* Você recuperou HP!";

            setPhase(
                "message",
                50,
                startEnemyAttack
            );
        }

        return;
    }

    if (
        goblinHP <=
        goblinMaxHP * 0.30
    ) {

        battleMessage =
            "* O goblin aceitou ser poupado.";

        setPhase(
            "message",
            60,
            () => endBattle("spared")
        );

    }
    else {

        battleMessage =
            "* O goblin ainda não quer desistir!";

        setPhase(
            "message",
            50,
            startEnemyAttack
        );
    }
}


// ============================================================
// BARRA DE ATAQUE
// ============================================================

function updateAttackBar() {

    attackBarPosition +=
        ATTACK_BAR_SPEED *
        attackBarDirection;

    if (
        attackBarPosition >= 1
    ) {

        attackBarPosition = 1;
        attackBarDirection = -1;
    }

    if (
        attackBarPosition <= 0
    ) {

        attackBarPosition = 0;
        attackBarDirection = 1;
    }

    const confirm =
        !!keys["Enter"] ||
        !!keys["Space"];

    if (
        confirm &&
        !prevConfirm
    ) {

        executePlayerAttack();
    }

    prevConfirm = confirm;
}


// ============================================================
// ATAQUE DO JOGADOR
// ============================================================

function executePlayerAttack() {

    const distance =
        Math.abs(
            attackBarPosition -
            0.5
        );

    let damage;

    if (distance < 0.05) {

        damage = 15;

        battleMessage =
            "* ACERTO PERFEITO! 15 de dano!";

    }
    else if (distance < 0.13) {

        damage = 12;

        battleMessage =
            "* Ótimo ataque! 12 de dano!";

    }
    else if (distance < 0.25) {

        damage = 8;

        battleMessage =
            "* Você causou 8 de dano!";

    }
    else {

        damage = 4;

        battleMessage =
            "* Você acertou de raspão! 4 de dano!";
    }

    goblinHP =
        Math.max(
            0,
            goblinHP - damage
        );

    if (
        goblinHP <= 0
    ) {

        goblinHP = 0;

        battleMessage =
            "* Você derrotou o goblin!";

        setPhase(
            "message",
            70,
            () => endBattle("won")
        );

    }
    else {

        setPhase(
            "message",
            55,
            startEnemyAttack
        );
    }
}


// ============================================================
// ATAQUE DO GOBLIN
// ============================================================

function startEnemyAttack() {

    battlePhase =
        "enemyAttack";

    enemyAttackTimer = 270;

    invulnTimer = 0;

    projectiles = [];

    resetHeart();

    enemyAttackType =
        Math.floor(
            Math.random() * 5
        );

    battleMessage =
        getEnemyAttackMessage();
}


function getEnemyAttackMessage() {

    switch (enemyAttackType) {

        case 0:
            return "* O goblin gira seu porrete!";

        case 1:
            return "* O goblin joga machados!";

        case 2:
            return "* O goblin faz chover pedras!";

        case 3:
            return "* O goblin dispara uma rajada!";

        case 4:
            return "* O goblin prepara um ataque furioso!";

        default:
            return "* O goblin ataca!";
    }
}


function updateEnemyAttack() {

    enemyAttackTimer--;

    const arena =
        getBattleArena();

    if (
        keys["ArrowLeft"] ||
        keys["KeyA"]
    ) {
        heart.x -= heart.speed;
    }

    if (
        keys["ArrowRight"] ||
        keys["KeyD"]
    ) {
        heart.x += heart.speed;
    }

    if (
        keys["ArrowUp"] ||
        keys["KeyW"]
    ) {
        heart.y -= heart.speed;
    }

    if (
        keys["ArrowDown"] ||
        keys["KeyS"]
    ) {
        heart.y += heart.speed;
    }

    heart.x =
        Math.max(
            arena.x + 12,
            Math.min(
                heart.x,
                arena.x +
                arena.width -
                12
            )
        );

    heart.y =
        Math.max(
            arena.y + 12,
            Math.min(
                heart.y,
                arena.y +
                arena.height -
                12
            )
        );

    if (
        invulnTimer > 0
    ) {
        invulnTimer--;
    }

    switch (enemyAttackType) {

        case 0:
            updateRotatingAxes(arena);
            break;

        case 1:
            updateAxeRain(arena);
            break;

        case 2:
            updateRockRain(arena);
            break;

        case 3:
            updateProjectileWave(arena);
            break;

        case 4:
            updateGoblinBurst(arena);
            break;
    }

    checkProjectileCollisions();

    if (
        playerHP <= 0
    ) {

        playerHP = 0;

        battleMessage =
            "* Você foi derrotado...";

        setPhase(
            "message",
            80,
            () => {

                playerHP =
                    playerMaxHP;

                battleMessage =
                    "* Você se recuperou.";

                setPhase(
                    "menu",
                    0,
                    null
                );
            }
        );

        return;
    }

    if (
        enemyAttackTimer <= 0
    ) {

        projectiles = [];

        battleMessage =
            "* O que você vai fazer?";

        setPhase(
            "menu",
            0,
            null
        );
    }
}


// ============================================================
// ATAQUE 1 — MACHADOS GIRANDO
// ============================================================

function updateRotatingAxes(arena) {

    const centerX =
        arena.x +
        arena.width / 2;

    const centerY =
        arena.y +
        arena.height / 2;

    const time =
        enemyAttackTimer;

    for (
        let i = 0;
        i < 7;
        i++
    ) {

        const angle =
            time * 0.055 +
            i * Math.PI * 2 / 7;

        const radius =
            60 +
            i * 18;

        projectiles.push({
            type: "axe",
            x:
                centerX +
                Math.cos(angle) *
                radius,

            y:
                centerY +
                Math.sin(angle) *
                radius,

            vx: 0,
            vy: 0,

            angle
        });
    }

    if (
        projectiles.length > 7
    ) {

        projectiles =
            projectiles.slice(-7);
    }
}


// ============================================================
// ATAQUE 2 — CHUVA DE MACHADOS
// ============================================================

function updateAxeRain(arena) {

    if (
        enemyAttackTimer % 24 === 0
    ) {

        const count = 4;

        for (
            let i = 0;
            i < count;
            i++
        ) {

            const x =
                arena.x +
                20 +
                Math.random() *
                (arena.width - 40);

            projectiles.push({
                type: "axeRain",

                x,

                y:
                    arena.y - 25,

                vx:
                    (Math.random() - 0.5) *
                    1.5,

                vy:
                    3 +
                    Math.random() *
                    1.5,

                angle:
                    Math.random() *
                    Math.PI * 2
            });
        }
    }

    for (
        const p of projectiles
    ) {

        p.x += p.vx;
        p.y += p.vy;
        p.angle += 0.12;
    }

    removeOutOfArenaProjectiles(
        arena
    );
}


// ============================================================
// ATAQUE 3 — PEDRAS
// ============================================================

function updateRockRain(arena) {

    if (
        enemyAttackTimer % 30 === 0
    ) {

        const side =
            Math.floor(
                Math.random() * 2
            );

        const y =
            arena.y +
            25 +
            Math.random() *
            (arena.height - 50);

        projectiles.push({

            type: "rock",

            x:
                side === 0
                    ? arena.x - 20
                    : arena.x +
                    arena.width +
                    20,

            y,

            vx:
                side === 0
                    ? 3.2
                    : -3.2,

            vy:
                (Math.random() - 0.5) *
                1.5,

            angle:
                Math.random() *
                Math.PI * 2
        });
    }

    for (
        const p of projectiles
    ) {

        p.x += p.vx;
        p.y += p.vy;
        p.angle += 0.08;
    }

    removeOutOfArenaProjectiles(
        arena
    );
}


// ============================================================
// ATAQUE 4 — ONDA
// ============================================================

function updateProjectileWave(arena) {

    if (
        enemyAttackTimer % 40 === 0
    ) {

        const gap =
            Math.floor(
                Math.random() * 7
            );

        for (
            let i = 0;
            i < 7;
            i++
        ) {

            if (
                i === gap
            )
                continue;

            projectiles.push({

                type: "wave",

                x:
                    arena.x +
                    i *
                    (arena.width / 7) +
                    35,

                y:
                    arena.y - 20,

                vx: 0,

                vy: 3.1,

                angle: 0
            });
        }
    }

    for (
        const p of projectiles
    ) {

        p.y += p.vy;
    }

    removeOutOfArenaProjectiles(
        arena
    );
}


// ============================================================
// ATAQUE 5 — EXPLOSÃO
// ============================================================

function updateGoblinBurst(arena) {

    if (
        enemyAttackTimer % 80 === 0
    ) {

        const centerX =
            arena.x +
            arena.width / 2;

        const centerY =
            arena.y +
            arena.height / 2;

        const count = 12;

        for (
            let i = 0;
            i < count;
            i++
        ) {

            const angle =
                Math.PI * 2 *
                i /
                count;

            projectiles.push({

                type: "burst",

                x: centerX,

                y: centerY,

                vx:
                    Math.cos(angle) *
                    2.6,

                vy:
                    Math.sin(angle) *
                    2.6,

                angle
            });
        }
    }

    for (
        const p of projectiles
    ) {

        p.x += p.vx;
        p.y += p.vy;
    }

    removeOutOfArenaProjectiles(
        arena
    );
}


// ============================================================
// REMOVER PROJÉTEIS
// ============================================================

function removeOutOfArenaProjectiles(
    arena
) {

    projectiles =
        projectiles.filter(
            p =>
                p.x >
                arena.x - 50 &&
                p.x <
                arena.x +
                arena.width +
                50 &&
                p.y >
                arena.y - 50 &&
                p.y <
                arena.y +
                arena.height +
                50
        );
}


// ============================================================
// COLISÕES
// ============================================================

function checkProjectileCollisions() {

    if (
        invulnTimer > 0
    )
        return;

    for (
        let i = projectiles.length - 1;
        i >= 0;
        i--
    ) {

        const p =
            projectiles[i];

        const distance =
            Math.hypot(
                heart.x - p.x,
                heart.y - p.y
            );

        const radius =
            p.type === "rock"
                ? 12
                : 14;

        if (
            distance <
            radius + 7
        ) {

            playerHP =
                Math.max(
                    0,
                    playerHP - 3
                );

            invulnTimer = 40;

            battleMessage =
                "* Você levou dano!";

            projectiles.splice(
                i,
                1
            );

            break;
        }
    }
}


// ============================================================
// RESET DO CORAÇÃO
// ============================================================

function resetHeart() {

    const arena =
        getBattleArena();

    heart.x =
        arena.x +
        arena.width / 2;

    heart.y =
        arena.y +
        arena.height / 2;
}


// ============================================================
// ENCERRAR BATALHA
// ============================================================

function endBattle(result) {

    if (
        result === "spared"
    ) {

        goblin.spared = true;

        battleMessage =
            "* Você poupou o goblin. Ele foge!";

    }
    else {

        goblin.defeated = true;

        battleMessage =
            "* O goblin foi derrotado!";
    }

    setPhase(
        "ended",
        90,
        returnToWorld
    );
}


// ============================================================
// VOLTAR PARA O MUNDO
// ============================================================

function returnToWorld() {

    gameMode = "world";

    battleStarted = false;

    stopGoblinMusic();

    startWaterfallMusic();
}


// ============================================================
// ENCONTRO COM O ESQUELETO
// ============================================================

function checkSkeletonEncounter(player) {

    if (
        skeleton.defeated ||
        skeleton.spared ||
        skeletonBattleStarted ||
        gameMode !== "world"
    ) {
        return;
    }

    const playerCenterX =
        player.x + player.width / 2;

    const playerBottom =
        player.y + player.height;

    const skeletonCenterX =
        skeleton.x + skeleton.width / 2;

    const skeletonBottom =
        skeleton.y + skeleton.height;

    const horizontalDistance =
        Math.abs(
            playerCenterX -
            skeletonCenterX
        );

    const verticalDistance =
        Math.abs(
            playerBottom -
            skeletonBottom
        );

    if (
        horizontalDistance < 190 &&
        verticalDistance < 160
    ) {
        startSkeletonBattle();
    }
}


// ============================================================
// COMEÇAR BATALHA DO ESQUELETO
// ============================================================

function startSkeletonBattle() {

    gameMode = "skeletonBattle";
    skeletonBattleStarted = true;

    playerHP = playerMaxHP;
    skeletonHP = skeletonMaxHP;

    skeletonBattleMenu = 0;

    attackBarPosition = 0;
    attackBarDirection = 1;

    projectiles = [];
    invulnTimer = 0;

    prevLeft = false;
    prevRight = false;
    prevConfirm = false;

    startSkeletonMusic();

    skeletonBattleMessage =
        "* O esqueleto bloqueia o caminho!";

    setSkeletonPhase(
        "message",
        70,
        () => setSkeletonPhase(
            "menu",
            0,
            null
        )
    );
}


function setSkeletonPhase(
    phase,
    timer,
    pending
) {

    skeletonBattlePhase = phase;
    skeletonBattleTimer = timer;
    skeletonBattlePending = pending;
}


// ============================================================
// ATUALIZAÇÃO DA BATALHA DO ESQUELETO
// ============================================================

function updateSkeletonBattle() {

    if (
        skeletonBattlePhase === "menu"
    ) {

        updateSkeletonBattleMenuInput();

    }
    else if (
        skeletonBattlePhase === "message" ||
        skeletonBattlePhase === "ended"
    ) {

        skeletonBattleTimer--;

        if (
            skeletonBattleTimer <= 0 &&
            skeletonBattlePending
        ) {

            const next =
                skeletonBattlePending;

            skeletonBattlePending = null;

            next();
        }

    }
    else if (
        skeletonBattlePhase === "attackBar"
    ) {

        updateSkeletonAttackBar();

    }
    else if (
        skeletonBattlePhase === "enemyAttack"
    ) {

        updateSkeletonEnemyAttack();
    }
}


// ============================================================
// MENU DO ESQUELETO
// ============================================================

function updateSkeletonBattleMenuInput() {

    const left =
        !!keys["ArrowLeft"] ||
        !!keys["KeyA"];

    const right =
        !!keys["ArrowRight"] ||
        !!keys["KeyD"];

    const confirm =
        !!keys["Enter"] ||
        !!keys["Space"];

    if (
        left &&
        !prevLeft
    ) {
        skeletonBattleMenu =
            (skeletonBattleMenu + 3) % 4;
    }

    if (
        right &&
        !prevRight
    ) {
        skeletonBattleMenu =
            (skeletonBattleMenu + 1) % 4;
    }

    if (
        confirm &&
        !prevConfirm
    ) {
        selectSkeletonBattleMenu();
    }

    prevLeft = left;
    prevRight = right;
    prevConfirm = confirm;
}


function selectSkeletonBattleMenu() {

    if (skeletonBattleMenu === 0) {

        attackBarPosition = 0;
        attackBarDirection = 1;

        skeletonBattleMessage =
            "* Escolha o momento certo!";

        setSkeletonPhase(
            "attackBar",
            0,
            null
        );

        return;
    }

    if (skeletonBattleMenu === 1) {

        skeletonBattleMessage =
            "* Você observa o esqueleto. Seus olhos brilham em roxo.";

        setSkeletonPhase(
            "message",
            60,
            startSkeletonEnemyAttack
        );

        return;
    }

    if (skeletonBattleMenu === 2) {

        if (
            playerHP >= playerMaxHP
        ) {

            skeletonBattleMessage =
                "* Seu HP já está cheio.";

            setSkeletonPhase(
                "message",
                45,
                () => setSkeletonPhase(
                    "menu",
                    0,
                    null
                )
            );

        }
        else {

            playerHP =
                Math.min(
                    playerMaxHP,
                    playerHP + 8
                );

            skeletonBattleMessage =
                "* Você recuperou HP!";

            setSkeletonPhase(
                "message",
                50,
                startSkeletonEnemyAttack
            );
        }

        return;
    }

    if (
        skeletonHP <=
        skeletonMaxHP * 0.30
    ) {

        skeletonBattleMessage =
            "* O esqueleto abaixa a espada e deixa você passar.";

        setSkeletonPhase(
            "message",
            60,
            () => endSkeletonBattle("spared")
        );

    }
    else {

        skeletonBattleMessage =
            "* O esqueleto ainda não quer recuar!";

        setSkeletonPhase(
            "message",
            50,
            startSkeletonEnemyAttack
        );
    }
}


// ============================================================
// BARRA DE ATAQUE DO ESQUELETO
// ============================================================

function updateSkeletonAttackBar() {

    attackBarPosition +=
        ATTACK_BAR_SPEED *
        attackBarDirection;

    if (
        attackBarPosition >= 1
    ) {
        attackBarPosition = 1;
        attackBarDirection = -1;
    }

    if (
        attackBarPosition <= 0
    ) {
        attackBarPosition = 0;
        attackBarDirection = 1;
    }

    const confirm =
        !!keys["Enter"] ||
        !!keys["Space"];

    if (
        confirm &&
        !prevConfirm
    ) {
        executeSkeletonPlayerAttack();
    }

    prevConfirm = confirm;
}


function executeSkeletonPlayerAttack() {

    const distance =
        Math.abs(
            attackBarPosition -
            0.5
        );

    let damage;

    if (distance < 0.05) {

        damage = 15;
        skeletonBattleMessage =
            "* ACERTO PERFEITO! 15 de dano!";

    }
    else if (distance < 0.13) {

        damage = 12;
        skeletonBattleMessage =
            "* Ótimo ataque! 12 de dano!";

    }
    else if (distance < 0.25) {

        damage = 8;
        skeletonBattleMessage =
            "* Você causou 8 de dano!";

    }
    else {

        damage = 4;
        skeletonBattleMessage =
            "* Você causou 4 de dano!";
    }

    skeletonHP =
        Math.max(
            0,
            skeletonHP - damage
        );

    if (
        skeletonHP <= 0
    ) {

        skeletonBattleMessage =
            "* Você derrotou o esqueleto!";

        setSkeletonPhase(
            "message",
            70,
            () => endSkeletonBattle("won")
        );

    }
    else {

        setSkeletonPhase(
            "message",
            55,
            startSkeletonEnemyAttack
        );
    }
}


// ============================================================
// ATAQUES DO ESQUELETO
// ============================================================

function chooseSkeletonAttack() {

    let attack;

    do {
        attack =
            Math.floor(
                Math.random() * 4
            );
    }
    while (
        attack ===
        lastSkeletonAttackType
    );

    lastSkeletonAttackType = attack;

    return attack;
}


function startSkeletonEnemyAttack() {

    skeletonBattlePhase =
        "enemyAttack";

    enemyAttackTimer = 280;

    invulnTimer = 0;

    projectiles = [];

    resetHeart();

    skeletonAttackType =
        chooseSkeletonAttack();

    skeletonBattleMessage =
        getSkeletonAttackMessage();
}


function getSkeletonAttackMessage() {

    switch (skeletonAttackType) {

        case 0:
            return "* Ossos começam a cair do alto!";

        case 1:
            return "* Uma parede de ossos se aproxima!";

        case 2:
            return "* O chão começa a rachar...";

        case 3:
            return "* Ossos atravessam a arena pelos lados!";

        default:
            return "* O esqueleto ataca!";
    }
}


function updateSkeletonEnemyAttack() {

    enemyAttackTimer--;

    const arena =
        getBattleArena();

    moveHeart(
        arena
    );

    if (
        invulnTimer > 0
    ) {
        invulnTimer--;
    }

    switch (skeletonAttackType) {

        case 0:
            updateSkeletonBoneRain(
                arena
            );
            break;

        case 1:
            updateSkeletonBoneWall(
                arena
            );
            break;

        case 2:
            updateSkeletonFloorSpikes(
                arena
            );
            break;

        case 3:
            updateSkeletonSideBones(
                arena
            );
            break;
    }

    checkSkeletonProjectileCollisions();

    if (
        playerHP <= 0
    ) {

        playerHP = 0;

        skeletonBattleMessage =
            "* Você foi derrotado...";

        setSkeletonPhase(
            "message",
            80,
            () => {

                playerHP =
                    playerMaxHP;

                projectiles = [];

                skeletonBattleMessage =
                    "* Você se recuperou.";

                setSkeletonPhase(
                    "menu",
                    0,
                    null
                );
            }
        );

        return;
    }

    if (
        enemyAttackTimer <= 0
    ) {

        projectiles = [];

        skeletonBattleMessage =
            "* O que você vai fazer?";

        setSkeletonPhase(
            "menu",
            0,
            null
        );
    }
}


// ============================================================
// ESQUELETO — CHUVA DE OSSOS
// ============================================================

function updateSkeletonBoneRain(
    arena
) {

    if (
        enemyAttackTimer % 24 === 0
    ) {

        projectiles.push({
            type: "bone",

            x:
                arena.x +
                25 +
                Math.random() *
                (arena.width - 50),

            y:
                arena.y - 28,

            vx:
                (Math.random() - 0.5) *
                0.6,

            vy:
                3.5 +
                Math.random() *
                0.8,

            angle:
                Math.PI / 2,

            active: true
        });
    }

    for (
        const p of projectiles
    ) {
        p.x += p.vx;
        p.y += p.vy;
    }

    removeOutOfArenaProjectiles(
        arena
    );
}


// ============================================================
// ESQUELETO — PAREDE DE OSSOS
// ============================================================

function updateSkeletonBoneWall(
    arena
) {

    if (
        enemyAttackTimer % 80 === 0
    ) {

        const fromLeft =
            Math.random() < 0.5;

        const rows = 5;

        const gap =
            Math.floor(
                Math.random() *
                rows
            );

        const rowHeight =
            arena.height /
            rows;

        for (
            let i = 0;
            i < rows;
            i++
        ) {

            if (i === gap)
                continue;

            projectiles.push({
                type: "boneWall",

                x:
                    fromLeft
                        ? arena.x - 28
                        : arena.x +
                        arena.width + 28,

                y:
                    arena.y +
                    rowHeight * i +
                    rowHeight / 2,

                vx:
                    fromLeft
                        ? 3.8
                        : -3.8,

                vy: 0,

                angle: 0,

                active: true
            });
        }
    }

    for (
        const p of projectiles
    ) {
        p.x += p.vx;
    }

    removeOutOfArenaProjectiles(
        arena
    );
}


// ============================================================
// ESQUELETO — ESPINHOS
// ============================================================

function updateSkeletonFloorSpikes(
    arena
) {

    if (
        enemyAttackTimer % 78 === 0
    ) {

        const lanes = 6;

        const safeLane =
            Math.floor(
                Math.random() *
                lanes
            );

        const laneWidth =
            arena.width /
            lanes;

        for (
            let i = 0;
            i < lanes;
            i++
        ) {

            if (i === safeLane)
                continue;

            projectiles.push({
                type: "boneSpike",

                x:
                    arena.x +
                    laneWidth * i +
                    laneWidth / 2,

                y:
                    arena.y +
                    arena.height - 4,

                vx: 0,
                vy: 0,

                angle: 0,

                warningTimer: 34,
                lifeTimer: 44,

                active: false
            });
        }
    }

    for (
        const p of projectiles
    ) {

        if (
            p.type !== "boneSpike"
        ) {
            continue;
        }

        if (
            p.warningTimer > 0
        ) {

            p.warningTimer--;
            p.active = false;

        }
        else {

            p.lifeTimer--;
            p.active = true;
        }
    }

    projectiles =
        projectiles.filter(
            p =>
                p.type !== "boneSpike" ||
                p.warningTimer > 0 ||
                p.lifeTimer > 0
        );
}


// ============================================================
// ESQUELETO — OSSOS LATERAIS
// ============================================================

function updateSkeletonSideBones(
    arena
) {

    if (
        enemyAttackTimer % 32 === 0
    ) {

        const fromLeft =
            Math.random() < 0.5;

        const y =
            arena.y +
            24 +
            Math.random() *
            (arena.height - 48);

        projectiles.push({
            type: "boneSide",

            x:
                fromLeft
                    ? arena.x - 25
                    : arena.x +
                    arena.width + 25,

            y,

            vx:
                fromLeft
                    ? 4.4
                    : -4.4,

            vy: 0,

            angle: 0,

            active: true
        });
    }

    for (
        const p of projectiles
    ) {
        p.x += p.vx;
    }

    removeOutOfArenaProjectiles(
        arena
    );
}


function checkSkeletonProjectileCollisions() {

    if (
        invulnTimer > 0
    ) {
        return;
    }

    for (
        let i = projectiles.length - 1;
        i >= 0;
        i--
    ) {

        const p =
            projectiles[i];

        if (
            p.active === false
        ) {
            continue;
        }

        let hit = false;

        if (
            p.type === "boneSpike"
        ) {

            hit =
                Math.abs(
                    heart.x -
                    p.x
                ) < 22 &&
                heart.y >
                p.y - 65;

        }
        else {

            hit =
                Math.hypot(
                    heart.x -
                    p.x,
                    heart.y -
                    p.y
                ) < 20;
        }

        if (hit) {

            playerHP =
                Math.max(
                    0,
                    playerHP - 2
                );

            invulnTimer = 38;

            skeletonBattleMessage =
                "* Você levou dano!";

            if (
                p.type !== "boneSpike"
            ) {
                projectiles.splice(
                    i,
                    1
                );
            }

            break;
        }
    }
}


function moveHeart(
    arena
) {

    if (
        keys["ArrowLeft"] ||
        keys["KeyA"]
    ) {
        heart.x -= heart.speed;
    }

    if (
        keys["ArrowRight"] ||
        keys["KeyD"]
    ) {
        heart.x += heart.speed;
    }

    if (
        keys["ArrowUp"] ||
        keys["KeyW"]
    ) {
        heart.y -= heart.speed;
    }

    if (
        keys["ArrowDown"] ||
        keys["KeyS"]
    ) {
        heart.y += heart.speed;
    }

    heart.x =
        Math.max(
            arena.x + 12,
            Math.min(
                heart.x,
                arena.x +
                arena.width - 12
            )
        );

    heart.y =
        Math.max(
            arena.y + 12,
            Math.min(
                heart.y,
                arena.y +
                arena.height - 12
            )
        );
}


function endSkeletonBattle(
    result
) {

    if (
        result === "spared"
    ) {

        skeleton.spared = true;

        skeletonBattleMessage =
            "* Você poupou o esqueleto. Ele sai do caminho.";

    }
    else {

        skeleton.defeated = true;

        skeletonBattleMessage =
            "* O esqueleto foi derrotado!";
    }

    setSkeletonPhase(
        "ended",
        80,
        returnFromSkeletonBattle
    );
}


function returnFromSkeletonBattle() {

    gameMode = "world";

    skeletonBattleStarted = false;

    projectiles = [];

    stopSkeletonMusic();

    startWaterfallMusic();
}


// ============================================================
// RUÍDO
// ============================================================

function noise(x, y) {

    const s =
        Math.sin(
            x * 127.1 +
            y * 311.7
        ) *
        43758.5453;

    return s -
        Math.floor(s);
}


// ============================================================
// CÂMERA
// ============================================================

function getCameraX(
    playerX,
    playerWidth
) {

    let cam =
        playerX -
        WORLD_WIDTH / 2 +
        playerWidth / 2;

    cam =
        Math.max(
            0,
            Math.min(
                cam,
                LEVEL_WIDTH -
                WORLD_WIDTH
            )
        );

    return cam;
}


// ============================================================
// DESENHAR MUNDO
// ============================================================

function draw(
    state,
    timestamp
) {

    if (!ctx || !state)
        return;

    ctx.clearRect(
        0,
        0,
        WORLD_WIDTH,
        WORLD_HEIGHT
    );

    const cameraX =
        getCameraX(
            state.player.x,
            state.player.width
        );

    drawNightBackground(
        WORLD_WIDTH,
        WORLD_HEIGHT,
        cameraX,
        timestamp
    );

    ctx.save();

    ctx.translate(
        -cameraX,
        0
    );

    for (
        const p of state.platforms
    ) {

        drawPlatformTiles(p);
    }

    drawGoblin(timestamp);

    drawSkeletonWorld(timestamp);

    drawGoal(
        state.goal,
        timestamp
    );

    const isMoving =
        !!keys["ArrowLeft"] ||
        !!keys["KeyA"] ||
        !!keys["ArrowRight"] ||
        !!keys["KeyD"];

    drawPlayer(
        state.player,
        timestamp,
        isMoving
    );

    ctx.restore();

    if (state.won)
        drawWinScreen(
            WORLD_WIDTH,
            WORLD_HEIGHT
        );
}


// ============================================================
// FUNDO ANTIGO
// ============================================================

const STARS = (() => {

    const arr = [];

    for (
        let i = 0;
        i < 45;
        i++
    ) {

        arr.push({

            x:
                noise(i, 1) *
                WORLD_WIDTH,

            y:
                noise(i, 2) *
                (WORLD_HEIGHT * 0.55),

            twinkleOffset:
                noise(i, 3) *
                1000,

            plus:
                noise(i, 4) >
                0.85
        });
    }

    return arr;

})();


function drawNightBackground(
    W,
    H,
    cameraX,
    timestamp
) {

    const bandColors = [
        "#2b2e77",
        "#33357f",
        "#3b3d8c",
        "#454798",
        "#5153a3"
    ];

    const bandHeight =
        H /
        bandColors.length;

    for (
        let i = 0;
        i < bandColors.length;
        i++
    ) {

        ctx.fillStyle =
            bandColors[i];

        ctx.fillRect(
            0,
            i * bandHeight,
            W,
            bandHeight + 1
        );
    }

    // estrelas
    for (
        const s of STARS
    ) {

        const tw =
            0.6 +
            0.4 *
            Math.sin(
                (timestamp +
                    s.twinkleOffset) /
                600
            );

        ctx.fillStyle =
            `rgba(255,255,255,${tw.toFixed(2)})`;

        if (s.plus) {

            ctx.fillRect(
                s.x - 3,
                s.y,
                7,
                2
            );

            ctx.fillRect(
                s.x,
                s.y - 3,
                2,
                7
            );

        }
        else {

            ctx.fillRect(
                s.x,
                s.y,
                3,
                3
            );
        }
    }

    // lua
    const moonX =
        W * 0.68 -
        cameraX * 0.04;

    const moonY =
        H * 0.30;

    const moonR = 78;

    ctx.fillStyle =
        "#ecdcc0";

    ctx.beginPath();

    ctx.arc(
        moonX,
        moonY,
        moonR,
        0,
        Math.PI * 2
    );

    ctx.fill();

    ctx.fillStyle =
        "rgba(200,185,160,0.35)";

    ctx.beginPath();
    ctx.arc(
        moonX - 20,
        moonY - 10,
        16,
        0,
        Math.PI * 2
    );
    ctx.fill();

    ctx.beginPath();
    ctx.arc(
        moonX + 15,
        moonY + 20,
        22,
        0,
        Math.PI * 2
    );
    ctx.fill();

    ctx.beginPath();
    ctx.arc(
        moonX + 25,
        moonY - 25,
        10,
        0,
        Math.PI * 2
    );
    ctx.fill();

    // castelos antigos
    drawCastleSkyline(
        cameraX,
        W,
        H,
        0.25,
        H * 0.62,
        "#241f3d"
    );

    // nuvens antigas
    drawPurpleClouds(
        cameraX,
        W,
        H,
        0.45,
        H * 0.72,
        "#33294f",
        "#3d3160"
    );

    drawPurpleClouds(
        cameraX,
        W,
        H,
        0.65,
        H * 0.84,
        "#291f42",
        "#332a52"
    );
}


function drawCastleSkyline(
    cameraX,
    W,
    H,
    parallax,
    baseY,
    color
) {

    const offset =
        cameraX * parallax;

    const step = 24;

    ctx.fillStyle = color;

    for (
        let sx = -step;
        sx < W + step;
        sx += step
    ) {

        const worldX =
            sx + offset;

        const idx =
            Math.floor(
                worldX / step
            );

        const n =
            noise(idx, 10);

        let h =
            50 + n * 70;

        const isTower =
            noise(idx, 20) >
            0.82;

        if (isTower)
            h += 60;

        ctx.fillRect(
            sx,
            baseY - h,
            step - 2,
            h + (H - baseY)
        );

        if (
            Math.floor(
                worldX /
                (step / 2)
            ) % 2 === 0
        ) {

            ctx.fillRect(
                sx,
                baseY - h - 10,
                step - 2,
                10
            );
        }

        if (isTower) {

            ctx.beginPath();

            ctx.moveTo(
                sx - 4,
                baseY - h
            );

            ctx.lineTo(
                sx +
                (step - 2) / 2,
                baseY - h - 30
            );

            ctx.lineTo(
                sx + step + 2,
                baseY - h
            );

            ctx.closePath();

            ctx.fill();
        }
    }
}


function drawPurpleClouds(
    cameraX,
    W,
    H,
    parallax,
    baseY,
    darkColor,
    lightColor
) {

    const offset =
        cameraX * parallax;

    const px = 14;

    const mound = [
        [0, 0, 1, 1, 1, 1, 0, 0],
        [0, 1, 1, 1, 1, 1, 1, 0],
        [1, 1, 1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 1]
    ];

    const moundWidth =
        mound[0].length *
        px;

    const startIdx =
        Math.floor(
            (offset - moundWidth) /
            (moundWidth * 0.6)
        );

    const endIdx =
        Math.ceil(
            (offset + W + moundWidth) /
            (moundWidth * 0.6)
        );

    for (
        let m = startIdx;
        m < endIdx;
        m++
    ) {

        const mx =
            m *
            (moundWidth * 0.6) -
            offset;

        const varH =
            noise(m, 30) >
                0.5
                ? 0
                : 1;

        for (
            let row = 0;
            row < mound.length;
            row++
        ) {

            for (
                let col = 0;
                col < mound[row].length;
                col++
            ) {

                if (
                    !mound[row][col]
                )
                    continue;

                ctx.fillStyle =
                    row < 1 + varH
                        ? lightColor
                        : darkColor;

                ctx.fillRect(
                    mx + col * px,
                    baseY + row * px,
                    px,
                    px
                );
            }
        }
    }

    ctx.fillStyle =
        darkColor;

    ctx.fillRect(
        0,
        baseY +
        mound.length * px,
        W,
        H -
        (baseY +
            mound.length * px)
    );
}


// ============================================================
// PLATAFORMAS
// ============================================================

function drawPlatformTiles(p) {

    const cols =
        Math.ceil(
            p.width / TILE
        );

    const rows =
        Math.ceil(
            p.height / TILE
        );

    for (
        let row = 0;
        row < rows;
        row++
    ) {

        for (
            let col = 0;
            col < cols;
            col++
        ) {

            const tx =
                p.x +
                col * TILE;

            const ty =
                p.y +
                row * TILE;

            const w =
                Math.min(
                    TILE,
                    p.x +
                    p.width -
                    tx
                );

            const h =
                Math.min(
                    TILE,
                    p.y +
                    p.height -
                    ty
                );

            if (
                row === 0
            ) {

                ctx.fillStyle =
                    "#8be05a";

                ctx.fillRect(
                    tx,
                    ty,
                    w,
                    h * 0.25
                );

                ctx.fillStyle =
                    "#5cb85c";

                ctx.fillRect(
                    tx,
                    ty + h * 0.25,
                    w,
                    h * 0.35
                );

                ctx.fillStyle =
                    "#3f8a3f";

                ctx.fillRect(
                    tx,
                    ty + h * 0.6,
                    w,
                    h * 0.4
                );

            }
            else {

                const isDark =
                    (row + col) %
                    2 === 0;

                ctx.fillStyle =
                    isDark
                        ? "#7A4A22"
                        : "#8B5A2C";

                ctx.fillRect(
                    tx,
                    ty,
                    w,
                    h
                );
            }
        }
    }
}


// ============================================================
// BANDEIRA
// ============================================================

function drawGoal(
    goal,
    timestamp
) {

    ctx.fillStyle =
        "#a1887f";

    ctx.fillRect(
        goal.x +
        goal.width / 2 -
        3,
        goal.y - 24,
        6,
        goal.height + 24
    );

    const wave =
        Math.sin(
            timestamp / 200
        ) * 6;

    ctx.fillStyle =
        "#ffd54f";

    ctx.beginPath();

    ctx.moveTo(
        goal.x +
        goal.width / 2 +
        3,
        goal.y - 20
    );

    ctx.lineTo(
        goal.x +
        goal.width / 2 +
        36 +
        wave,
        goal.y - 10
    );

    ctx.lineTo(
        goal.x +
        goal.width / 2 +
        3,
        goal.y
    );

    ctx.closePath();

    ctx.fill();
}


// ============================================================
// GOBLIN — PIXEL ART
// ============================================================

function drawGoblin(timestamp) {

    if (
        goblin.defeated ||
        goblin.spared
    )
        return;

    ctx.save();

    const bob =
        Math.sin(
            timestamp / 300
        ) * 2;

    ctx.translate(
        goblin.x,
        goblin.y + bob
    );

    drawGoblinSprite(
        timestamp,
        false
    );

    ctx.restore();
}


// ============================================================
// GOBLIN DA BATALHA
// ============================================================

function drawBattleGoblin(
    x,
    y,
    timestamp
) {

    ctx.save();

    ctx.translate(
        x,
        y
    );

    const scale = 1.45;

    ctx.scale(
        scale,
        scale
    );

    drawGoblinSprite(
        timestamp,
        true
    );

    ctx.restore();
}


// ============================================================
// SPRITE DO GOBLIN
// ============================================================

function drawGoblinSprite(
    timestamp,
    battle
) {

    const bob =
        Math.sin(
            timestamp / 280
        ) * 2;

    ctx.save();

    ctx.translate(
        0,
        bob
    );

    ctx.fillStyle =
        "rgba(0,0,0,0.35)";

    ctx.beginPath();

    ctx.ellipse(
        75,
        118,
        62,
        10,
        0,
        0,
        Math.PI * 2
    );

    ctx.fill();

    // porrete
    ctx.save();

    ctx.translate(
        123,
        65
    );

    ctx.rotate(
        -0.12
    );

    ctx.fillStyle =
        "#5a321d";

    ctx.fillRect(
        0,
        -6,
        10,
        75
    );

    ctx.fillStyle =
        "#70411f";

    ctx.fillRect(
        3,
        -5,
        6,
        70
    );

    ctx.fillStyle =
        "#4b2b1a";

    ctx.fillRect(
        -12,
        -25,
        34,
        38
    );

    ctx.fillStyle =
        "#6b3d20";

    ctx.fillRect(
        -18,
        -18,
        42,
        25
    );

    ctx.fillRect(
        -10,
        -28,
        25,
        12
    );

    ctx.restore();

    // pernas
    ctx.fillStyle =
        "#4d762d";

    ctx.fillRect(
        38,
        89,
        22,
        30
    );

    ctx.fillRect(
        82,
        89,
        22,
        30
    );

    // pés
    ctx.fillStyle =
        "#365522";

    ctx.fillRect(
        29,
        111,
        35,
        12
    );

    ctx.fillRect(
        79,
        111,
        35,
        12
    );

    // corpo
    ctx.fillStyle =
        "#648a35";

    ctx.fillRect(
        29,
        53,
        85,
        50
    );

    ctx.fillStyle =
        "#779b39";

    ctx.fillRect(
        40,
        58,
        23,
        15
    );

    ctx.fillRect(
        74,
        72,
        27,
        17
    );

    ctx.fillStyle =
        "#4e722d";

    ctx.fillRect(
        63,
        53,
        18,
        15
    );

    ctx.fillRect(
        92,
        85,
        20,
        15
    );

    // tanga
    ctx.fillStyle =
        "#56331e";

    ctx.fillRect(
        37,
        82,
        70,
        27
    );

    ctx.fillStyle =
        "#75451f";

    ctx.fillRect(
        44,
        88,
        56,
        14
    );

    ctx.fillStyle =
        "#3e2517";

    ctx.fillRect(
        62,
        83,
        8,
        25
    );

    // braços
    ctx.fillStyle =
        "#587f30";

    ctx.fillRect(
        11,
        55,
        28,
        42
    );

    ctx.fillRect(
        105,
        54,
        28,
        42
    );

    // mãos
    ctx.fillStyle =
        "#486b29";

    ctx.fillRect(
        6,
        87,
        25,
        18
    );

    ctx.fillRect(
        110,
        87,
        25,
        18
    );

    // orelhas
    ctx.fillStyle =
        "#4d742c";

    ctx.beginPath();

    ctx.moveTo(
        37,
        20
    );

    ctx.lineTo(
        -4,
        5
    );

    ctx.lineTo(
        8,
        48
    );

    ctx.lineTo(
        40,
        40
    );

    ctx.closePath();
    ctx.fill();

    ctx.beginPath();

    ctx.moveTo(
        106,
        20
    );

    ctx.lineTo(
        150,
        4
    );

    ctx.lineTo(
        137,
        48
    );

    ctx.lineTo(
        104,
        40
    );

    ctx.closePath();
    ctx.fill();

    ctx.fillStyle =
        "#758d35";

    ctx.beginPath();

    ctx.moveTo(
        31,
        22
    );

    ctx.lineTo(
        8,
        12
    );

    ctx.lineTo(
        17,
        37
    );

    ctx.closePath();
    ctx.fill();

    ctx.beginPath();

    ctx.moveTo(
        112,
        22
    );

    ctx.lineTo(
        140,
        11
    );

    ctx.lineTo(
        131,
        38
    );

    ctx.closePath();
    ctx.fill();

    // cabeça
    ctx.fillStyle =
        "#668b35";

    ctx.fillRect(
        27,
        10,
        91,
        58
    );

    ctx.fillRect(
        39,
        2,
        67,
        15
    );

    ctx.fillRect(
        20,
        25,
        14,
        30
    );

    ctx.fillRect(
        111,
        25,
        14,
        30
    );

    // manchas
    ctx.fillStyle =
        "#78983a";

    ctx.fillRect(
        36,
        16,
        20,
        15
    );

    ctx.fillRect(
        81,
        12,
        23,
        18
    );

    ctx.fillRect(
        28,
        40,
        22,
        14
    );

    ctx.fillStyle =
        "#4e702c";

    ctx.fillRect(
        55,
        8,
        17,
        16
    );

    ctx.fillRect(
        99,
        36,
        19,
        17
    );

    // olhos
    ctx.fillStyle =
        "#090909";

    ctx.fillRect(
        40,
        32,
        22,
        14
    );

    ctx.fillRect(
        84,
        32,
        22,
        14
    );

    ctx.fillStyle =
        "#1c1c1c";

    ctx.fillRect(
        43,
        34,
        4,
        4
    );

    ctx.fillRect(
        87,
        34,
        4,
        4
    );

    // nariz
    ctx.fillStyle =
        "#52752c";

    ctx.fillRect(
        65,
        43,
        16,
        13
    );

    // boca
    ctx.fillStyle =
        "#263719";

    ctx.fillRect(
        53,
        53,
        42,
        9
    );

    // dentes
    ctx.fillStyle =
        "#d7cda0";

    ctx.fillRect(
        60,
        53,
        6,
        7
    );

    ctx.fillRect(
        76,
        53,
        6,
        7
    );

    // sobrancelhas
    ctx.fillStyle =
        "#3e6026";

    ctx.fillRect(
        37,
        27,
        28,
        6
    );

    ctx.fillRect(
        81,
        27,
        28,
        6
    );

    ctx.restore();
}


// ============================================================
// ESQUELETO NO MAPA
// ============================================================

function drawSkeletonWorld(
    timestamp
) {

    if (
        skeleton.defeated ||
        skeleton.spared
    ) {
        return;
    }

    ctx.save();

    ctx.translate(
        skeleton.x,
        skeleton.y +
        Math.sin(
            timestamp / 260
        ) * 1.5
    );

    drawSkeletonSprite();

    ctx.restore();
}


// ============================================================
// ESQUELETO NA BATALHA
// ============================================================

function drawBattleSkeleton(
    x,
    y,
    timestamp
) {

    ctx.save();

    ctx.translate(
        x - 64,
        y +
        Math.sin(
            timestamp / 260
        ) * 1.5
    );

    ctx.scale(
        2,
        2
    );

    drawSkeletonSprite();

    ctx.restore();
}


// ============================================================
// SPRITE DO ESQUELETO
// ============================================================

function drawSkeletonSprite() {

    ctx.fillStyle =
        "rgba(0,0,0,0.35)";

    ctx.beginPath();

    ctx.ellipse(
        32,
        78,
        25,
        4,
        0,
        0,
        Math.PI * 2
    );

    ctx.fill();

    // pernas
    ctx.fillStyle = "#d9d4c6";

    ctx.fillRect(20, 54, 7, 20);
    ctx.fillRect(38, 54, 7, 20);

    // pés
    ctx.fillRect(14, 71, 14, 6);
    ctx.fillRect(37, 71, 14, 6);

    // coluna
    ctx.fillRect(29, 34, 7, 25);

    // costelas
    ctx.fillStyle = "#e5e0d2";

    ctx.fillRect(18, 36, 28, 5);
    ctx.fillRect(20, 44, 24, 5);
    ctx.fillRect(23, 51, 18, 4);

    ctx.fillStyle = "#26232a";

    ctx.fillRect(24, 40, 16, 3);
    ctx.fillRect(25, 48, 14, 2);

    // braços
    ctx.fillStyle = "#d9d4c6";

    ctx.fillRect(11, 36, 7, 22);
    ctx.fillRect(6, 53, 10, 6);

    ctx.fillRect(46, 36, 7, 22);
    ctx.fillRect(49, 53, 10, 6);

    // crânio
    ctx.fillStyle = "#e8e3d5";

    ctx.fillRect(17, 4, 30, 24);
    ctx.fillRect(13, 9, 38, 15);

    // mandíbula
    ctx.fillStyle = "#d5d0c3";

    ctx.fillRect(20, 27, 24, 8);

    // olhos
    ctx.fillStyle = "#17151b";

    ctx.fillRect(21, 12, 8, 8);
    ctx.fillRect(36, 12, 8, 8);

    // brilho roxo
    ctx.fillStyle = "#8d68ad";

    ctx.fillRect(24, 15, 3, 3);
    ctx.fillRect(39, 15, 3, 3);

    // nariz
    ctx.fillStyle = "#343039";

    ctx.fillRect(30, 20, 5, 5);

    // boca
    ctx.fillStyle = "#26232a";

    ctx.fillRect(23, 29, 18, 3);

    // dentes
    ctx.fillStyle = "#eee9db";

    for (
        let x = 24;
        x <= 39;
        x += 5
    ) {
        ctx.fillRect(
            x,
            29,
            2,
            3
        );
    }

    // rachaduras
    ctx.fillStyle = "#aaa497";

    ctx.fillRect(17, 7, 6, 2);
    ctx.fillRect(20, 9, 2, 5);
    ctx.fillRect(45, 7, 2, 7);

    // espada
    ctx.save();

    ctx.translate(
        57,
        48
    );

    ctx.rotate(
        -0.35
    );

    ctx.fillStyle = "#bfc6cc";
    ctx.fillRect(-2, -19, 5, 23);

    ctx.fillStyle = "#e4eaee";
    ctx.fillRect(1, -19, 2, 20);

    ctx.fillStyle = "#8b7850";
    ctx.fillRect(-6, 2, 13, 3);

    ctx.fillStyle = "#5c3823";
    ctx.fillRect(-2, 5, 5, 10);

    ctx.restore();
}


// ============================================================
// JOGADOR
// ============================================================

const PLAYER_PALETTE = {

    D: "#14161a",
    M: "#9aa0a6",
    N: "#5c6167",
    F: "#e8c9a0",
    P: "#2f6f8f",
    G: "#d6dade",
    K: "#000000"
};

const PLAYER_BODY = [
    "...DPPPPD.......",
    "..DMMMMMMMD.....",
    ".DMMGMMMMMMD....",
    ".DMMMMMMMMMMD...",
    ".DMMMMMMFFKFFD..",
    "..DMMMMMFFFFD...",
    "..DMMMMMMMMD....",
    "...DNNNNNND.....",
    "..DMMMMMMMMD....",
    "..DMMPPPPMMMMD..",
    "..DMMMMMMMMFFD..",
    "...DMMMMMMD.....",
    "...DNNNNNND.....",
    "...DNNNNNND....."
];

const LEGS_STAND = [
    "...DNNNDDNNND...",
    "....NNN..NNN....",
    "...DDDDDDDDDD..."
];

const LEGS_WALK_A = [
    "...DNNNDDNNNND..",
    "....NNN...NNNN..",
    "...DDDDD...DDDD."
];

const LEGS_WALK_B = [
    "..DNNNNDDNNND...",
    "...NNNN..NNN....",
    "..DDDDDDDDDD...."
];

const LEGS_JUMP = [
    "..DNNNNDDNNNNND.",
    "..DDDDD..DDDDD..",
    "................"
];


function drawPlayer(
    p,
    timestamp,
    isMoving
) {

    const cols = 17;

    const rows =
        PLAYER_BODY.length + 3;

    const bw =
        p.width / cols;

    const bh =
        p.height / rows;

    let legs;
    let bob = 0;

    if (!p.isGrounded) {

        legs =
            LEGS_JUMP;

    }
    else if (isMoving) {

        const frame =
            Math.floor(
                timestamp / 130
            ) % 2;

        legs =
            frame === 0
                ? LEGS_WALK_A
                : LEGS_WALK_B;

        bob =
            frame === 0
                ? 0
                : -bh * 0.5;

    }
    else {

        legs =
            LEGS_STAND;
    }

    const sprite =
        PLAYER_BODY.concat(
            legs
        );

    ctx.save();

    if (facingLeft) {

        ctx.translate(
            p.x + p.width,
            p.y + bob
        );

        ctx.scale(
            -1,
            1
        );

    }
    else {

        ctx.translate(
            p.x,
            p.y + bob
        );
    }

    for (
        let r = 0;
        r < sprite.length;
        r++
    ) {

        for (
            let c = 0;
            c < sprite[r].length;
            c++
        ) {

            const ch =
                sprite[r][c];

            if (ch === ".")
                continue;

            ctx.fillStyle =
                PLAYER_PALETTE[ch];

            ctx.fillRect(
                Math.round(
                    c * bw
                ),
                Math.round(
                    r * bh
                ),
                Math.ceil(bw),
                Math.ceil(bh)
            );
        }
    }

    ctx.restore();
}


// ============================================================
// TELA DE VITÓRIA
// ============================================================

function drawWinScreen(
    W,
    H
) {

    ctx.fillStyle =
        "rgba(0,0,0,0.7)";

    ctx.fillRect(
        0,
        0,
        W,
        H
    );

    ctx.fillStyle =
        "#ffd54f";

    ctx.font =
        "bold 52px sans-serif";

    ctx.textAlign =
        "center";

    ctx.fillText(
        "FASE CONCLUÍDA!",
        W / 2,
        H / 2 - 16
    );

    ctx.fillStyle =
        "#fff";

    ctx.font =
        "26px sans-serif";

    ctx.fillText(
        "Aperte R para reiniciar",
        W / 2,
        H / 2 + 40
    );

    ctx.textAlign =
        "left";
}


// ============================================================
// TELA DE BATALHA DO GOBLIN
// ============================================================

function drawBattle(
    timestamp
) {

    ctx.clearRect(
        0,
        0,
        WORLD_WIDTH,
        WORLD_HEIGHT
    );

    ctx.fillStyle =
        "#000";

    ctx.fillRect(
        0,
        0,
        WORLD_WIDTH,
        WORLD_HEIGHT
    );

    ctx.fillStyle =
        "#fff";

    ctx.font =
        "bold 30px monospace";

    ctx.textAlign =
        "center";

    ctx.fillText(
        "GOBLIN",
        WORLD_WIDTH / 2,
        50
    );

    drawBattleGoblin(
        WORLD_WIDTH / 2,
        105,
        timestamp
    );

    ctx.textAlign =
        "left";

    ctx.font =
        "20px monospace";

    ctx.fillStyle =
        "#fff";

    ctx.fillText(
        "GOBLIN",
        330,
        320
    );

    ctx.fillText(
        goblinHP +
        " / " +
        goblinMaxHP,
        825,
        320
    );

    ctx.fillStyle =
        "#402020";

    ctx.fillRect(
        500,
        307,
        300,
        18
    );

    ctx.fillStyle =
        "#e84b4b";

    ctx.fillRect(
        500,
        307,
        300 *
        (goblinHP /
            goblinMaxHP),
        18
    );

    const arena =
        getBattleArena();

    ctx.strokeStyle =
        "#fff";

    ctx.lineWidth = 4;

    ctx.strokeRect(
        arena.x,
        arena.y,
        arena.width,
        arena.height
    );

    if (
        battlePhase ===
        "enemyAttack"
    ) {

        drawEnemyProjectiles();

        drawHeart();
    }

    if (
        battlePhase ===
        "attackBar"
    ) {

        drawAttackBar();
    }

    ctx.fillStyle =
        "#fff";

    ctx.font =
        "20px monospace";

    ctx.fillText(
        "HP",
        350,
        650
    );

    ctx.fillText(
        playerHP +
        " / " +
        playerMaxHP,
        580,
        650
    );

    ctx.fillStyle =
        "#4b2020";

    ctx.fillRect(
        670,
        633,
        250,
        18
    );

    ctx.fillStyle =
        "#e84b4b";

    ctx.fillRect(
        670,
        633,
        250 *
        (playerHP /
            playerMaxHP),
        18
    );

    if (
        battlePhase ===
        "menu"
    ) {

        drawBattleMenu();
    }

    if (
        battlePhase ===
        "message" ||
        battlePhase ===
        "ended"
    ) {

        drawBattleMessage();
    }
}


// ============================================================
// BARRA DE ATAQUE VISUAL
// ============================================================

function drawAttackBar() {

    const x = 330;
    const y = 350;
    const width = 620;
    const height = 35;

    ctx.fillStyle =
        "#242424";

    ctx.fillRect(
        x,
        y,
        width,
        height
    );

    ctx.fillStyle =
        "#8d2929";

    ctx.fillRect(
        x,
        y,
        width * 0.38,
        height
    );

    ctx.fillStyle =
        "#d6a735";

    ctx.fillRect(
        x + width * 0.38,
        y,
        width * 0.24,
        height
    );

    ctx.fillStyle =
        "#8d2929";

    ctx.fillRect(
        x + width * 0.62,
        y,
        width * 0.38,
        height
    );

    ctx.fillStyle =
        "#fff";

    ctx.fillRect(
        x + width * 0.495,
        y,
        width * 0.01,
        height
    );

    const cursorX =
        x +
        attackBarPosition *
        width;

    ctx.fillStyle =
        "#ffffff";

    ctx.fillRect(
        cursorX - 4,
        y - 10,
        8,
        height + 20
    );

    ctx.fillStyle =
        "#fff";

    ctx.font =
        "18px monospace";

    ctx.textAlign =
        "center";

    ctx.fillText(
        "APERTE ENTER / ESPAÇO!",
        WORLD_WIDTH / 2,
        405
    );

    ctx.textAlign =
        "left";
}


// ============================================================
// MENU GOBLIN
// ============================================================

function drawBattleMenu() {

    const options = [
        "LUTAR",
        "AGIR",
        "ITEM",
        "POUPAR"
    ];

    const startX = 200;
    const y = 690;
    const spacing = 250;

    ctx.font =
        "bold 25px monospace";

    ctx.textAlign =
        "center";

    for (
        let i = 0;
        i < options.length;
        i++
    ) {

        const x =
            startX +
            i * spacing;

        ctx.strokeStyle =
            i === battleMenu
                ? "#ffd54f"
                : "#fff";

        ctx.lineWidth =
            i === battleMenu
                ? 4
                : 2;

        ctx.strokeRect(
            x - 95,
            y - 28,
            190,
            45
        );

        ctx.fillStyle =
            i === battleMenu
                ? "#ffd54f"
                : "#fff";

        ctx.fillText(
            options[i],
            x,
            y + 5
        );
    }

    ctx.textAlign =
        "left";
}


function drawBattleMessage() {

    ctx.fillStyle =
        "#fff";

    ctx.font =
        "20px monospace";

    ctx.textAlign =
        "center";

    ctx.fillText(
        battleMessage,
        WORLD_WIDTH / 2,
        355
    );

    ctx.textAlign =
        "left";
}


// ============================================================
// PROJÉTEIS GOBLIN
// ============================================================

function drawEnemyProjectiles() {

    for (
        const p of projectiles
    ) {

        if (
            p.type === "axe" ||
            p.type === "axeRain"
        ) {

            drawAxeProjectile(
                p.x,
                p.y,
                p.angle || 0
            );

        }
        else if (
            p.type === "rock"
        ) {

            drawRockProjectile(
                p.x,
                p.y,
                p.angle || 0
            );

        }
        else {

            drawGreenProjectile(
                p.x,
                p.y
            );
        }
    }
}


function drawAxeProjectile(
    x,
    y,
    angle
) {

    ctx.save();

    ctx.translate(
        x,
        y
    );

    ctx.rotate(
        angle
    );

    ctx.fillStyle =
        "#6b3f24";

    ctx.fillRect(
        -4,
        -22,
        8,
        44
    );

    ctx.fillStyle =
        "#aeb8c0";

    ctx.fillRect(
        3,
        -23,
        20,
        46
    );

    ctx.fillStyle =
        "#e5edf3";

    ctx.fillRect(
        9,
        -20,
        12,
        40
    );

    ctx.restore();
}


function drawRockProjectile(
    x,
    y,
    angle
) {

    ctx.save();

    ctx.translate(
        x,
        y
    );

    ctx.rotate(
        angle
    );

    ctx.fillStyle =
        "#777";

    ctx.fillRect(
        -9,
        -9,
        18,
        18
    );

    ctx.fillStyle =
        "#999";

    ctx.fillRect(
        -5,
        -7,
        8,
        6
    );

    ctx.restore();
}


function drawGreenProjectile(
    x,
    y
) {

    ctx.fillStyle =
        "#a5c83b";

    ctx.fillRect(
        x - 7,
        y - 7,
        14,
        14
    );

    ctx.fillStyle =
        "#d2e85a";

    ctx.fillRect(
        x - 3,
        y - 3,
        6,
        6
    );
}


// ============================================================
// CORAÇÃO
// ============================================================

function drawHeart() {

    const x =
        heart.x;

    const y =
        heart.y;

    const flashing =
        invulnTimer > 0 &&
        Math.floor(
            invulnTimer / 4
        ) % 2 === 0;

    ctx.fillStyle =
        flashing
            ? "#888"
            : "#ff3b3b";

    ctx.beginPath();

    ctx.moveTo(
        x,
        y + 13
    );

    ctx.lineTo(
        x - 14,
        y - 2
    );

    ctx.lineTo(
        x - 11,
        y - 11
    );

    ctx.lineTo(
        x - 3,
        y - 11
    );

    ctx.lineTo(
        x,
        y - 6
    );

    ctx.lineTo(
        x + 3,
        y - 11
    );

    ctx.lineTo(
        x + 11,
        y - 11
    );

    ctx.lineTo(
        x + 14,
        y - 2
    );

    ctx.closePath();

    ctx.fill();
}


// ============================================================
// TELA DE BATALHA DO ESQUELETO
// ============================================================

function drawSkeletonBattle(
    timestamp
) {

    ctx.clearRect(
        0,
        0,
        WORLD_WIDTH,
        WORLD_HEIGHT
    );

    ctx.fillStyle = "#000";

    ctx.fillRect(
        0,
        0,
        WORLD_WIDTH,
        WORLD_HEIGHT
    );

    ctx.fillStyle = "#fff";
    ctx.font = "bold 30px monospace";
    ctx.textAlign = "center";

    ctx.fillText(
        "ESQUELETO",
        WORLD_WIDTH / 2,
        50
    );

    drawBattleSkeleton(
        WORLD_WIDTH / 2,
        100,
        timestamp
    );

    ctx.textAlign = "left";
    ctx.font = "20px monospace";
    ctx.fillStyle = "#fff";

    ctx.fillText(
        "ESQUELETO",
        330,
        320
    );

    ctx.fillText(
        skeletonHP +
        " / " +
        skeletonMaxHP,
        825,
        320
    );

    ctx.fillStyle = "#2f2238";

    ctx.fillRect(
        500,
        307,
        300,
        18
    );

    ctx.fillStyle = "#9b6fd0";

    ctx.fillRect(
        500,
        307,
        300 *
        (
            skeletonHP /
            skeletonMaxHP
        ),
        18
    );

    const arena =
        getBattleArena();

    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 4;

    ctx.strokeRect(
        arena.x,
        arena.y,
        arena.width,
        arena.height
    );

    if (
        skeletonBattlePhase ===
        "enemyAttack"
    ) {

        drawSkeletonProjectiles();

        drawHeart();
    }

    if (
        skeletonBattlePhase ===
        "attackBar"
    ) {

        drawAttackBar();
    }

    ctx.fillStyle = "#fff";
    ctx.font = "20px monospace";

    ctx.fillText(
        "HP",
        350,
        650
    );

    ctx.fillText(
        playerHP +
        " / " +
        playerMaxHP,
        580,
        650
    );

    ctx.fillStyle = "#4b2020";

    ctx.fillRect(
        670,
        633,
        250,
        18
    );

    ctx.fillStyle = "#e84b4b";

    ctx.fillRect(
        670,
        633,
        250 *
        (
            playerHP /
            playerMaxHP
        ),
        18
    );

    if (
        skeletonBattlePhase ===
        "menu"
    ) {

        drawSkeletonBattleMenu();
    }

    if (
        skeletonBattlePhase ===
        "message" ||
        skeletonBattlePhase ===
        "ended"
    ) {

        drawSkeletonBattleMessage();
    }
}


// ============================================================
// MENU DO ESQUELETO
// ============================================================

function drawSkeletonBattleMenu() {

    const options = [
        "LUTAR",
        "AGIR",
        "ITEM",
        "POUPAR"
    ];

    const startX = 200;
    const y = 690;
    const spacing = 250;

    ctx.font =
        "bold 25px monospace";

    ctx.textAlign =
        "center";

    for (
        let i = 0;
        i < options.length;
        i++
    ) {

        const x =
            startX +
            i * spacing;

        ctx.strokeStyle =
            i === skeletonBattleMenu
                ? "#b98cff"
                : "#fff";

        ctx.lineWidth =
            i === skeletonBattleMenu
                ? 4
                : 2;

        ctx.strokeRect(
            x - 95,
            y - 28,
            190,
            45
        );

        ctx.fillStyle =
            i === skeletonBattleMenu
                ? "#b98cff"
                : "#fff";

        ctx.fillText(
            options[i],
            x,
            y + 5
        );
    }

    ctx.textAlign =
        "left";
}


function drawSkeletonBattleMessage() {

    ctx.fillStyle = "#fff";
    ctx.font = "20px monospace";
    ctx.textAlign = "center";

    ctx.fillText(
        skeletonBattleMessage,
        WORLD_WIDTH / 2,
        355
    );

    ctx.textAlign = "left";
}


// ============================================================
// DESENHO DOS ATAQUES DO ESQUELETO
// ============================================================

function drawSkeletonProjectiles() {

    for (
        const p of projectiles
    ) {

        if (
            p.type === "bone" ||
            p.type === "boneWall" ||
            p.type === "boneSide"
        ) {

            drawBoneProjectile(
                p.x,
                p.y,
                p.angle || 0
            );

        }
        else if (
            p.type === "boneSpike"
        ) {

            drawBoneSpike(
                p
            );
        }
    }
}


function drawBoneProjectile(
    x,
    y,
    angle
) {

    ctx.save();

    ctx.translate(
        x,
        y
    );

    ctx.rotate(
        angle
    );

    ctx.fillStyle = "#eee9db";

    ctx.fillRect(
        -4,
        -17,
        8,
        34
    );

    ctx.fillRect(-8, -20, 7, 7);
    ctx.fillRect(1, -20, 7, 7);

    ctx.fillRect(-8, 13, 7, 7);
    ctx.fillRect(1, 13, 7, 7);

    ctx.restore();
}


function drawBoneSpike(
    p
) {

    if (
        p.warningTimer > 0
    ) {

        const flash =
            Math.floor(
                p.warningTimer / 5
            ) % 2 === 0;

        ctx.fillStyle =
            flash
                ? "#b98cff"
                : "#59436c";

        ctx.fillRect(
            p.x - 18,
            p.y - 3,
            36,
            5
        );

        ctx.fillRect(
            p.x - 7,
            p.y - 10,
            14,
            3
        );

        return;
    }

    ctx.fillStyle = "#eee9db";

    ctx.beginPath();

    ctx.moveTo(
        p.x,
        p.y - 65
    );

    ctx.lineTo(
        p.x - 18,
        p.y
    );

    ctx.lineTo(
        p.x + 18,
        p.y
    );

    ctx.closePath();

    ctx.fill();
}