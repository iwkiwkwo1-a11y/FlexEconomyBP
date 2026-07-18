import { world, system } from "@minecraft/server";
import { getBalance, addBalance, initializePlayer } from "./economy.js";
import { getItemPrice } from "./config.js";

// Cek apakah UI tersedia sebelum mengimpor
let ModalFormData = null;
try {
    const uiModule = await import("@minecraft/server-ui");
    ModalFormData = uiModule.ModalFormData;
} catch (e) {
    console.warn("[Flex Economy] Module @minecraft/server-ui tidak tersedia. Fitur UI mungkin tidak berjalan.");
}

// Fungsi untuk mendapatkan item yang bisa dijual dari inventory pemain
function getSellableItems(player) {
    const container = player.getComponent("minecraft:inventory")?.container;
    if (!container) return [];

    const sellableItems = [];
    
    for (let i = 0; i < container.size; i++) {
        const item = container.getItem(i);
        if (item && item.typeId !== "minecraft:air") {
            const price = getItemPrice(item.typeId);
            if (price > 0) {
                sellableItems.push({
                    slot: i,
                    item: item,
                    price: price,
                    totalValue: price * item.amount
                });
            }
        }
    }
    
    return sellableItems;
}

// Menampilkan UI Virtual Chest untuk sell
async function showVirtualChest(player, sellableItems) {
    if (sellableItems.length === 0) {
        player.sendMessage("§c[Virtual Chest] Tidak ada item yang bisa dijual di inventory kamu!");
        return;
    }

    // Cek apakah UI tersedia
    if (!ModalFormData) {
        player.sendMessage("§c[Error] Fitur UI tidak tersedia di server ini.");
        player.sendMessage("§eGunakan /sell all untuk menjual semua item secara otomatis.");
        sellAllItems(player, sellableItems);
        return;
    }

    // Buat daftar item untuk ditampilkan
    let itemButtons = [];
    let itemData = [];
    
    for (const sellItem of sellableItems) {
        const itemName = sellItem.item.nameTag || sellItem.item.typeId.replace("minecraft:", "");
        const displayName = itemName.charAt(0).toUpperCase() + itemName.slice(1);
        itemButtons.push(`${displayName} x${sellItem.item.amount} - $${sellItem.totalValue}`);
        itemData.push(sellItem);
    }
    
    // Tambahkan opsi "Jual Semua"
    itemButtons.push("§a[JUAL SEMUA] - Total: $" + sellableItems.reduce((sum, item) => sum + item.totalValue, 0));
    itemData.push({ type: "all" });
    
    // Buat form
    const form = new ModalFormData();
    form.title("Virtual Chest - Jual Item");
    
    // Gunakan dropdown untuk memilih item
    form.dropdown("Pilih item yang ingin dijual:", itemButtons, 0);
    
    try {
        const response = await form.show(player);
        
        if (response.canceled) return;
        
        const selectedIndex = response.formValues[0];
        const selectedItem = itemData[selectedIndex];
        
        if (selectedItem.type === "all") {
            // Jual semua item
            sellAllItems(player, sellableItems);
        } else {
            // Jual item tertentu
            sellItem(player, selectedItem);
        }
    } catch (error) {
        console.error("Error showing virtual chest:", error);
        player.sendMessage("§c[Error] Gagal membuka Virtual Chest.");
    }
}

// Menjual item tertentu
function sellItem(player, sellData) {
    const container = player.getComponent("minecraft:inventory")?.container;
    if (!container) return;
    
    const item = container.getItem(sellData.slot);
    if (!item) {
        player.sendMessage("§c[Virtual Chest] Item sudah tidak ada di slot tersebut!");
        return;
    }
    
    // Hapus item dari inventory
    container.setItem(sellData.slot, undefined);
    
    // Tambahkan saldo
    addBalance(player.id, sellData.totalValue);
    
    player.sendMessage(`§a[Virtual Chest] Berhasil menjual ${item.amount}x ${item.typeId.replace("minecraft:", "")} seharga $${sellData.totalValue}!`);
    player.sendMessage(`§eSaldo kamu sekarang: $${getBalance(player.id)}`);
}

// Menjual semua item
function sellAllItems(player, sellableItems) {
    const container = player.getComponent("minecraft:inventory")?.container;
    if (!container) return;
    
    let totalEarned = 0;
    let itemsSold = 0;
    
    // Urutkan dari slot terbesar ke terkecil agar tidak bermasalah saat menghapus
    const sortedItems = [...sellableItems].sort((a, b) => b.slot - a.slot);
    
    for (const sellData of sortedItems) {
        const item = container.getItem(sellData.slot);
        if (item) {
            container.setItem(sellData.slot, undefined);
            totalEarned += sellData.totalValue;
            itemsSold++;
        }
    }
    
    if (itemsSold > 0) {
        addBalance(player.id, totalEarned);
        player.sendMessage(`§a[Virtual Chest] Berhasil menjual ${itemsSold} jenis item!`);
        player.sendMessage(`§aTotal pendapatan: $${totalEarned}`);
        player.sendMessage(`§eSaldo kamu sekarang: $${getBalance(player.id)}`);
    } else {
        player.sendMessage("§c[Virtual Chest] Tidak ada item yang berhasil dijual.");
    }
}

// Command handler
export function handleCommand(args, player) {
    initializePlayer(player.id);
    
    if (args.length === 0) {
        // /sell - Tampilkan virtual chest
        const sellableItems = getSellableItems(player);
        showVirtualChest(player, sellableItems);
    } else if (args[0] === "all") {
        // /sell all - Jual semua item
        const sellableItems = getSellableItems(player);
        sellAllItems(player, sellableItems);
    } else {
        // /sell [nomor/nama] - Jual item spesifik (implementasi sederhana)
        player.sendMessage("§eGunakan /sell untuk membuka Virtual Chest, atau /sell all untuk menjual semua item.");
    }
}

// Pastikan world tersedia sebelum registrasi event
if (!world || !world.beforeEvents) {
    console.error("Gagal mengakses world atau beforeEvents. Pastikan Script API aktif.");
} else {
    // Register command handler - PERBAIKAN UNTUK VERSI 1.26+
    // Gunakan playerChat event yang tersedia di versi terbaru
    const chatEvent = world.beforeEvents.playerChat || world.beforeEvents.chatSend;
    
    if (chatEvent) {
        chatEvent.subscribe((event) => {
            // Di versi baru, event.message adalah string, event.sender adalah player
            const message = event.message.toLowerCase().trim();
            
            if (message.startsWith("/sell")) {
                event.cancel = true; // Cancel chat message
                
                const args = message.slice(5).trim().split(/\s+/);
                handleCommand(args, event.sender);
            }
            
            // Command untuk cek saldo
            if (message.startsWith("/money") || message.startsWith("/balance") || message.startsWith("/bal")) {
                event.cancel = true;
                initializePlayer(event.sender.id);
                const balance = getBalance(event.sender.id);
                event.sender.sendMessage(`§eSaldo kamu: §a$${balance}`);
            }
            
            // Command untuk transfer
            if (message.startsWith("/pay")) {
                event.cancel = true;
                const parts = message.slice(4).trim().split(/\s+/);
                
                if (parts.length < 2) {
                    event.sender.sendMessage("§cGunakan: /pay <pemain> <jumlah>");
                    return;
                }
                
                const targetName = parts[0];
                const amount = parseInt(parts[1]);
                
                if (isNaN(amount) || amount <= 0) {
                    event.sender.sendMessage("§cJumlah harus berupa angka positif!");
                    return;
                }
                
                // Cari pemain target
                const targetPlayer = world.getPlayers({ name: targetName })[0];
                
                if (!targetPlayer) {
                    event.sender.sendMessage(`§cPemain "${targetName}" tidak ditemukan!`);
                    return;
                }
                
                initializePlayer(event.sender.id);
                initializePlayer(targetPlayer.id);
                
                // Import dinamis untuk menghindari circular dependency jika ada
                const economyModule = require("./economy.js");
                if (economyModule.transferBalance) {
                    if (economyModule.transferBalance(event.sender.id, targetPlayer.id, amount)) {
                        event.sender.sendMessage(`§aBerhasil mengirim $${amount} ke ${targetPlayer.name}!`);
                        targetPlayer.sendMessage(`§aKamu menerima $${amount} dari ${event.sender.name}!`);
                    } else {
                        event.sender.sendMessage("§cSaldo tidak mencukupi!");
                    }
                } else {
                    console.error("Fungsi transferBalance tidak ditemukan di economy.js");
                }
            }
        });
    } else {
        console.warn("Tidak ada event chat yang tersedia. Perintah custom mungkin tidak berfungsi.");
    }

    // Welcome message saat player join
    world.afterEvents.playerJoin.subscribe((event) => {
        const player = event.player;
        initializePlayer(player.id);
        player.sendMessage("§a=== Flex Economy System ===");
        player.sendMessage("§eGunakan /sell untuk membuka Virtual Chest");
        player.sendMessage("§eGunakan /money untuk cek saldo");
        player.sendMessage("§eGunakan /pay <pemain> <jumlah> untuk transfer");
        player.sendMessage(`§eBonus awal: §a$${getBalance(player.id)}`);
    });
}
