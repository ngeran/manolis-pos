import { config } from "dotenv";
config({ path: ".env.local" });

import { db } from "./index";
import { users, categories, menuItems } from "./schema";
import { hashSync } from "bcryptjs";

async function seed() {
  console.log("Seeding database...");

  // ── Users ──
  const adminPassword = hashSync("admin123", 10);
  await db
    .insert(users)
    .values([
      { email: "admin@manolis.local", password: adminPassword, name: "Admin", role: "admin" },
      { email: "staff@manolis.local", password: hashSync("staff123", 10), name: "Staff Member", role: "staff" },
    ])
    .onConflictDoNothing();

  // ── Categories ──
  const categoryData = [
    { nameEl: "Ορεκτικά", nameEn: "Appetizers", sortOrder: 0 },
    { nameEl: "Σαλάτες", nameEn: "Salads", sortOrder: 1 },
    { nameEl: "Κρεατικά", nameEn: "Meats", sortOrder: 2 },
    { nameEl: "Ψάρια", nameEn: "Fish", sortOrder: 3 },
    { nameEl: "Ποτά", nameEn: "Drinks", sortOrder: 4 },
  ];

  const insertedCategories = await db
    .insert(categories)
    .values(categoryData)
    .onConflictDoNothing()
    .returning();

  const allCategories =
    insertedCategories.length > 0
      ? insertedCategories
      : await db.select().from(categories);

  const catMap = Object.fromEntries(allCategories.map((c) => [c.nameEl, c.id]));

  // ── Menu Items ──
  const items = [
    // Ορεκτικά
    { nameEl: "Ψωμί", nameEn: "Bread", categoryId: catMap["Ορεκτικά"]!, priceCents: 100, available: true },
    { nameEl: "Πατάτες Τηγανιτές", nameEn: "French Fries", categoryId: catMap["Ορεκτικά"]!, priceCents: 400, available: true },
    { nameEl: "Κολοκύθακια Τηγανητά", nameEn: "Fried Zucchini", categoryId: catMap["Ορεκτικά"]!, priceCents: 500, available: true },
    { nameEl: "Φέτα", nameEn: "Feta Cheese", categoryId: catMap["Ορεκτικά"]!, priceCents: 450, available: true },
    { nameEl: "Φέτα Ψητή", nameEn: "Grilled Feta Cheese with tomato/pepper/oregano", categoryId: catMap["Ορεκτικά"]!, priceCents: 700, available: true },
    { nameEl: "Γραβιέρα", nameEn: "Gruyere, can be served Grilled", categoryId: catMap["Ορεκτικά"]!, priceCents: 500, available: true },
    { nameEl: "Ταλαγάνι", nameEn: "Farmer Cheese, Talagani grilled", categoryId: catMap["Ορεκτικά"]!, priceCents: 600, available: true },
    { nameEl: "Φάβα", nameEn: "Split Peas", categoryId: catMap["Ορεκτικά"]!, priceCents: 600, available: true },
    { nameEl: "Γαύρος Μαρινάτος", nameEn: "Anchovy In Oil And Salt", categoryId: catMap["Ορεκτικά"]!, priceCents: 900, available: true },
    { nameEl: "Μελιτζάνες στο φούρνο", nameEn: "Eggplant From The Oven (Ιμαμ)", categoryId: catMap["Ορεκτικά"]!, priceCents: 700, available: true },
    { nameEl: "Ρεβίθια Φούρνου με Κάρυ", nameEn: "Chickpeas from the Oven with Curry", categoryId: catMap["Ορεκτικά"]!, priceCents: 700, available: true },
    { nameEl: "Τζατζίκι Σπιτικό", nameEn: "Homemade Tzatziki", categoryId: catMap["Ορεκτικά"]!, priceCents: 500, available: true },
    { nameEl: "Τυροκαυτερή Σπιτική", nameEn: "Homemade Spicy Cheese Cream", categoryId: catMap["Ορεκτικά"]!, priceCents: 500, available: true },
    { nameEl: "Χωριάτικη Πίτα Ημέρας", nameEn: "Country Pie", categoryId: catMap["Ορεκτικά"]!, priceCents: 600, available: true },
    { nameEl: "Κεφτέδες Σπιτικοί", nameEn: "Homemade Meatballs", categoryId: catMap["Ορεκτικά"]!, priceCents: 800, available: true },

    // Σαλάτες
    { nameEl: "Ντοματοσαλάτα", nameEn: "Tomato Salad", categoryId: catMap["Σαλάτες"]!, priceCents: 400, available: true },
    { nameEl: "Κολοκυθάκια Βραστά", nameEn: "Boiled Zucchini", categoryId: catMap["Σαλάτες"]!, priceCents: 500, available: true },
    { nameEl: "Μπρόκολο", nameEn: "Broccoli", categoryId: catMap["Σαλάτες"]!, priceCents: 500, available: true },
    { nameEl: "Χωριάτικη Σαλάτα", nameEn: "Greek Traditional Salad", categoryId: catMap["Σαλάτες"]!, priceCents: 800, available: true },
    { nameEl: "Ρόκα Σαλάτα", nameEn: "Rocket Salad", categoryId: catMap["Σαλάτες"]!, priceCents: 800, available: true },
    { nameEl: "Λάχανο - Καρότο", nameEn: "Cabbage - Carrot Salad", categoryId: catMap["Σαλάτες"]!, priceCents: 500, available: true },
    { nameEl: "Πολίτικη Σαλάτα", nameEn: "Mix Pickled Salad", categoryId: catMap["Σαλάτες"]!, priceCents: 600, available: true },
    { nameEl: "Χόρτα", nameEn: "Boiled Greens", categoryId: catMap["Σαλάτες"]!, priceCents: 500, available: true },

    // Κρεατικά
    { nameEl: "Χοιρινή Μπριζόλα", nameEn: "Pork Steak", categoryId: catMap["Κρεατικά"]!, priceCents: 1200, available: true },
    { nameEl: "Μοσχαρίσια Γάλακτος", nameEn: "Beef Steak", categoryId: catMap["Κρεατικά"]!, priceCents: 1500, available: true },
    { nameEl: "Καπνιστή Χοιρινή Μπριζόλα", nameEn: "Smoked Pork Steak", categoryId: catMap["Κρεατικά"]!, priceCents: 1300, available: true },
    { nameEl: "Μπιφτέκια", nameEn: "Homemade Burger", categoryId: catMap["Κρεατικά"]!, priceCents: 1000, available: true },
    { nameEl: "Ψαρονέφρι", nameEn: "Pork Tender Loin", categoryId: catMap["Κρεατικά"]!, priceCents: 1200, available: true },
    { nameEl: "Συκώτι Μοσχαρίσιο", nameEn: "Liver", categoryId: catMap["Κρεατικά"]!, priceCents: 1200, available: true },
    { nameEl: "Κοντοσούβλι Κοτόπουλο", nameEn: "Chicken Souvlaki", categoryId: catMap["Κρεατικά"]!, priceCents: 1200, available: true },
    { nameEl: "Λουκάνικο Χωριάτικο", nameEn: "Sausage", categoryId: catMap["Κρεατικά"]!, priceCents: 800, available: true },
    { nameEl: "Παϊδάκια Αρνίσια", nameEn: "Lamb Chops", categoryId: catMap["Κρεατικά"]!, priceCents: 3800, pricingType: "weight", available: true },

    // Ψάρια
    { nameEl: "Σαρδέλα στα Κάρβουνα", nameEn: "Grilled Sardines", categoryId: catMap["Ψάρια"]!, priceCents: 1200, available: true },
    { nameEl: "Γαύρος Τηγανητός", nameEn: "Anchovies", categoryId: catMap["Ψάρια"]!, priceCents: 1000, available: true },
    { nameEl: "Καλαμαράκια Φρέσκα", nameEn: "Fresh Calamari", categoryId: catMap["Ψάρια"]!, priceCents: 1000, available: true },
    { nameEl: "Κουτσομούρες", nameEn: "Fried Mullets", categoryId: catMap["Ψάρια"]!, priceCents: 4000, pricingType: "weight", available: true },
    { nameEl: "Μπακαλιαράκια Τηγανητά / Ψητά", nameEn: "Cod Fish", categoryId: catMap["Ψάρια"]!, priceCents: 4000, pricingType: "weight", available: true },
    { nameEl: "Τσιπούρα", nameEn: "Porgies", categoryId: catMap["Ψάρια"]!, priceCents: 4500, pricingType: "weight", available: true },

    // Ποτά
    { nameEl: "Κρασί Χύμα Λευκό Μαλαγουζιά", nameEn: "House Wine White 0.5 lt", categoryId: catMap["Ποτά"]!, priceCents: 500, available: true },
    { nameEl: "Κρασί Χύμα Ροζέ Ημίξηρο", nameEn: "House Wine Rosé 0.5 lt", categoryId: catMap["Ποτά"]!, priceCents: 500, available: true },
    { nameEl: "Κρασί Χύμα Αγιωργίτικο Κόκκινο", nameEn: "House Wine Red 0.5 lt", categoryId: catMap["Ποτά"]!, priceCents: 500, available: true },
    { nameEl: "Μπύρες", nameEn: "Beers Bottle 500ml", categoryId: catMap["Ποτά"]!, priceCents: 350, available: true },
    { nameEl: "Αναψυκτικά", nameEn: "Refreshments", categoryId: catMap["Ποτά"]!, priceCents: 200, available: true },
    { nameEl: "Τσικουδιά / Τσίπουρο 50ml", nameEn: "Tsipouro 50ml", categoryId: catMap["Ποτά"]!, priceCents: 200, available: true },
    { nameEl: "Τσικουδιά / Τσίπουρο 200ml", nameEn: "Tsipouro 200ml", categoryId: catMap["Ποτά"]!, priceCents: 800, available: true },
    { nameEl: "Ούζο 200ml", nameEn: "Ouzo 200ml", categoryId: catMap["Ποτά"]!, priceCents: 300, available: true },
  ];

  await db.insert(menuItems).values(items).onConflictDoNothing();

  console.log(`Seeded ${items.length} menu items across ${categoryData.length} categories.`);
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
