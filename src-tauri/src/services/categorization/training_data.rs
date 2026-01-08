//! Training Data Generator for Smart Categorization Engine
//!
//! This module generates synthetic training data for the ML categorization model
//! based on realistic Czech banking transaction patterns.

use std::collections::HashMap;

/// Category definitions with associated merchants and patterns
pub struct CategoryData {
    pub id: &'static str,
    pub merchants: Vec<MerchantTemplate>,
}

/// Template for generating transaction descriptions
pub struct MerchantTemplate {
    pub name: &'static str,
    pub patterns: Vec<&'static str>,
    pub weight: u32, // Relative frequency weight
}

/// Generate training dataset
/// Returns (description, category_id) pairs
pub fn generate_training_data() -> Vec<(String, String)> {
    let mut samples = Vec::new();

    // Add all category samples
    samples.extend(generate_groceries_samples());
    samples.extend(generate_dining_samples());
    samples.extend(generate_transport_samples());
    samples.extend(generate_utilities_samples());
    samples.extend(generate_entertainment_samples());
    samples.extend(generate_shopping_samples());
    samples.extend(generate_health_samples());
    samples.extend(generate_travel_samples());
    samples.extend(generate_income_samples());
    samples.extend(generate_transfer_samples());
    samples.extend(generate_investments_samples());
    samples.extend(generate_housing_samples());
    samples.extend(generate_taxes_samples());

    samples
}

fn generate_groceries_samples() -> Vec<(String, String)> {
    let category = "cat_groceries";
    let mut samples = Vec::new();

    // Czech supermarkets
    let supermarkets = [
        (
            "Albert",
            vec![
                "ALBERT CZ 12345 PRAHA",
                "Albert Hypermarket Praha 5",
                "ALBERT HYPERMARKET",
                "Albert Supermarket",
                "ALBERT SUPERMARKET S.R.O.",
                "Platba kartou Albert",
                "ALBERT CESKY TESIN",
                "Albert Praha 10",
                "ALBERT BRNO MODRICE",
                "Albert Ostrava",
                "Albert supermarket Hradec Kralove",
                "ALBERT CZ s.r.o.",
            ],
        ),
        (
            "Billa",
            vec![
                "BILLA spol. s r.o.",
                "BILLA PRAHA",
                "Billa supermarket",
                "BILLA CZ",
                "Platba kartou BILLA",
                "BILLA Brno",
                "BILLA s.r.o. Praha 4",
                "Billa Ostrava",
                "BILLA Plzen",
                "Billa Liberec",
            ],
        ),
        (
            "Lidl",
            vec![
                "LIDL Ceska republika",
                "LIDL CZ",
                "Lidl Praha",
                "LIDL STIFTUNG",
                "Platba kartou Lidl",
                "LIDL Brno",
                "Lidl Ostrava",
                "LIDL supermarket",
                "Lidl diskont",
                "LIDL CESKA REPUBLIKA V.O.S.",
            ],
        ),
        (
            "Kaufland",
            vec![
                "KAUFLAND CESKA REPUBLIKA",
                "Kaufland Praha",
                "KAUFLAND V.O.S.",
                "Platba kartou Kaufland",
                "KAUFLAND Brno",
                "Kaufland hypermarket",
                "KAUFLAND OSTRAVA",
                "Kaufland Plzen",
                "KAUFLAND s.r.o.",
            ],
        ),
        (
            "Tesco",
            vec![
                "TESCO STORES CR",
                "Tesco Praha",
                "TESCO HYPERMARKET",
                "Platba kartou Tesco",
                "TESCO EXPRESS",
                "Tesco supermarket",
                "TESCO STORES a.s.",
                "Tesco Brno",
                "TESCO Ostrava",
                "Tesco Extra",
            ],
        ),
        (
            "Penny",
            vec![
                "PENNY MARKET S.R.O.",
                "Penny Market Praha",
                "PENNY MARKET",
                "Platba kartou Penny",
                "PENNY CZ",
                "Penny Brno",
                "PENNY MARKET diskont",
                "Penny Ostrava",
            ],
        ),
        (
            "Globus",
            vec![
                "GLOBUS CR K.S.",
                "Globus hypermarket",
                "GLOBUS Praha",
                "Platba kartou Globus",
                "GLOBUS Brno",
                "Globus Ostrava",
                "GLOBUS CHOTIKOV",
                "Globus cerny most",
            ],
        ),
        (
            "Makro",
            vec![
                "MAKRO Cash & Carry",
                "MAKRO PRAHA",
                "Makro velkoobchod",
                "MAKRO CR s.r.o.",
                "Platba kartou Makro",
                "MAKRO Brno",
            ],
        ),
        (
            "CBA",
            vec!["CBA PREMIANT", "CBA potraviny", "CBA Praha", "CBA prodejna"],
        ),
        (
            "COOP",
            vec![
                "COOP CENTRUM",
                "COOP Jednota",
                "COOP prodejna",
                "COOP potraviny",
                "COOP BRNO",
            ],
        ),
        (
            "Flop",
            vec!["FLOP Diskont", "Flop TOP s.r.o.", "FLOP potraviny"],
        ),
        (
            "Rohlik",
            vec![
                "ROHLIK.CZ",
                "Rohlik Group",
                "ROHLIK a.s.",
                "Platba Rohlik",
                "rohlik.cz s.r.o.",
            ],
        ),
        (
            "Kosik",
            vec![
                "KOSIK.CZ",
                "Kosik s.r.o.",
                "Platba Kosik",
                "kosik.cz online",
            ],
        ),
    ];

    for (_, patterns) in supermarkets.iter() {
        for pattern in patterns {
            samples.push((pattern.to_string(), category.to_string()));
            // Generate variations with amounts and dates
            samples.push((format!("{} CZK -523.00", pattern), category.to_string()));
            samples.push((
                format!("Nakup {} 15.12.2025", pattern),
                category.to_string(),
            ));
        }
    }

    // Generic grocery patterns
    let generic = [
        "potraviny",
        "Nakup potravin",
        "Supermarket",
        "Hypermarket nakup",
        "Prodejna potravin",
        "Obchod s potravinami",
        "Smisene zbozi",
        "Vecerka",
        "Samoobsluha",
        "Maloobchod potraviny",
        "Zelenina ovoce",
        "Mlekarna",
        "Pekarna",
        "Reznictvi",
    ];

    for pattern in generic.iter() {
        samples.push((pattern.to_string(), category.to_string()));
    }

    samples
}

fn generate_dining_samples() -> Vec<(String, String)> {
    let category = "cat_dining";
    let mut samples = Vec::new();

    // Food delivery
    let delivery = [
        (
            "Uber Eats",
            vec![
                "UBER EATS",
                "Uber Eats Praha",
                "UBER *EATS",
                "UberEATS",
                "Platba Uber Eats",
            ],
        ),
        (
            "Wolt",
            vec![
                "WOLT",
                "Wolt Praha",
                "WOLT ENTERPRISES OY",
                "Platba Wolt",
                "Wolt delivery",
                "WOLT CZ",
            ],
        ),
        (
            "Bolt Food",
            vec![
                "BOLT FOOD",
                "Bolt food delivery",
                "BOLT.EU",
                "Platba Bolt Food",
            ],
        ),
        (
            "Dame Jidlo",
            vec![
                "DAMEJIDLO.CZ",
                "Dame Jidlo",
                "damejidlo.cz s.r.o.",
                "Platba DameJidlo",
            ],
        ),
    ];

    for (_, patterns) in delivery.iter() {
        for pattern in patterns {
            samples.push((pattern.to_string(), category.to_string()));
        }
    }

    // Restaurants and cafes
    let restaurants = [
        // Fast food
        "MCDONALDS",
        "McDonald's CZ",
        "McDONALD'S Praha",
        "BURGER KING",
        "Burger King Praha",
        "KFC",
        "KFC Czech",
        "SUBWAY",
        "Subway Praha",
        "PIZZA HUT",
        "DOMINOS PIZZA",
        "Starbucks",
        "STARBUCKS COFFEE",
        "Costa Coffee",
        "COSTA COFFEE PRAHA",
        // Czech restaurant chains
        "Potrefena husa",
        "POTREFENA HUSA",
        "Ambiente",
        "AMBIENTE RESTAURANTS",
        "Pilsner Urquell",
        "PILSNER URQUELL RESTAURANT",
        "Lokál",
        "LOKAL U BILE KUZELKY",
        "Kolkovna",
        "KOLKOVNA GROUP",
        "Staropramen",
        "PIVOVAR STAROPRAMEN",
        "La Casa Argentina",
        "Kozlovna",
        "RESTAURACE KOZLOVNA",
        // Generic patterns
        "Restaurace",
        "RESTAURACE U",
        "Hospoda",
        "Pivnice",
        "Kavarna",
        "CAFE",
        "Bistro",
        "Bufet",
        "Jidelna",
        "Pizzerie",
        "Sushi bar",
        "Cínská restaurace",
        "Thajská restaurace",
        "Indická restaurace",
        "Italska restaurace",
        "Mexická restaurace",
    ];

    for pattern in restaurants.iter() {
        samples.push((pattern.to_string(), category.to_string()));
    }

    samples
}

fn generate_transport_samples() -> Vec<(String, String)> {
    let category = "cat_transport";
    let mut samples = Vec::new();

    // Public transport
    let public_transport = [
        // Prague
        "DPP",
        "Dopravni podnik Praha",
        "DOPRAVNI PODNIK HL.M.PRAHY",
        "DPP kupon",
        "LÍTAČKA",
        "Platba Litacka",
        "PID LITACKA",
        "Kupón MHD Praha",
        // Brno
        "DPMB",
        "Dopravni podnik mesta Brna",
        "IDS JMK",
        // Ostrava
        "DPO",
        "Dopravni podnik Ostrava",
        // Czech Railways
        "České dráhy",
        "CESKE DRAHY A.S.",
        "CD Jizdenka",
        "CD.CZ",
        "Platba CD",
        "ČD e-shop",
        "IDOS jizdenka",
        // Regiojet
        "REGIOJET",
        "RegioJet a.s.",
        "Student Agency",
        "STUDENT AGENCY",
        "Platba Regiojet",
        // Leo Express
        "LEO EXPRESS",
        "LeoExpress",
        "Platba Leo Express",
        // Flixbus
        "FLIXBUS",
        "FlixBus CZ",
        "Platba Flixbus",
    ];

    for pattern in public_transport.iter() {
        samples.push((pattern.to_string(), category.to_string()));
    }

    // Taxi and rideshare
    let rideshare = [
        "UBER",
        "Uber BV",
        "UBER *TRIP",
        "Uber Praha",
        "BOLT",
        "Bolt Operations",
        "BOLT.EU",
        "LIFTAGO",
        "Liftago CZ",
        "AAA TAXI",
        "TICK TACK TAXI",
        "MODRY ANDEL TAXI",
        "UBER *UBER",
    ];

    for pattern in rideshare.iter() {
        samples.push((pattern.to_string(), category.to_string()));
    }

    // Fuel and car
    let fuel = [
        // Fuel stations
        "BENZINA",
        "BENZINA s.r.o. EKO",
        "Shell benzinka",
        "SHELL CZ",
        "OMV",
        "OMV Ceska republika",
        "MOL",
        "MOL Cesko",
        "ORLEN BENZINA",
        "EURO OIL",
        "TANK ONO",
        "EuroOil",
        // Parking
        "PARKOVÁNÍ",
        "Parkovani Praha",
        "PARKING",
        "Parkovne",
        "SMS PARKING",
        "APCOA PARKING",
        // Highway tolls
        "DALNICNI ZNAMKA",
        "e-dalnice.cz",
        "MYTNY SYSTEM",
        // Car services
        "AUTOSERVIS",
        "Pneuservis",
        "STK",
        "Myčka aut",
        // Car rental
        "SIXT",
        "HERTZ",
        "EUROPCAR",
        "Autonapujcovna",
    ];

    for pattern in fuel.iter() {
        samples.push((pattern.to_string(), category.to_string()));
    }

    samples
}

fn generate_utilities_samples() -> Vec<(String, String)> {
    let category = "cat_utilities";
    let mut samples = Vec::new();

    // Electricity
    let electricity = [
        "CEZ PRODEJ",
        "ČEZ Prodej s.r.o.",
        "CEZ a.s.",
        "CEZ Distribuce",
        "PREDPLATBA CEZ",
        "Zaloha elektrina CEZ",
        "PRE",
        "Prazska energetika",
        "PRE MERENI a.s.",
        "E.ON ENERGIE",
        "E.ON Czech",
        "INNOGY",
        "innogy Energie s.r.o.",
        "BOHEMIA ENERGY",
        "MND",
        "MND a.s.",
        "Elektrina mesicni",
        "ZALOHA ELEKTRINA",
    ];

    for pattern in electricity.iter() {
        samples.push((pattern.to_string(), category.to_string()));
    }

    // Gas
    let gas = [
        "PRAZSKA PLYNARENSKA",
        "PP Distribuce",
        "innogy Gas",
        "RWE",
        "E.ON plyn",
        "Zaloha plyn",
        "PREDPLATBA PLYN",
    ];

    for pattern in gas.iter() {
        samples.push((pattern.to_string(), category.to_string()));
    }

    // Water
    let water = [
        "PRAZSKE VODOVODY",
        "PVK a.s.",
        "VODAFONE vodne",
        "Vodne stocne",
        "BVK Brno",
        "OVAK Ostrava",
        "Vodojem",
        "VODNI HOSPODARSTVI",
    ];

    for pattern in water.iter() {
        samples.push((pattern.to_string(), category.to_string()));
    }

    // Telecom
    let telecom = [
        "T-MOBILE",
        "T-Mobile Czech Republic",
        "O2",
        "O2 Czech Republic",
        "VODAFONE",
        "Vodafone Czech",
        "KAKTUS",
        "MOBIL.CZ",
        "Paušál telefon",
        "Mesicni poplatek telefon",
        "NORDIC TELECOM",
    ];

    for pattern in telecom.iter() {
        samples.push((pattern.to_string(), category.to_string()));
    }

    // Internet
    let internet = [
        "UPC",
        "UPC Ceska republika",
        "VODAFONE INTERNET",
        "O2 INTERNET",
        "T-MOBILE INTERNET",
        "STARLINK",
        "NETBOX",
        "FASTER CZ",
        "IPTV",
    ];

    for pattern in internet.iter() {
        samples.push((pattern.to_string(), category.to_string()));
    }

    // Rent and housing
    let rent = [
        "NAJEM",
        "Nájem bytu",
        "NAJEMNE",
        "Nájemné měsíční",
        "Nájemní smlouva",
        "Poplatky byt",
        "Fond oprav",
        "SVJ poplatky",
        "Spolecenstvi vlastniku",
        "Energie spolecne prostory",
    ];

    for pattern in rent.iter() {
        samples.push((pattern.to_string(), category.to_string()));
    }

    samples
}

fn generate_entertainment_samples() -> Vec<(String, String)> {
    let category = "cat_entertainment";
    let mut samples = Vec::new();

    // Streaming
    let streaming = [
        "NETFLIX",
        "Netflix.com",
        "NETFLIX.COM",
        "SPOTIFY",
        "Spotify AB",
        "SPOTIFY PREMIUM",
        "APPLE.COM/BILL",
        "Apple Music",
        "ITUNES.COM",
        "HBO MAX",
        "HBOMAX",
        "DISNEY+",
        "DISNEY PLUS",
        "AMAZON PRIME",
        "Prime Video",
        "YOUTUBE PREMIUM",
        "Google YouTube",
        "VOYO",
        "voyo.cz",
        "IVYSÍLÁNÍ PLUS",
        "APPLE TV+",
        "DEEZER",
        "TIDAL",
    ];

    for pattern in streaming.iter() {
        samples.push((pattern.to_string(), category.to_string()));
    }

    // Games
    let games = [
        "STEAM",
        "STEAM GAMES",
        "STEAMPOWERED",
        "PLAYSTATION",
        "SONY PLAYSTATION",
        "XBOX",
        "MICROSOFT XBOX",
        "NINTENDO",
        "EPIC GAMES",
        "GOG.COM",
        "BLIZZARD",
        "EA GAMES",
        "UBISOFT",
    ];

    for pattern in games.iter() {
        samples.push((pattern.to_string(), category.to_string()));
    }

    // Cinema
    let cinema = [
        "CINEMA CITY",
        "Cinema City Praha",
        "CINESTAR",
        "IMAX",
        "PREMIERE CINEMAS",
        "AERO KINO",
        "Kino Svetozor",
        "BIO OKO",
        "KINO",
        "Multikino",
    ];

    for pattern in cinema.iter() {
        samples.push((pattern.to_string(), category.to_string()));
    }

    // Events and tickets
    let tickets = [
        "TICKETMASTER",
        "TICKETPORTAL",
        "GOOUT",
        "GoOut.net",
        "TICKETSTREAM",
        "VSTUPENKY",
        "Koncert",
        "Festival",
        "Divadlo",
        "NARODNI DIVADLO",
        "Muzeum",
        "Galerie",
        "Zoo",
        "ZOO PRAHA",
        "Botanicka zahrada",
        "Aquapark",
        "Zabavni park",
    ];

    for pattern in tickets.iter() {
        samples.push((pattern.to_string(), category.to_string()));
    }

    samples
}

fn generate_shopping_samples() -> Vec<(String, String)> {
    let category = "cat_shopping";
    let mut samples = Vec::new();

    // Electronics
    let electronics = [
        "ALZA",
        "Alza.cz a.s.",
        "ALZA.CZ",
        "DATART",
        "Datart s.r.o.",
        "ELEKTRO WORLD",
        "EURONICS",
        "HP TRONIC",
        "CZC.CZ",
        "czc.cz s.r.o.",
        "OKAY",
        "OKAY s.r.o.",
        "PLANEO",
        "MALL.CZ",
        "Mall Group",
        "HEUREKA",
        "MIRONET",
    ];

    for pattern in electronics.iter() {
        samples.push((pattern.to_string(), category.to_string()));
    }

    // E-commerce
    let ecommerce = [
        "AMAZON",
        "AMAZON.DE",
        "AMAZON.COM",
        "AMAZON EU",
        "EBAY",
        "ALIEXPRESS",
        "SHEIN",
        "TEMU",
        "ZALANDO",
        "ABOUT YOU",
        "BONPRIX",
        "LIDL ESHOP",
    ];

    for pattern in ecommerce.iter() {
        samples.push((pattern.to_string(), category.to_string()));
    }

    // Fashion
    let fashion = [
        "ZARA",
        "H&M",
        "HM.COM",
        "RESERVED",
        "CROPP",
        "HOUSE BRAND",
        "SINSAY",
        "MOHITO",
        "C&A",
        "ORSAY",
        "NEW YORKER",
        "TAKKO",
        "PRIMARK",
        "DECATHLON",
        "SPORTISIMO",
        "FOOTSHOP",
        "BAŤA",
        "DEICHMANN",
        "CCC",
        "ALPINE PRO",
        "NORTHFACE",
        "GAP",
        "LEVI'S",
    ];

    for pattern in fashion.iter() {
        samples.push((pattern.to_string(), category.to_string()));
    }

    // Home and garden
    let home = [
        "IKEA",
        "IKEA CZECH",
        "OBI",
        "OBI CENTRUM",
        "HORNBACH",
        "BAUMAX",
        "BAUHAUS",
        "JYSK",
        "XXX LUTZ",
        "KIKA",
        "MOBELIX",
        "SCONTO",
        "ASKO",
        "MOUNTFIELD",
        "HECHT",
        "DEHNER",
        "PRODEJNA NARADI",
    ];

    for pattern in home.iter() {
        samples.push((pattern.to_string(), category.to_string()));
    }

    // Drugstores
    let drugstore = [
        "DM DROGERIE",
        "dm drogerie markt",
        "ROSSMANN",
        "Rossmann spol s r.o.",
        "TETA DROGERIE",
        "Teta drogerie a lekarna",
        "NOTINO",
        "notino.cz",
        "SEPHORA",
        "DOUGLAS",
        "MARIONNAUD",
        "PARFUMS.CZ",
    ];

    for pattern in drugstore.iter() {
        samples.push((pattern.to_string(), category.to_string()));
    }

    samples
}

fn generate_health_samples() -> Vec<(String, String)> {
    let category = "cat_health";
    let mut samples = Vec::new();

    // Pharmacies
    let pharmacy = [
        "LEKARNA",
        "Lekarna Praha",
        "DR.MAX",
        "Dr. Max Lekarna",
        "BENU LEKARNA",
        "BENU Ceska republika",
        "PILULKA.CZ",
        "Lékárna.cz",
        "LLOYDS PHARMACY",
        "Magistra lekarna",
    ];

    for pattern in pharmacy.iter() {
        samples.push((pattern.to_string(), category.to_string()));
    }

    // Medical
    let medical = [
        "PRAKTICKY LEKAR",
        "Ordinace",
        "Zdravotní péče",
        "Nemocnice",
        "NEMOCNICE NA BULOVCE",
        "VFN Praha",
        "FNKV",
        "IKEM",
        "Poliklinika",
        "MEDICOVER",
        "CANADIAN MEDICAL",
        "EUC KLINIKA",
        "SYNLAB",
        "Laborator",
        "Specialista",
        "Neurolog",
        "Kardiolog",
        "Dermatolog",
        "GYNEKOLOGIE",
        "REHABILITACE",
        "FYZIOTERAPIE",
        "Masaze",
        "CHIROPRAKTIK",
    ];

    for pattern in medical.iter() {
        samples.push((pattern.to_string(), category.to_string()));
    }

    // Dental
    let dental = [
        "ZUBNÍ LÉKAŘ",
        "STOMATOLOGIE",
        "Zubni ordinace",
        "DENTAL CLINIC",
        "Dentalni hygiena",
        "Ortodoncie",
    ];

    for pattern in dental.iter() {
        samples.push((pattern.to_string(), category.to_string()));
    }

    // Optical
    let optical = [
        "OPTIKA",
        "Oční optika",
        "FOKUS OPTIK",
        "GrandOptical",
        "EYES & MORE",
        "ALENSA",
    ];

    for pattern in optical.iter() {
        samples.push((pattern.to_string(), category.to_string()));
    }

    // Fitness
    let fitness = [
        "FITNESS",
        "POSILOVNA",
        "JOHN REED",
        "FITNESS PARK",
        "MULTISPORT",
        "ACTIVEPASS",
        "BENEFIT PLUS",
        "YOGA",
        "PILATES",
        "CROSSFIT",
        "BAZEN",
        "Plavecky bazen",
    ];

    for pattern in fitness.iter() {
        samples.push((pattern.to_string(), category.to_string()));
    }

    samples
}

fn generate_travel_samples() -> Vec<(String, String)> {
    let category = "cat_travel";
    let mut samples = Vec::new();

    // Airlines
    let airlines = [
        "RYANAIR",
        "Ryanair DAC",
        "WIZZ AIR",
        "Wizz Air Hungary",
        "SMARTWINGS",
        "Smartwings a.s.",
        "CSA",
        "Ceske aerolinie",
        "LUFTHANSA",
        "KLM",
        "AIR FRANCE",
        "BRITISH AIRWAYS",
        "EASYJET",
        "EUROWINGS",
        "AUSTRIAN",
        "EMIRATES",
        "QATAR AIRWAYS",
        "TURKISH AIRLINES",
    ];

    for pattern in airlines.iter() {
        samples.push((pattern.to_string(), category.to_string()));
    }

    // Booking
    let booking = [
        "BOOKING.COM",
        "Booking Holdings",
        "AIRBNB",
        "Airbnb Inc",
        "EXPEDIA",
        "HOTELS.COM",
        "HOSTELWORLD",
        "AGODA",
        "TRIVAGO",
        "TRIP.COM",
    ];

    for pattern in booking.iter() {
        samples.push((pattern.to_string(), category.to_string()));
    }

    // Travel agencies
    let agencies = [
        "CESTOVNÍ KANCELÁŘ",
        "CK FISCHER",
        "ČEDOK",
        "EXIM TOURS",
        "BLUE STYLE",
        "ALEXANDRIA",
        "INVIA",
        "Invia.cz",
        "KIWI.COM",
        "PELIKAN",
        "DOVOLENA.CZ",
    ];

    for pattern in agencies.iter() {
        samples.push((pattern.to_string(), category.to_string()));
    }

    // Hotels
    let hotels = [
        "HOTEL",
        "MARRIOTT",
        "HILTON",
        "ACCOR",
        "IBIS",
        "NOVOTEL",
        "RADISSON",
        "HOLIDAY INN",
        "BEST WESTERN",
        "MOTEL",
        "HOSTEL",
        "PENSION",
        "PENZION",
        "UBYTOVÁNÍ",
    ];

    for pattern in hotels.iter() {
        samples.push((pattern.to_string(), category.to_string()));
    }

    samples
}

fn generate_income_samples() -> Vec<(String, String)> {
    let category = "cat_income";
    let mut samples = Vec::new();

    let income_patterns = [
        // Salary
        "MZDA",
        "Výplata mzdy",
        "PLAT",
        "Mzdový převod",
        "PRIPSANI MZDY",
        "Pravidelna mzda",
        "VYPLATA",
        // Benefits
        "STRAVENKY",
        "Stravenkový paušál",
        "BENEFITY",
        "Příspěvek zaměstnavatele",
        "CAFETERIA",
        "Multisport karta",
        // State payments
        "ĆSSZ",
        "Důchod",
        "DUCHOD",
        "Sociální dávky",
        "PODPORA",
        "Rodičovský příspěvek",
        "Příspěvek na bydlení",
        "MPSV",
        "ÚŘAD PRÁCE",
        // Money received
        "PŘÍCHOZÍ PLATBA",
        "Došlá platba",
        "PŘIPSÁNO",
        "Vklad hotovosti",
        "HOTOVOSTNÍ VKLAD",
        // Investment income
        "DIVIDENDA",
        "Výnos z investic",
        "ÚROK",
        "Připsaný úrok",
        "Kapitálový výnos",
        // Freelance
        "FAKTURA",
        "Platba za fakturu",
        "Přijatá faktura",
        "IČO platba",
        // Refunds
        "VRATKA",
        "Vrácení peněz",
        "REFUNDACE",
        "Dobropis",
    ];

    for pattern in income_patterns.iter() {
        samples.push((pattern.to_string(), category.to_string()));
    }

    samples
}

fn generate_transfer_samples() -> Vec<(String, String)> {
    let category = "cat_internal_transfers"; // Correct category ID
    let mut samples = Vec::new();

    // Fintech payment intermediaries - these are often used for transfers
    // The patterns match various formats banks use for these
    let fintech_intermediaries = [
        // Revolut - various patterns used by banks
        "REVOLUT",
        "Revolut",
        "Revolut payment",
        "Revolut**",
        "Revolut**8220*",
        "Revolut**1234*",
        "REVOLUT PAYMENTS",
        "From Revolut",
        "To Revolut",
        "Platba Revolut",
        // Wise (TransferWise)
        "WISE",
        "Wise",
        "TRANSFERWISE",
        "TransferWise Ltd",
        "Wise payment",
        "Wise Europe",
        "WISE PAYMENTS",
        // N26
        "N26",
        "N26 BANK",
        "N26 payment",
        "N26 GmbH",
        // Bunq
        "BUNQ",
        "bunq B.V.",
        // Monese
        "MONESE",
        "Monese Ltd",
        // Vivid
        "VIVID",
        "Vivid Money",
        // Generic fintech patterns
        "Fintech transfer",
        "Digital bank transfer",
    ];

    for pattern in fintech_intermediaries.iter() {
        samples.push((pattern.to_string(), category.to_string()));
    }

    let transfer_patterns = [
        // Bank transfers
        "PŘEVOD NA ÚČET",
        "Mezibankovní převod",
        "VNITROBANKOVNÍ PŘEVOD",
        "Převod vlastní",
        "PŘEVOD MEZI ÚČTY",
        "Platba na účet",
        // Own accounts
        "VLASTNÍ ÚČET",
        "Mezi svými účty",
        "Převod spoření",
        "Na spořicí účet",
        // Cash
        "VÝBĚR Z BANKOMATU",
        "ATM výběr",
        "CASH WITHDRAWAL",
        "Výběr hotovosti",
        "VKLAD",
        "Vklad hotovosti",
        // International
        "ZAHRANIČNÍ PLATBA",
        "SWIFT",
        "SEPA platba",
        "Mezinárodní převod",
        // Savings
        "SPOŘENÍ",
        "Pravidelné spoření",
        "Stavební spoření",
        "PENZIJNÍ SPOŘENÍ",
    ];

    for pattern in transfer_patterns.iter() {
        samples.push((pattern.to_string(), category.to_string()));
    }

    samples
}

fn generate_investments_samples() -> Vec<(String, String)> {
    let category = "cat_investments";
    let mut samples = Vec::new();

    // Czech/EU Brokers
    let brokers = [
        "DEGIRO",
        "DEGIRO B.V.",
        "Degiro platba",
        "XTB",
        "XTB S.A.",
        "X-Trade Brokers",
        "PORTU",
        "Portu.cz",
        "Portu investice",
        "FONDEE",
        "Fondee a.s.",
        "Fondee investice",
        "FIO E-BROKER",
        "Fio Broker",
        "e-Broker Fio",
        "LYNX",
        "Lynx broker",
        // International brokers
        "INTERACTIVE BROKERS",
        "Interactive Brokers LLC",
        "IBKR",
        "ETORO",
        "eToro Europe",
        "eToro investice",
        "TRADING 212",
        "Trading212",
        "REVOLUT TRADING",
        "Revolut Invest",
        "SAXO BANK",
        "Saxo Trader",
        "CHARLES SCHWAB",
        "TD AMERITRADE",
        "FIDELITY",
    ];

    for pattern in brokers.iter() {
        samples.push((pattern.to_string(), category.to_string()));
    }

    // Crypto exchanges
    let crypto = [
        "BINANCE",
        "Binance.com",
        "Binance Holdings",
        "COINBASE",
        "Coinbase Inc",
        "Coinbase Pro",
        "KRAKEN",
        "Kraken Exchange",
        "Payward Ltd",
        "BITSTAMP",
        "Bitstamp Ltd",
        "GEMINI",
        "Gemini Trust",
        "CRYPTOCOM",
        "Crypto.com",
        "BITFINEX",
        "FTX",
        "KUCOIN",
        "BYBIT",
        "ANYCOIN",
        "Anycoin Direct",
        "SIMPLECOIN",
    ];

    for pattern in crypto.iter() {
        samples.push((pattern.to_string(), category.to_string()));
    }

    // Investment-related terms
    let terms = [
        "Nákup akcií",
        "Prodej akcií",
        "Nákup ETF",
        "Investiční fond",
        "Podílový fond",
        "Dluhopisy nákup",
        "Cenné papíry",
        "BROKER",
        "Brokerský poplatek",
        "Investiční platforma",
    ];

    for pattern in terms.iter() {
        samples.push((pattern.to_string(), category.to_string()));
    }

    samples
}

fn generate_housing_samples() -> Vec<(String, String)> {
    let category = "cat_housing";
    let mut samples = Vec::new();

    // DIY stores
    let diy_stores = [
        "HORNBACH",
        "Hornbach s.r.o.",
        "Hornbach Praha",
        "OBI",
        "OBI Centrum",
        "OBI Czech",
        "BAUMAX",
        "Baumax s.r.o.",
        "BAUHAUS",
        "Bauhaus Česká republika",
        "UNI HOBBY",
        "Uni Hobby Praha",
        "MOUNTFIELD",
        "Mountfield a.s.",
        "Mountfield zahrada",
        "SIKO",
        "SIKO koupelny",
        "SIKO kuchyně",
        "PTÁČEK",
        "Ptáček velkoobchod",
    ];

    for pattern in diy_stores.iter() {
        samples.push((pattern.to_string(), category.to_string()));
    }

    // Building materials
    let materials = [
        "STAVEBNINY",
        "Stavebniny Praha",
        "DEK STAVEBNINY",
        "DEK a.s.",
        "PRO-DOMA",
        "Stavební materiál",
        "Staviva",
        "MPL STAVIVA",
        "CEMEX",
        "Cement a beton",
    ];

    for pattern in materials.iter() {
        samples.push((pattern.to_string(), category.to_string()));
    }

    // Home contractors/services
    let contractors = [
        "RENOVACE",
        "Renovace bytu",
        "Rekonstrukce",
        "ELEKTRIKÁŘ",
        "Elektromontáže",
        "Elektro instalace",
        "INSTALATÉR",
        "Instalatérské práce",
        "Topenářství",
        "MALÍŘ",
        "Malířské práce",
        "Natěračství",
        "ZAHRADNÍK",
        "Zahradnické služby",
        "Údržba zahrady",
        "TESAŘ",
        "Tesařské práce",
        "ZEDNÍK",
        "Zednické práce",
        "PODLAHÁŘ",
        "Pokládka podlah",
        "KLEMPÍŘ",
        "Klempířské práce",
        "TRUHLÁŘ",
        "Truhlářství",
        "Výroba nábytku",
    ];

    for pattern in contractors.iter() {
        samples.push((pattern.to_string(), category.to_string()));
    }

    // Housing-related terms
    let terms = [
        "Oprava domu",
        "Údržba nemovitosti",
        "Stavební práce",
        "Domácí opravy",
        "Zahradní technika",
        "Nářadí",
        "Barvy a laky",
    ];

    for pattern in terms.iter() {
        samples.push((pattern.to_string(), category.to_string()));
    }

    samples
}

fn generate_taxes_samples() -> Vec<(String, String)> {
    let category = "cat_taxes";
    let mut samples = Vec::new();

    // Tax authorities
    let tax_authority = [
        "FINANČNÍ ÚŘAD",
        "Financni urad",
        "FU Praha",
        "FU Brno",
        "Finanční správa",
        "GFŘ",
        "Generální finanční ředitelství",
        "Celní správa",
        "CELNÍ ÚŘAD",
    ];

    for pattern in tax_authority.iter() {
        samples.push((pattern.to_string(), category.to_string()));
    }

    // Tax types
    let tax_types = [
        "DAŇ Z PŘÍJMU",
        "Daň z příjmů fyzických osob",
        "DPFO",
        "Daň z příjmů právnických osob",
        "DPPO",
        "DPH",
        "Daň z přidané hodnoty",
        "Silniční daň",
        "Daň z nemovitosti",
        "Daň z nabytí nemovitosti",
        "Dědická daň",
        "Darovací daň",
        "ODVOD DANE",
        "Záloha na daň",
        "Doplatek daně",
        "Přeplatek daně",
        "Daňové přiznání",
    ];

    for pattern in tax_types.iter() {
        samples.push((pattern.to_string(), category.to_string()));
    }

    // Social and health insurance (often grouped with taxes)
    let insurance = [
        "ČSSZ",
        "Česká správa sociálního zabezpečení",
        "Sociální pojištění",
        "Zdravotní pojištění",
        "VZP",
        "Všeobecná zdravotní pojišťovna",
        "ZPMV",
        "OZP",
        "Pojistné OSVČ",
        "Záloha na pojistné",
    ];

    for pattern in insurance.iter() {
        samples.push((pattern.to_string(), category.to_string()));
    }

    samples
}

/// Print statistics about training data
pub fn print_statistics(data: &[(String, String)]) {
    let mut category_counts: HashMap<&str, usize> = HashMap::new();

    for (_, category) in data {
        *category_counts.entry(category).or_insert(0) += 1;
    }

    println!("Training Data Statistics:");
    println!("========================");
    println!("Total samples: {}", data.len());
    println!("\nSamples per category:");

    let mut counts: Vec<_> = category_counts.iter().collect();
    counts.sort_by(|a, b| b.1.cmp(a.1));

    for (category, count) in counts {
        println!("  {}: {}", category, count);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_large_dataset() {
        let data = generate_training_data();

        // Should have at least 500 samples
        assert!(
            data.len() >= 500,
            "Expected at least 500 samples, got {}",
            data.len()
        );

        // Should have all categories represented
        let categories: std::collections::HashSet<_> =
            data.iter().map(|(_, c)| c.as_str()).collect();
        assert!(categories.contains("cat_groceries"));
        assert!(categories.contains("cat_dining"));
        assert!(categories.contains("cat_transport"));
        assert!(categories.contains("cat_utilities"));
        assert!(categories.contains("cat_entertainment"));
        assert!(categories.contains("cat_shopping"));
        assert!(categories.contains("cat_health"));
        assert!(categories.contains("cat_travel"));
        assert!(categories.contains("cat_income"));
        assert!(categories.contains("cat_internal_transfers"));
        assert!(categories.contains("cat_investments"));
        assert!(categories.contains("cat_housing"));
        assert!(categories.contains("cat_taxes"));
    }
}
