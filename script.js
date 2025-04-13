// script.js

/***** Variabel Game *****/
let playerBets = [];
let spinning = false;
let wheelAngle = 0;
let ballAngle = 0;
let wheelSpinAngle = 0;
let ballSpinAngle = 0;
const duration = 10000; // Durasi animasi spin (10 detik)
const ballPathRadius = 220;
const ballRadius = 8;
const ballOffset = 90;       // Agar 0° logika berada di atas
const wheelVisualOffset = 86; // Offset untuk gambar roda

// --- Taruhan berbasis ETH ---
// Saldo diambil langsung dari wallet yang dikoneksikan
let connectedWalletAddress = null;
let walletBalance = 0;
// Nilai taruhan yang dipilih (default 0.01 ETH)
let selectedBetAmount = 0.001;

// Urutan angka roulette (Eropa dengan 37 angka)
const numbers = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30,
  8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29,
  7, 28, 12, 35, 3, 26
];

/***** Seleksi Elemen HTML *****/
const betContainer = document.getElementById("betContainer");
const boardWrapper = document.getElementById("boardWrapper");
const chipPlacementContainer = document.getElementById("chipPlacementContainer");
const resultDiv = document.getElementById("result");
const betButton = document.getElementById("betButton");
const canvas = document.getElementById("rouletteCanvas");
const ctx = canvas.getContext("2d");
const countdownTimerDiv = document.getElementById("countdownTimer");
const spinHistoryDiv = document.getElementById("spinHistory");

// Elemen untuk wallet dan nilai taruhan
const connectWalletButton = document.getElementById("connectWalletButton");
const walletAddressDiv = document.getElementById("walletAddress");
const walletBalanceDiv = document.getElementById("walletBalance");
const selectedBetSpan = document.getElementById("selectedBet");

// Muat Gambar Roda Roulette
const wheelImage = new Image();
wheelImage.src = "wheel.webp";
wheelImage.onload = () => {
  // Gambar roda siap digunakan
};

/***** Konfigurasi Smart Contract *****/
// Ganti dengan alamat kontrak dan ABI sesuai smart contract kamu
const contractAddress = "0x5dEEa86FAA8f83ceF2CFf0D989bF5D66F8a52045"; // Ganti dengan alamat kontrak
const contractABI = [
  {
    "inputs": [],
    "name": "placeBet",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "address", "name": "bettor", "type": "address" },
      { "indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256" }
    ],
    "name": "BetPlaced",
    "type": "event"
  }
];

/***** Fungsi Koneksi Wallet dan Update Saldo *****/
async function connectWallet() {
  if (window.ethereum) {
    try {
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      connectedWalletAddress = await signer.getAddress();
      walletAddressDiv.innerText = connectedWalletAddress;
      updateWalletBalance(provider, connectedWalletAddress);
      return { provider, signer };
    } catch (error) {
      console.error("Failed to connect wallet :", error);
      return null;
    }
  } else {
    alert("Metamask not detected .");
    return null;
  }
}

async function updateWalletBalance(provider, address) {
  try {
    const balanceWei = await provider.getBalance(address);
    walletBalance = ethers.utils.formatEther(balanceWei);
    walletBalanceDiv.innerText = walletBalance + " ETH";
  } catch (err) {
    console.error("Failed to detect balance:", err);
  }
}

/***** Fungsi Pilih Nilai Taruhan *****/
function selectBetAmount(amount) {
  selectedBetAmount = amount;
  selectedBetSpan.innerText = selectedBetAmount;
}

/***** Fungsi Taruhan dan Logika Permainan *****/
// Fungsi checkWin menentukan multiplier berdasarkan taruhan dan hasil spin
function checkWin(bet, result) {
  if (bet === 'RED' || bet === 'BLACK') {
    const reds = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
    if (result === 0) return 0;
    if (bet === 'RED' && reds.includes(result)) return 2;
    if (bet === 'BLACK' && !reds.includes(result) && result !== 0) return 2;
    return 0;
  } else if (bet === 'EVEN') {
    if (result !== 0 && result % 2 === 0) return 2;
    return 0;
  } else if (bet === 'ODD') {
    if (result !== 0 && result % 2 === 1) return 2;
    return 0;
  } else if (bet === '1-18') {
    if (result >= 1 && result <= 18) return 2;
    return 0;
  } else if (bet === '19-36') {
    if (result >= 19 && result <= 36) return 2;
    return 0;
  } else if (bet === '1st12') {
    if (result >= 1 && result <= 12) return 3;
    return 0;
  } else if (bet === '2nd12') {
    if (result >= 13 && result <= 24) return 3;
    return 0;
  } else if (bet === '3rd12') {
    if (result >= 25 && result <= 36) return 3;
    return 0;
  } else {
    if (result == bet) return 36;
    return 0;
  }
}

// Fungsi placeBet: menangani klik pada boardWrapper untuk memasang taruhan
function placeBet(value, event) {
  if (spinning || betConfirmed) return;
  const rect = boardWrapper.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const betObj = { value: value, betEth: selectedBetAmount, coordinates: { x, y } };
  playerBets.push(betObj);
  let betsText = playerBets.map(b => b.value).join(", ");
  resultDiv.innerText = "Your Bets: " + betsText + ". Click bets to confirm.";
  
  // Tampilkan representasi chip (visual)
  const chipClone = document.createElement("div");
  chipClone.classList.add("placedChip");
  chipClone.innerText = selectedBetAmount;
  chipClone.style.left = (x - 20) + "px";
  chipClone.style.top = (y - 20) + "px";
  chipPlacementContainer.appendChild(chipClone);
}

// Fungsi undoBet: menghapus taruhan terakhir
function undoBet() {
  if (spinning || betConfirmed || playerBets.length === 0) return;
  playerBets.pop();
  if (chipPlacementContainer.lastChild) {
    chipPlacementContainer.removeChild(chipPlacementContainer.lastChild);
  }
  let betsText = playerBets.map(b => b.value).join(", ");
  resultDiv.innerText = betsText 
    ? "Your Bets: " + betsText + ". Click bet to confirm."
    : "no bets.";
}

// Fungsi clearBets: menghapus semua taruhan yang telah dipasang
function clearBets() {
  if (spinning || betConfirmed) return;
  playerBets = [];
  chipPlacementContainer.innerHTML = "";
  resultDiv.innerText = "All bets are cleared.";
}

/***** Variabel Ronde dan Timer *****/
let countdown = 15;
let countdownInterval = null;
let betConfirmed = false;     // Status taruhan dikunci
let roundInProgress = false;

// Fungsi startNewRound: reset ronde dan mulai hitung mundur
function startNewRound() {
  // Perbarui saldo wallet
  if (window.ethereum && connectedWalletAddress) {
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    updateWalletBalance(provider, connectedWalletAddress);
  }
  
  playerBets = [];
  chipPlacementContainer.innerHTML = "";
  resultDiv.innerText = "Place your bets";
  countdown = 15;
  countdownTimerDiv.innerText = `Betting time : ${countdown}`;
  betContainer.style.display = "block";
  canvas.style.display = "none";
  betConfirmed = false;
  roundInProgress = true;
  countdownInterval = setInterval(() => {
    countdown--;
    countdownTimerDiv.innerText = `Betting time : ${countdown}`;
    if (countdown <= 0) {
      clearInterval(countdownInterval);
      resultDiv.innerText = betConfirmed
        ? ""
        : "";
      betContainer.style.display = "none";
      canvas.style.display = "block";
      spinWheel();
    }
  }, 1000);
}

// Fungsi confirmBet: kunci taruhan dan kirim transaksi ke smart contract
async function confirmBet() {
  if (spinning || betConfirmed) return;
  if (playerBets.length === 0) {
    alert("No betting.");
    return;
  }
  
  // Hitung total taruhan dalam ETH
  const totalBet = playerBets.reduce((sum, b) => sum + b.betEth, 0);
  if (parseFloat(totalBet) > parseFloat(walletBalance)) {
    alert("Wallet balance is insufficient .");
    return;
  }
  
  betConfirmed = true;
  resultDiv.innerText = "Sending transactions...";
  
  // Lakukan transaksi nyata ke smart contract
  await sendRealBetTransaction(totalBet);
  
  // Setelah transaksi berhasil, lanjutkan ke spin
  resultDiv.innerText = "Transaction successful, waiting...";
}

/***** Fungsi untuk Mengirim Transaksi ke Smart Contract *****/
async function sendRealBetTransaction(totalBetEth) {
  const walletData = await connectWallet();
  if (!walletData) return;
  const { provider, signer } = walletData;
  const contract = new ethers.Contract(contractAddress, contractABI, signer);
  const betValue = ethers.utils.parseEther(totalBetEth.toString());
  try {
    const tx = await contract.placeBet({ value: betValue });
    console.log("sending transaction. Hash:", tx.hash);
    const receipt = await tx.wait();
    console.log("transaction completed:", receipt);
    // Perbarui saldo wallet setelah transaksi
    const address = await signer.getAddress();
    updateWalletBalance(provider, address);
    alert("beeting succes!");
  } catch (error) {
    console.error("Transaction failed!:", error);
    alert("transaction failed,please try again later....");
  }
}

/***** Fungsi Spin dan Animasi Roulette *****/
function spinWheel() {
  if (spinning) return;
  spinning = true;
  
  // Animasi spin: putar roda dan bola secara acak
  wheelSpinAngle = Math.random() * 360 + 1440;
  ballSpinAngle  = - (Math.random() * 360 + 720);
  let startTime = null;
  function animate(timestamp) {
    if (!startTime) startTime = timestamp;
    const progress = timestamp - startTime;
    const t = Math.min(progress / duration, 1);
    const eased = easeOut(t);
    wheelAngle = (wheelSpinAngle * eased) % 360;
    ballAngle  = (ballSpinAngle * eased) % 360;
    drawScene();
    if (t < 1) {
      requestAnimationFrame(animate);
    } else {
      // Hitung hasil spin
      const finalBallAngle = ((ballAngle + ballOffset) % 360 + 360) % 360;
      let relativeAngle = ((finalBallAngle - wheelAngle - wheelVisualOffset) % 360 + 360) % 360;
      const sectorAngle = 360 / numbers.length;
      const index = Math.floor(relativeAngle / sectorAngle);
      const resultNumber = numbers[index];
      let winnings = 0;
      let winBets = [];
      playerBets.forEach(bet => {
        const multiplier = checkWin(bet.value, resultNumber);
        if (multiplier > 0) {
          winnings += bet.betEth * multiplier;
          winBets.push(bet.value);
        }
      });
      let resultText = "result: " + resultNumber + ". ";
      if (winnings > 0) {
        resultText += "Win: " + winBets.join(", ") +
                      ". You Win! " + winnings + " ETH!";
      } else {
        resultText += "You lose!.";
      }
      resultDiv.innerText = resultText;
      appendSpinHistory(resultNumber);
      spinning = false;
      setTimeout(() => {
        roundInProgress = false;
        startNewRound();
      }, 3000);
    }
  }
  requestAnimationFrame(animate);
}

function appendSpinHistory(resultNumber) {
  const circle = document.createElement("div");
  circle.classList.add("spinResultCircle");
  circle.style.backgroundColor = getColorForNumber(resultNumber);
  circle.textContent = resultNumber;
  spinHistoryDiv.insertBefore(circle, spinHistoryDiv.firstChild);
}

function drawScene() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(250, 250);
  ctx.rotate((wheelAngle * Math.PI) / 180);
  ctx.translate(-250, -250);
  ctx.drawImage(wheelImage, 0, 0, 500, 500);
  ctx.restore();
  drawBall();
}

function drawBall() {
  const drawnAngle = ballAngle - ballOffset;
  const rad = (drawnAngle * Math.PI) / 180;
  const ballX = 250 + ballPathRadius * Math.cos(rad);
  const ballY = 250 + ballPathRadius * Math.sin(rad);
  ctx.fillStyle = "white";
  ctx.beginPath();
  ctx.arc(ballX, ballY, ballRadius, 0, 2 * Math.PI);
  ctx.fill();
  ctx.strokeStyle = "black";
  ctx.stroke();
}

function easeOut(t) {
  return 1 - Math.pow(1 - t, 3);
}

function getColorForNumber(n) {
  if (n === 0) return "green";
  const reds = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
  return reds.includes(n) ? "red" : "black";
}

// Fungsi resetGame untuk memulai ulang permainan secara manual
function resetGame() {
  spinning = false;
  wheelAngle = 0;
  ballAngle = 0;
  chipPlacementContainer.innerHTML = "";
  startNewRound();
}

/***** Inisialisasi dan Event Listener *****/
window.onload = () => {
  startNewRound();
  connectWalletButton.addEventListener("click", connectWallet);
  betButton.addEventListener("click", confirmBet);
  // Contoh: memasang taruhan dengan klik pada boardWrapper (misalnya, taruhan "RED")
  boardWrapper.addEventListener("click", (e) => {
    placeBet("RED", e);
  });
};

const io = require('socket.io')(server); // Server yang sudah dibuat dengan Express

let gameState = {
  countdown: 15, // Countdown yang dimulai dari 15 detik
  bets: [] // Array untuk menyimpan taruhan pemain
};

// Kirimkan status game setiap kali player terhubung
io.on('connection', (socket) => {
  console.log('A user connected');

  // Kirimkan game state ke user yang baru saja terhubung
  socket.emit('gameState', gameState);

  // Kirim countdown tiap detik
  setInterval(() => {
    gameState.countdown--;
    io.emit('countdown', gameState.countdown); // Kirimkan countdown ke semua user

    if (gameState.countdown <= 0) {
      // Reset countdown dan lakukan spin
      gameState.countdown = 15;
      const result = Math.floor(Math.random() * 36); // Hasil acak untuk spin
      io.emit('spinResult', result);
      gameState.bets = []; // Reset taruhan setelah spin
    }
  }, 1000);

  // Menangani taruhan yang dipasang oleh pemain
  socket.on('placeBet', (bet) => {
    gameState.bets.push(bet); // Tambah taruhan ke array
    console.log('Taruhan ditempatkan: ', bet);
    io.emit('betPlaced', bet); // Memberitahukan semua pemain bahwa ada taruhan baru
  });

  // Ketika pengguna disconnect
  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});