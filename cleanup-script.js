
import { getCustomers, deleteCustomer } from './db.js';

const KEEP_NAMES = [
    "Renuka",
    "Niswan",
    "Nithya Karthi Rent",
    "Patti near",
    "Priya Andalnagar"
];

async function cleanupCustomers() {
    console.log("🚀 Starting forced customer cleanup...");

    // Bypass local cache if possible by fetching directly
    const customers = await getCustomers();
    console.log(`📊 Total customers found: ${customers.length}`);

    const toDelete = customers.filter(c => !KEEP_NAMES.includes(c.name));
    const toKeep = customers.filter(c => KEEP_NAMES.includes(c.name));

    console.log(`✅ Keeping (${toKeep.length}): ${toKeep.map(c => c.name).join(", ")}`);
    console.log(`❌ To Delete: ${toDelete.length}`);

    for (const c of toDelete) {
        try {
            console.log(`🗑️ Deleting: ${c.name} (${c.id})...`);
            await deleteCustomer(c.id);
        } catch (err) {
            console.error(`❌ Failed to delete ${c.name}:`, err);
        }
    }

    console.log("✨ Cleanup complete. Please refresh the page.");
}

// Expose to window for easy console execution
window.cleanupCustomers = cleanupCustomers;
window.runCleanup = cleanupCustomers; // Alias for convenience
