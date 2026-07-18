import { world, system } from "@minecraft/server";
import { ActionFormResponse, MessageFormResponse } from "@minecraft/server-ui";
import { itemPrices, getItemPrice } from "./config.js";

// Database saldo pemain (disimpan di memory, reset saat server restart)
// Untuk produksi, gunakan DynamicProperties atau database eksternal
const playerBalances = new Map();

// Mendapatkan saldo pemain
export function getBalance(playerId) {
    return playerBalances.get(playerId) || 0;
}

// Mengatur saldo pemain
export function setBalance(playerId, amount) {
    playerBalances.set(playerId, Math.max(0, amount)); // Tidak boleh negatif
}

// Menambahkan saldo
export function addBalance(playerId, amount) {
    const current = getBalance(playerId);
    setBalance(playerId, current + amount);
}

// Mengurangi saldo
export function removeBalance(playerId, amount) {
    const current = getBalance(playerId);
    if (current >= amount) {
        setBalance(playerId, current - amount);
        return true;
    }
    return false;
}

// Transfer saldo antar pemain
export function transferBalance(fromPlayerId, toPlayerId, amount) {
    if (removeBalance(fromPlayerId, amount)) {
        addBalance(toPlayerId, amount);
        return true;
    }
    return false;
}

// Inisialisasi saldo default jika belum ada
export function initializePlayer(playerId) {
    if (!playerBalances.has(playerId)) {
        setBalance(playerId, 100); // Bonus awal $100
    }
}
