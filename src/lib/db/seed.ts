import { config } from "dotenv";
config({ path: ".env.local" });

import { db } from "./index";
import { users, categories, menuItems, stations, diningTables } from "./schema";
import { hashSync } from "bcryptjs";

type StationSlug = "grill" | "fryer" | "salads" | "bar";

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

  // ── Prep stations ──
  await db
    .insert(stations)
    .values([
      { slug: "grill", nameEl: "Σχάρα", nameEn: "Grill", sortOrder: 0 },
      { slug: "fryer", nameEl: "Τηγάνι", nameEn: "Fryer", sortOrder: 1 },
      { slug: "salads", nameEl: "Κρύα", nameEn: "Cold Pass", sortOrder: 2 },
      { slug: "bar", nameEl: "Μπαρ", nameEn: "Bar", sortOrder: 3 },
    ])
    .onConflictDoNothing();

  const allStations = await db.select().from(stations);
  const stationMap = Object.fromEntries(allStations.map((s) => [s.slug, s.id]));

  // ── Dining tables (1–12: 2/4/6 seats) ──
  await db
    .insert(diningTables)
    .values([
      ...Array.from({ length: 6 }, (_, i) => ({ name: String(i + 1), seats: 2, sortOrder: i })),
      ...Array.from({ length: 4 }, (_, i) => ({ name: String(i + 7), seats: 4, sortOrder: i + 6 })),
      ...Array.from({ length: 2 }, (_, i) => ({ name: String(i + 11), seats: 6, sortOrder: i + 10 })),
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
  const items: Array<Omit<typeof menuItems.$inferInsert, "stationId"> & { station: StationSlug }> = [
    // Ορεκτικά
    { nameEl: "Ψωμί", nameEn: "Bread", categoryId: catMap["Ορεκτικά"]!, priceCents: 100, available: true, station: "salads" },
    { nameEl: "Πατάτες Τηγανιτές", nameEn: "French Fries", categoryId: catMap["Ορεκτικά"]!, priceCents: 400, available: true, station: "fryer" },
    { nameEl: "Κολοκύθακια Τηγανητά", nameEn: "Fried Zucchini", categoryId: catMap["Ορεκτικά"]!, priceCents: 500, available: true, station: "fryer" },
    { nameEl: "Φέτα", nameEn: "Feta Cheese", categoryId: catMap["Ορεκτικά"]!, priceCents: 450, available: true, station: "salads" },
    { nameEl: "Φέτα Ψητή", nameEn: "Grilled Feta Cheese with tomato/pepper/oregano", categoryId: catMap["Ορεκτικά"]!, priceCents: 700, available: true, station: "grill" },
    { nameEl: "Γραβιέρα", nameEn: "Gruyere, can be served Grilled", categoryId: catMap["Ορεκτικά"]!, priceCents: 500, available: true, station: "grill" },
    { nameEl: "Ταλαγάνι", nameEn: "Farmer Cheese, Talagani grilled", categoryId: catMap["Ορεκτικά"]!, priceCents: 600, available: true, station: "grill" },
    { nameEl: "Φάβα", nameEn: "Split Peas", categoryId: catMap["Ορεκτικά"]!, priceCents: 600, available: true, station: "salads" },
    { nameEl: "Γαύρος Μαρινάτος", nameEn: "Anchovy In Oil And Salt", categoryId: catMap["Ορεκτικά"]!, priceCents: 900, available: true, station: "salads" },
    { nameEl: "Μελιτζάνες στο φούρνο", nameEn: "Eggplant From The Oven (Ιμαμ)", categoryId: catMap["Ορεκτικά"]!, priceCents: 700, available: true, station: "grill" },
    { nameEl: "Ρεβίθια Φούρνου με Κάρυ", nameEn: "Chickpeas from the Oven with Curry", categoryId: catMap["Ορεκτικά"]!, priceCents: 700, available: true, station: "grill" },
    { nameEl: "Τζατζίκι Σπιτικό", nameEn: "Homemade Tzatziki", categoryId: catMap["Ορεκτικά"]!, priceCents: 500, available: true, station: "salads" },
    { nameEl: "Τυροκαυτερή Σπιτική", nameEn: "Homemade Spicy Cheese Cream", categoryId: catMap["Ορεκτικά"]!, priceCents: 500, available: true, station: "salads" },
    { nameEl: "Χωριάτικη Πίτα Ημέρας", nameEn: "Country Pie", categoryId: catMap["Ορεκτικά"]!, priceCents: 600, available: true, station: "grill" },
    { nameEl: "Κεφτέδες Σπιτικοί", nameEn: "Homemade Meatballs", categoryId: catMap["Ορεκτικά"]!, priceCents: 800, available: true, station: "fryer" },

    // Σαλάτες
    { nameEl: "Ντοματοσαλάτα", nameEn: "Tomato Salad", categoryId: catMap["Σαλάτες"]!, priceCents: 400, available: true, station: "salads" },
    { nameEl: "Κολοκυθάκια Βραστά", nameEn: "Boiled Zucchini", categoryId: catMap["Σαλάτες"]!, priceCents: 500, available: true, station: "salads" },
    { nameEl: "Μπρόκολο", nameEn: "Broccoli", categoryId: catMap["Σαλάτες"]!, priceCents: 500, available: true, station: "salads" },
    { nameEl: "Χωριάτικη Σαλάτα", nameEn: "Greek Traditional Salad", categoryId: catMap["Σαλάτες"]!, priceCents: 800, available: true, station: "salads" },
    { nameEl: "Ρόκα Σαλάτα", nameEn: "Rocket Salad", categoryId: catMap["Σαλάτες"]!, priceCents: 800, available: true, station: "salads" },
    { nameEl: "Λάχανο - Καρότο", nameEn: "Cabbage - Carrot Salad", categoryId: catMap["Σαλάτες"]!, priceCents: 500, available: true, station: "salads" },
    { nameEl: "Πολίτικη Σαλάτα", nameEn: "Mix Pickled Salad", categoryId: catMap["Σαλάτες"]!, priceCents: 600, available: true, station: "salads" },
    { nameEl: "Χόρτα", nameEn: "Boiled Greens", categoryId: catMap["Σαλάτες"]!, priceCents: 500, available: true, station: "salads" },

    // Κρεατικά
    { nameEl: "Χοιρινή Μπριζόλα", nameEn: "Pork Steak", categoryId: catMap["Κρεατικά"]!, priceCents: 1200, available: true, station: "grill" },
    { nameEl: "Μοσχαρίσια Γάλακτος", nameEn: "Beef Steak", categoryId: catMap["Κρεατικά"]!, priceCents: 1500, available: true, station: "grill" },
    { nameEl: "Καπνιστή Χοιρινή Μπριζόλα", nameEn: "Smoked Pork Steak", categoryId: catMap["Κρεατικά"]!, priceCents: 1300, available: true, station: "grill" },
    { nameEl: "Μπιφτέκια", nameEn: "Homemade Burger", categoryId: catMap["Κρεατικά"]!, priceCents: 1000, available: true, station: "grill" },
    { nameEl: "Ψαρονέφρι", nameEn: "Pork Tender Loin", categoryId: catMap["Κρεατικά"]!, priceCents: 1200, available: true, station: "grill" },
    { nameEl: "Συκώτι Μοσχαρίσιο", nameEn: "Liver", categoryId: catMap["Κρεατικά"]!, priceCents: 1200, available: true, station: "grill" },
    { nameEl: "Κοντοσούβλι Κοτόπουλο", nameEn: "Chicken Souvlaki", categoryId: catMap["Κρεατικά"]!, priceCents: 1200, available: true, station: "grill" },
    { nameEl: "Λουκάνικο Χωριάτικο", nameEn: "Sausage", categoryId: catMap["Κρεατικά"]!, priceCents: 800, available: true, station: "grill" },
    { nameEl: "Παϊδάκια Αρνίσια", nameEn: "Lamb Chops", categoryId: catMap["Κρεατικά"]!, priceCents: 3800, pricingType: "weight", available: true, station: "grill" },

    // Ψάρια
    { nameEl: "Σαρδέλα στα Κάρβουνα", nameEn: "Grilled Sardines", categoryId: catMap["Ψάρια"]!, priceCents: 1200, available: true, station: "grill" },
    { nameEl: "Γαύρος Τηγανητός", nameEn: "Anchovies", categoryId: catMap["Ψάρια"]!, priceCents: 1000, available: true, station: "fryer" },
    { nameEl: "Καλαμαράκια Φρέσκα", nameEn: "Fresh Calamari", categoryId: catMap["Ψάρια"]!, priceCents: 1000, available: true, station: "fryer" },
    { nameEl: "Κουτσομούρες", nameEn: "Fried Mullets", categoryId: catMap["Ψάρια"]!, priceCents: 4000, pricingType: "weight", available: true, station: "fryer" },
    { nameEl: "Μπακαλιαράκια Τηγανητά / Ψητά", nameEn: "Cod Fish", categoryId: catMap["Ψάρια"]!, priceCents: 4000, pricingType: "weight", available: true, station: "fryer" },
    { nameEl: "Τσιπούρα", nameEn: "Porgies", categoryId: catMap["Ψάρια"]!, priceCents: 4500, pricingType: "weight", available: true, station: "grill" },

    // Ποτά
    { nameEl: "Κρασί Χύμα Λευκό Μαλαγουζιά", nameEn: "House Wine White 0.5 lt", categoryId: catMap["Ποτά"]!, priceCents: 500, available: true, station: "bar" },
    { nameEl: "Κρασί Χύμα Ροζέ Ημίξηρο", nameEn: "House Wine Rosé 0.5 lt", categoryId: catMap["Ποτά"]!, priceCents: 500, available: true, station: "bar" },
    { nameEl: "Κρασί Χύμα Αγιωργίτικο Κόκκινο", nameEn: "House Wine Red 0.5 lt", categoryId: catMap["Ποτά"]!, priceCents: 500, available: true, station: "bar" },
    { nameEl: "Μπύρες", nameEn: "Beers Bottle 500ml", categoryId: catMap["Ποτά"]!, priceCents: 350, available: true, station: "bar" },
    { nameEl: "Αναψυκτικά", nameEn: "Refreshments", categoryId: catMap["Ποτά"]!, priceCents: 200, available: true, station: "bar" },
    { nameEl: "Τσικουδιά / Τσίπουρο 50ml", nameEn: "Tsipouro 50ml", categoryId: catMap["Ποτά"]!, priceCents: 200, available: true, station: "bar" },
    { nameEl: "Τσικουδιά / Τσίπουρο 200ml", nameEn: "Tsipouro 200ml", categoryId: catMap["Ποτά"]!, priceCents: 800, available: true, station: "bar" },
    { nameEl: "Ούζο 200ml", nameEn: "Ouzo 200ml", categoryId: catMap["Ποτά"]!, priceCents: 300, available: true, station: "bar" },
  ];

  await db
    .insert(menuItems)
    .values(
      items.map(({ station, ...item }) => ({
        ...item,
        stationId: stationMap[station]!,
      }))
    )
    .onConflictDoNothing();

  console.log(`Seeded ${items.length} menu items, ${allStations.length} stations, across ${categoryData.length} categories.`);
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
