//! Default categorization rules for Czech banking context
//!
//! Pre-configured rules for common Czech merchants, utilities, and services.

use super::types::{CategorizationRule, RuleType};

/// Get default categorization rules for Czech banking context
pub fn get_default_rules() -> Vec<CategorizationRule> {
    let mut rules = Vec::new();

    // ===== GROCERIES =====
    rules.extend(groceries_rules());

    // ===== DINING =====
    rules.extend(dining_rules());

    // ===== TRANSPORT =====
    rules.extend(transport_rules());

    // ===== UTILITIES =====
    rules.extend(utilities_rules());

    // ===== ENTERTAINMENT =====
    rules.extend(entertainment_rules());

    // ===== SHOPPING =====
    rules.extend(shopping_rules());

    // ===== HEALTH =====
    rules.extend(health_rules());

    // ===== TRAVEL =====
    rules.extend(travel_rules());

    // ===== INCOME =====
    rules.extend(income_rules());

    // ===== INVESTMENTS =====
    rules.extend(investments_rules());

    // ===== HOUSING =====
    rules.extend(housing_rules());

    // ===== TAXES =====
    rules.extend(taxes_rules());

    // ===== TRANSFERS =====
    rules.extend(transfer_rules());

    rules
}

fn groceries_rules() -> Vec<CategorizationRule> {
    let cat = "cat_groceries";
    let priority = 50;

    vec![
        // Czech supermarkets
        rule(
            "albert",
            "Albert",
            RuleType::Contains,
            "albert",
            cat,
            priority,
        ),
        rule("billa", "Billa", RuleType::Contains, "billa", cat, priority),
        rule("lidl", "Lidl", RuleType::Contains, "lidl", cat, priority),
        rule(
            "kaufland",
            "Kaufland",
            RuleType::Contains,
            "kaufland",
            cat,
            priority,
        ),
        rule("tesco", "Tesco", RuleType::Contains, "tesco", cat, priority),
        rule(
            "penny",
            "Penny Market",
            RuleType::Contains,
            "penny",
            cat,
            priority,
        ),
        rule(
            "globus",
            "Globus",
            RuleType::Contains,
            "globus",
            cat,
            priority,
        ),
        rule("makro", "Makro", RuleType::Contains, "makro", cat, priority),
        rule(
            "coop",
            "COOP",
            RuleType::Contains,
            "coop",
            cat,
            priority - 5,
        ),
        rule(
            "cba",
            "CBA",
            RuleType::Contains,
            "cba premiant",
            cat,
            priority - 5,
        ),
        // Online groceries
        rule(
            "rohlik",
            "Rohlík.cz",
            RuleType::Contains,
            "rohlik",
            cat,
            priority,
        ),
        rule(
            "kosik",
            "Košík.cz",
            RuleType::Contains,
            "kosik",
            cat,
            priority,
        ),
    ]
}

fn dining_rules() -> Vec<CategorizationRule> {
    let cat = "cat_dining";
    let priority = 50;

    vec![
        // Food delivery
        rule(
            "uber_eats",
            "Uber Eats",
            RuleType::Contains,
            "uber eats",
            cat,
            priority + 10,
        ),
        rule(
            "uber_eats2",
            "UBER *EATS",
            RuleType::Contains,
            "uber *eats",
            cat,
            priority + 10,
        ),
        rule("wolt", "Wolt", RuleType::Contains, "wolt", cat, priority),
        rule(
            "bolt_food",
            "Bolt Food",
            RuleType::Contains,
            "bolt food",
            cat,
            priority,
        ),
        rule(
            "damejidlo",
            "DámeJídlo",
            RuleType::Contains,
            "damejidlo",
            cat,
            priority,
        ),
        rule(
            "foodora",
            "Foodora",
            RuleType::Contains,
            "foodora",
            cat,
            priority,
        ),
        // Fast food
        rule(
            "mcdonalds",
            "McDonald's",
            RuleType::Contains,
            "mcdonald",
            cat,
            priority,
        ),
        rule(
            "burger_king",
            "Burger King",
            RuleType::Contains,
            "burger king",
            cat,
            priority,
        ),
        rule("kfc", "KFC", RuleType::Contains, "kfc", cat, priority),
        rule(
            "subway",
            "Subway",
            RuleType::Contains,
            "subway",
            cat,
            priority,
        ),
        rule(
            "starbucks",
            "Starbucks",
            RuleType::Contains,
            "starbucks",
            cat,
            priority,
        ),
        rule(
            "costa",
            "Costa Coffee",
            RuleType::Contains,
            "costa coffee",
            cat,
            priority,
        ),
        // Czech chains
        rule(
            "potrefena_husa",
            "Potrefená husa",
            RuleType::Contains,
            "potrefena husa",
            cat,
            priority,
        ),
        rule(
            "lokal",
            "Lokál",
            RuleType::Contains,
            "lokal u",
            cat,
            priority - 5,
        ),
        rule(
            "kolkovna",
            "Kolkovna",
            RuleType::Contains,
            "kolkovna",
            cat,
            priority,
        ),
        // Canteens and generic eateries
        rule(
            "kantyna",
            "Kantýna",
            RuleType::Contains,
            "kantyna",
            cat,
            priority,
        ),
        rule(
            "jidelna",
            "Jídelna",
            RuleType::Contains,
            "jidelna",
            cat,
            priority - 5,
        ),
        rule(
            "bistro",
            "Bistro",
            RuleType::Contains,
            "bistro",
            cat,
            priority - 5,
        ),
        rule(
            "bufet",
            "Bufet",
            RuleType::Contains,
            "bufet",
            cat,
            priority - 10,
        ),
    ]
}

fn transport_rules() -> Vec<CategorizationRule> {
    let cat = "cat_transport";
    let priority = 50;

    vec![
        // Prague public transport
        rule("dpp", "DPP", RuleType::Contains, "dpp", cat, priority),
        rule(
            "litacka",
            "Lítačka",
            RuleType::Contains,
            "litacka",
            cat,
            priority,
        ),
        rule("pid", "PID", RuleType::Contains, "pid", cat, priority - 5),
        // Czech railways
        rule(
            "cd",
            "České dráhy",
            RuleType::Regex,
            r"(?i)ceske.*drahy|cd\.cz",
            cat,
            priority,
        ),
        rule(
            "regiojet",
            "RegioJet",
            RuleType::Contains,
            "regiojet",
            cat,
            priority,
        ),
        rule(
            "student_agency",
            "Student Agency",
            RuleType::Contains,
            "student agency",
            cat,
            priority,
        ),
        rule(
            "leo_express",
            "Leo Express",
            RuleType::Contains,
            "leo express",
            cat,
            priority,
        ),
        rule(
            "flixbus",
            "FlixBus",
            RuleType::Contains,
            "flixbus",
            cat,
            priority,
        ),
        // Rideshare
        rule(
            "uber",
            "Uber",
            RuleType::Regex,
            r"(?i)uber(?!.*eats)",
            cat,
            priority - 5,
        ),
        rule("bolt", "Bolt", RuleType::Contains, "bolt.eu", cat, priority),
        rule(
            "liftago",
            "Liftago",
            RuleType::Contains,
            "liftago",
            cat,
            priority,
        ),
        // Fuel stations
        rule(
            "benzina",
            "Benzina",
            RuleType::Contains,
            "benzina",
            cat,
            priority,
        ),
        rule("shell", "Shell", RuleType::Contains, "shell", cat, priority),
        rule("omv", "OMV", RuleType::Contains, "omv", cat, priority),
        rule("mol", "MOL", RuleType::Contains, "mol", cat, priority - 5),
        // Orlen (formerly Benzina, PKN Orlen)
        rule("orlen", "Orlen", RuleType::Contains, "orlen", cat, priority),
        // Additional fuel stations
        rule(
            "eurooil",
            "EuroOil",
            RuleType::Contains,
            "eurooil",
            cat,
            priority,
        ),
        rule(
            "euro_oil",
            "Euro Oil",
            RuleType::Contains,
            "euro oil",
            cat,
            priority,
        ),
        rule(
            "tank_ono",
            "Tank ONO",
            RuleType::Contains,
            "tank ono",
            cat,
            priority,
        ),
        // Highway
        rule(
            "dalnice",
            "Dálniční známka",
            RuleType::Contains,
            "dalnic",
            cat,
            priority,
        ),
        // Parking
        rule(
            "parking",
            "Parkování",
            RuleType::Contains,
            "parking",
            cat,
            priority - 10,
        ),
        rule(
            "parkovne",
            "Parkovné",
            RuleType::Contains,
            "parkov",
            cat,
            priority - 10,
        ),
        // Micro-mobility (scooters, bike sharing)
        rule(
            "nextbike",
            "Nextbike",
            RuleType::Contains,
            "nextbike",
            cat,
            priority,
        ),
        rule(
            "lime",
            "Lime",
            RuleType::Regex,
            r"(?i)lime\s*(bike|scooter|\\.app)",
            cat,
            priority,
        ),
        rule(
            "rekola",
            "Rekola",
            RuleType::Contains,
            "rekola",
            cat,
            priority,
        ),
    ]
}

fn utilities_rules() -> Vec<CategorizationRule> {
    let cat = "cat_utilities";
    let priority = 50;

    vec![
        // Electricity
        rule("cez", "ČEZ", RuleType::Contains, "cez", cat, priority),
        rule(
            "pre",
            "Pražská energetika",
            RuleType::Contains,
            "pre ",
            cat,
            priority - 5,
        ),
        rule("eon", "E.ON", RuleType::Contains, "e.on", cat, priority),
        rule(
            "innogy",
            "innogy",
            RuleType::Contains,
            "innogy",
            cat,
            priority,
        ),
        // Gas
        rule(
            "pp",
            "Pražská plynárenská",
            RuleType::Contains,
            "plynarenska",
            cat,
            priority,
        ),
        // Water
        rule(
            "pvk",
            "Pražské vodovody",
            RuleType::Contains,
            "pvk",
            cat,
            priority,
        ),
        rule(
            "vodovody",
            "Vodovody",
            RuleType::Contains,
            "vodovod",
            cat,
            priority - 5,
        ),
        // Telecom
        rule(
            "tmobile",
            "T-Mobile",
            RuleType::Contains,
            "t-mobile",
            cat,
            priority,
        ),
        rule("o2", "O2", RuleType::Contains, "o2 czech", cat, priority),
        rule(
            "vodafone",
            "Vodafone",
            RuleType::Contains,
            "vodafone",
            cat,
            priority,
        ),
        // Internet
        rule("upc", "UPC", RuleType::Contains, "upc", cat, priority),
        // Rent
        rule(
            "najem",
            "Nájem",
            RuleType::Regex,
            r"(?i)najem|najemne",
            cat,
            priority + 10,
        ),
        rule("svj", "SVJ", RuleType::Contains, "svj", cat, priority),
        // Postal services
        rule(
            "ceska_posta",
            "Česká pošta",
            RuleType::Regex,
            r"(?i)ceska\s*posta|ceskaposta",
            cat,
            priority,
        ),
        rule(
            "balikovna",
            "Balíkovna",
            RuleType::Contains,
            "balikovna",
            cat,
            priority,
        ),
        // Delivery services
        rule(
            "ppl",
            "PPL",
            RuleType::Regex,
            r"(?i)\bppl\b",
            cat,
            priority - 5,
        ),
        rule(
            "dpd",
            "DPD",
            RuleType::Regex,
            r"(?i)\bdpd\b",
            cat,
            priority - 5,
        ),
        rule(
            "gls",
            "GLS",
            RuleType::Regex,
            r"(?i)\bgls\b",
            cat,
            priority - 5,
        ),
        rule(
            "zasilkovna",
            "Zásilkovna",
            RuleType::Contains,
            "zasilkovna",
            cat,
            priority,
        ),
        rule(
            "packeta",
            "Packeta",
            RuleType::Contains,
            "packeta",
            cat,
            priority,
        ),
    ]
}

fn entertainment_rules() -> Vec<CategorizationRule> {
    let cat = "cat_entertainment";
    let priority = 50;

    vec![
        // Streaming
        rule(
            "netflix",
            "Netflix",
            RuleType::Contains,
            "netflix",
            cat,
            priority,
        ),
        rule(
            "spotify",
            "Spotify",
            RuleType::Contains,
            "spotify",
            cat,
            priority,
        ),
        rule(
            "apple_music",
            "Apple Music",
            RuleType::Contains,
            "apple.com/bill",
            cat,
            priority,
        ),
        rule("hbo", "HBO Max", RuleType::Contains, "hbo", cat, priority),
        rule(
            "disney",
            "Disney+",
            RuleType::Contains,
            "disney",
            cat,
            priority,
        ),
        rule(
            "youtube",
            "YouTube Premium",
            RuleType::Contains,
            "youtube",
            cat,
            priority,
        ),
        rule("voyo", "VOYO", RuleType::Contains, "voyo", cat, priority),
        // Games
        rule("steam", "Steam", RuleType::Contains, "steam", cat, priority),
        rule(
            "playstation",
            "PlayStation",
            RuleType::Contains,
            "playstation",
            cat,
            priority,
        ),
        rule("xbox", "Xbox", RuleType::Contains, "xbox", cat, priority),
        rule(
            "epic",
            "Epic Games",
            RuleType::Contains,
            "epic games",
            cat,
            priority,
        ),
        // Cinema
        rule(
            "cinema_city",
            "Cinema City",
            RuleType::Contains,
            "cinema city",
            cat,
            priority,
        ),
        rule(
            "cinestar",
            "CineStar",
            RuleType::Contains,
            "cinestar",
            cat,
            priority,
        ),
        // Events
        rule(
            "ticketmaster",
            "Ticketmaster",
            RuleType::Contains,
            "ticketmaster",
            cat,
            priority,
        ),
        rule(
            "ticketportal",
            "Ticketportal",
            RuleType::Contains,
            "ticketportal",
            cat,
            priority,
        ),
        rule("goout", "GoOut", RuleType::Contains, "goout", cat, priority),
    ]
}

fn shopping_rules() -> Vec<CategorizationRule> {
    let cat = "cat_shopping";
    let priority = 50;

    vec![
        // Electronics
        rule("alza", "Alza.cz", RuleType::Contains, "alza", cat, priority),
        rule(
            "datart",
            "Datart",
            RuleType::Contains,
            "datart",
            cat,
            priority,
        ),
        rule("czc", "CZC.cz", RuleType::Contains, "czc", cat, priority),
        rule(
            "mall",
            "Mall.cz",
            RuleType::Contains,
            "mall",
            cat,
            priority - 5,
        ),
        // E-commerce
        rule(
            "amazon",
            "Amazon",
            RuleType::Contains,
            "amazon",
            cat,
            priority,
        ),
        rule("ebay", "eBay", RuleType::Contains, "ebay", cat, priority),
        rule(
            "aliexpress",
            "AliExpress",
            RuleType::Contains,
            "aliexpress",
            cat,
            priority,
        ),
        rule(
            "zalando",
            "Zalando",
            RuleType::Contains,
            "zalando",
            cat,
            priority,
        ),
        // Fashion
        rule(
            "zara",
            "Zara",
            RuleType::Contains,
            "zara",
            cat,
            priority - 5,
        ),
        rule("hm", "H&M", RuleType::Contains, "h&m", cat, priority),
        rule(
            "reserved",
            "Reserved",
            RuleType::Contains,
            "reserved",
            cat,
            priority - 5,
        ),
        rule(
            "decathlon",
            "Decathlon",
            RuleType::Contains,
            "decathlon",
            cat,
            priority,
        ),
        rule(
            "sportisimo",
            "Sportisimo",
            RuleType::Contains,
            "sportisimo",
            cat,
            priority,
        ),
        // Home (furniture)
        rule("ikea", "IKEA", RuleType::Contains, "ikea", cat, priority),
        rule("jysk", "JYSK", RuleType::Contains, "jysk", cat, priority),
        // Drugstores
        rule(
            "dm",
            "dm drogerie",
            RuleType::Contains,
            "dm drogerie",
            cat,
            priority,
        ),
        rule(
            "rossmann",
            "Rossmann",
            RuleType::Contains,
            "rossmann",
            cat,
            priority,
        ),
        rule(
            "teta",
            "Teta Drogerie",
            RuleType::Contains,
            "teta",
            cat,
            priority - 5,
        ),
        rule(
            "notino",
            "Notino",
            RuleType::Contains,
            "notino",
            cat,
            priority,
        ),
    ]
}

fn health_rules() -> Vec<CategorizationRule> {
    let cat = "cat_health";
    let priority = 50;

    vec![
        // Pharmacies
        rule(
            "drmax",
            "Dr.Max",
            RuleType::Contains,
            "dr.max",
            cat,
            priority,
        ),
        rule(
            "benu",
            "BENU lékárna",
            RuleType::Contains,
            "benu",
            cat,
            priority,
        ),
        rule(
            "lekarna",
            "Lékárna",
            RuleType::Contains,
            "lekarna",
            cat,
            priority - 5,
        ),
        rule(
            "pilulka",
            "Pilulka.cz",
            RuleType::Contains,
            "pilulka",
            cat,
            priority,
        ),
        // Medical
        rule(
            "nemocnice",
            "Nemocnice",
            RuleType::Contains,
            "nemocnice",
            cat,
            priority,
        ),
        rule(
            "poliklinika",
            "Poliklinika",
            RuleType::Contains,
            "poliklinika",
            cat,
            priority,
        ),
        rule(
            "medicover",
            "Medicover",
            RuleType::Contains,
            "medicover",
            cat,
            priority,
        ),
        rule(
            "synlab",
            "SYNLAB",
            RuleType::Contains,
            "synlab",
            cat,
            priority,
        ),
        // Fitness
        rule(
            "fitness",
            "Fitness",
            RuleType::Contains,
            "fitness",
            cat,
            priority - 10,
        ),
        rule(
            "multisport",
            "MultiSport",
            RuleType::Contains,
            "multisport",
            cat,
            priority,
        ),
    ]
}

fn travel_rules() -> Vec<CategorizationRule> {
    let cat = "cat_travel";
    let priority = 50;

    vec![
        // Airlines
        rule(
            "ryanair",
            "Ryanair",
            RuleType::Contains,
            "ryanair",
            cat,
            priority,
        ),
        rule(
            "wizzair",
            "Wizz Air",
            RuleType::Contains,
            "wizz",
            cat,
            priority,
        ),
        rule(
            "smartwings",
            "Smartwings",
            RuleType::Contains,
            "smartwings",
            cat,
            priority,
        ),
        rule(
            "lufthansa",
            "Lufthansa",
            RuleType::Contains,
            "lufthansa",
            cat,
            priority,
        ),
        rule(
            "easyjet",
            "easyJet",
            RuleType::Contains,
            "easyjet",
            cat,
            priority,
        ),
        // Booking
        rule(
            "booking",
            "Booking.com",
            RuleType::Contains,
            "booking",
            cat,
            priority,
        ),
        rule(
            "airbnb",
            "Airbnb",
            RuleType::Contains,
            "airbnb",
            cat,
            priority,
        ),
        rule(
            "expedia",
            "Expedia",
            RuleType::Contains,
            "expedia",
            cat,
            priority,
        ),
        // Travel agencies
        rule(
            "invia",
            "Invia.cz",
            RuleType::Contains,
            "invia",
            cat,
            priority,
        ),
        rule("cedok", "Čedok", RuleType::Contains, "cedok", cat, priority),
        rule(
            "fischer",
            "Fischer",
            RuleType::Contains,
            "fischer",
            cat,
            priority - 5,
        ),
        rule(
            "kiwi",
            "Kiwi.com",
            RuleType::Contains,
            "kiwi.com",
            cat,
            priority,
        ),
    ]
}

fn income_rules() -> Vec<CategorizationRule> {
    let cat = "cat_income";
    let priority = 60; // Higher priority for income

    vec![
        // Salary
        rule(
            "mzda",
            "Mzda",
            RuleType::Regex,
            r"(?i)\bmzda\b|\bvyplata\b|\bplat\b",
            cat,
            priority,
        ),
        rule(
            "vyplata",
            "Výplata",
            RuleType::Contains,
            "vyplata",
            cat,
            priority,
        ),
        // Benefits
        rule(
            "stravenky",
            "Stravenky",
            RuleType::Contains,
            "stravenkovy",
            cat,
            priority,
        ),
        // Government
        rule("cssz", "ČSSZ", RuleType::Contains, "cssz", cat, priority),
        rule(
            "duchod",
            "Důchod",
            RuleType::Contains,
            "duchod",
            cat,
            priority,
        ),
        // Refunds
        rule(
            "vratka",
            "Vrátka",
            RuleType::Contains,
            "vratka",
            cat,
            priority - 5,
        ),
        rule(
            "dobropis",
            "Dobropis",
            RuleType::Contains,
            "dobropis",
            cat,
            priority - 5,
        ),
    ]
}

fn investments_rules() -> Vec<CategorizationRule> {
    let cat = "cat_investments";
    let priority = 60; // Higher priority for financial transactions

    vec![
        // Czech/EU Brokers
        rule(
            "degiro",
            "DEGIRO",
            RuleType::Contains,
            "degiro",
            cat,
            priority,
        ),
        rule("xtb", "XTB", RuleType::Contains, "xtb", cat, priority),
        rule("portu", "Portu", RuleType::Contains, "portu", cat, priority),
        rule(
            "fondee",
            "Fondee",
            RuleType::Contains,
            "fondee",
            cat,
            priority,
        ),
        rule(
            "fio_ebroker",
            "Fio e-Broker",
            RuleType::Regex,
            r"(?i)fio.*broker|e-broker",
            cat,
            priority,
        ),
        rule("lynx", "Lynx", RuleType::Contains, "lynx", cat, priority),
        // International
        rule(
            "interactive_brokers",
            "Interactive Brokers",
            RuleType::Contains,
            "interactive brokers",
            cat,
            priority,
        ),
        rule("etoro", "eToro", RuleType::Contains, "etoro", cat, priority),
        rule(
            "trading212",
            "Trading 212",
            RuleType::Contains,
            "trading 212",
            cat,
            priority,
        ),
        rule(
            "revolut_trading",
            "Revolut Trading",
            RuleType::Regex,
            r"(?i)revolut.*trad|revolut.*invest",
            cat,
            priority,
        ),
        // Crypto exchanges (also investments)
        rule(
            "binance",
            "Binance",
            RuleType::Contains,
            "binance",
            cat,
            priority - 5,
        ),
        rule(
            "coinbase",
            "Coinbase",
            RuleType::Contains,
            "coinbase",
            cat,
            priority - 5,
        ),
        rule(
            "kraken",
            "Kraken",
            RuleType::Contains,
            "kraken",
            cat,
            priority - 5,
        ),
    ]
}

fn housing_rules() -> Vec<CategorizationRule> {
    let cat = "cat_housing";
    let priority = 50;

    vec![
        // DIY stores
        rule(
            "hornbach",
            "Hornbach",
            RuleType::Contains,
            "hornbach",
            cat,
            priority,
        ),
        rule("obi", "OBI", RuleType::Contains, "obi", cat, priority),
        rule(
            "baumax",
            "Baumax",
            RuleType::Contains,
            "baumax",
            cat,
            priority,
        ),
        rule(
            "bauhaus",
            "Bauhaus",
            RuleType::Contains,
            "bauhaus",
            cat,
            priority,
        ),
        rule(
            "uni_hobby",
            "Uni Hobby",
            RuleType::Contains,
            "uni hobby",
            cat,
            priority,
        ),
        rule(
            "mountfield",
            "Mountfield",
            RuleType::Contains,
            "mountfield",
            cat,
            priority,
        ),
        // Building materials
        rule(
            "stavebniny",
            "Stavebniny",
            RuleType::Contains,
            "stavebniny",
            cat,
            priority - 5,
        ),
        rule(
            "dek",
            "DEK Stavebniny",
            RuleType::Contains,
            "dek",
            cat,
            priority - 10,
        ),
        // Home services/contractors
        rule(
            "renovace",
            "Renovace",
            RuleType::Contains,
            "renovac",
            cat,
            priority,
        ),
        rule(
            "zahradnik",
            "Zahradník",
            RuleType::Contains,
            "zahradn",
            cat,
            priority - 5,
        ),
        rule(
            "malir",
            "Malíř",
            RuleType::Regex,
            r"(?i)malir|natěrač|naterac",
            cat,
            priority - 5,
        ),
        rule(
            "instalater",
            "Instalatér",
            RuleType::Regex,
            r"(?i)instalat|topenář|topenar",
            cat,
            priority - 5,
        ),
        rule(
            "elektrikar",
            "Elektrikář",
            RuleType::Regex,
            r"(?i)elektrik|elektromont",
            cat,
            priority - 5,
        ),
    ]
}

fn taxes_rules() -> Vec<CategorizationRule> {
    let cat = "cat_taxes";
    let priority = 70; // High priority - tax payments are important

    vec![
        // Czech Tax Authority (Finanční úřad) - bank code 0710
        // Czech IBAN format: CZxx0710... (bank code after country code + check digits)
        rule(
            "financni_urad_iban",
            "Finanční úřad (0710)",
            RuleType::Regex,
            r"(?i)cz\d{2}0710|0710\d{10}|/0710$",
            cat,
            priority,
        ),
        // Common tax-related keywords
        rule(
            "dan_keyword",
            "Daně",
            RuleType::Regex,
            r"(?i)dan\b|dpfo|dpph|dph|financni\s*urad",
            cat,
            priority - 10,
        ),
    ]
}

fn transfer_rules() -> Vec<CategorizationRule> {
    let cat = "cat_internal_transfers";
    let priority = 40;

    vec![
        // NOTE: Fintech intermediaries (Revolut, Wise, N26) intentionally NOT included here.
        // They are just payment processors - the actual merchant/destination is what matters.
        // Users should categorize based on where the money actually went, not the intermediary.
        // ML classifier can still suggest categories based on transaction description.
        //
        // Own accounts
        rule(
            "vlastni_ucet",
            "Vlastní účet",
            RuleType::Contains,
            "vlastni ucet",
            cat,
            priority,
        ),
        rule(
            "prevod",
            "Převod",
            RuleType::Regex,
            r"(?i)prevod.*ucet|mezi.*ucty",
            cat,
            priority,
        ),
        // Cash
        rule(
            "vyber",
            "Výběr z bankomatu",
            RuleType::Regex,
            r"(?i)vyber.*bankomat|atm.*vyber",
            cat,
            priority,
        ),
        rule(
            "vklad",
            "Vklad",
            RuleType::Contains,
            "vklad hotovost",
            cat,
            priority,
        ),
        // Savings
        rule(
            "sporeni",
            "Spoření",
            RuleType::Contains,
            "sporeni",
            cat,
            priority,
        ),
        rule(
            "stav_sporeni",
            "Stavební spoření",
            RuleType::Contains,
            "stavebni spor",
            cat,
            priority,
        ),
    ]
}

/// Helper to create a rule
fn rule(
    id: &str,
    name: &str,
    rule_type: RuleType,
    pattern: &str,
    category_id: &str,
    priority: i32,
) -> CategorizationRule {
    CategorizationRule {
        id: format!("default_{}", id),
        name: name.into(),
        rule_type,
        pattern: pattern.into(),
        category_id: category_id.into(),
        priority,
        is_active: true,
        stop_processing: false,
        iban_pattern: None,
        variable_symbol: None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_rules_not_empty() {
        let rules = get_default_rules();
        assert!(!rules.is_empty());
        assert!(rules.len() > 50); // Should have many rules
    }

    #[test]
    fn test_all_categories_covered() {
        let rules = get_default_rules();
        let categories: std::collections::HashSet<_> =
            rules.iter().map(|r| r.category_id.as_str()).collect();

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
    }

    #[test]
    fn test_unique_ids() {
        let rules = get_default_rules();
        let ids: Vec<_> = rules.iter().map(|r| &r.id).collect();
        let unique_ids: std::collections::HashSet<_> = ids.iter().collect();
        assert_eq!(ids.len(), unique_ids.len(), "All rule IDs should be unique");
    }
}
