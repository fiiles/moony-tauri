-- NeonDB Migration Script
-- Generated: 2025-12-15T15:53:34.330Z
-- Source user ID: 3

-- Clear existing data (in reverse dependency order)
DELETE FROM portfolio_metrics_history;
DELETE FROM entity_history;
DELETE FROM crypto_transactions;
DELETE FROM crypto_prices;
DELETE FROM crypto_investments;
DELETE FROM dividend_overrides;
DELETE FROM dividend_data;
DELETE FROM stock_price_overrides;
DELETE FROM stock_prices;
DELETE FROM investment_transactions;
DELETE FROM stock_investments;
DELETE FROM real_estate_loans;
DELETE FROM real_estate;
DELETE FROM savings_account_zones;
DELETE FROM savings_accounts;
DELETE FROM bonds;
DELETE FROM loans;

-- User Profile
INSERT INTO user_profile (name, surname, email, menu_preferences, currency, exclude_personal_real_estate) VALUES (
  'Filip',
  'Král',
  'filip_kral@hotmail.cz',
  '{"bonds":true,"loans":true,"crypto":true,"savings":true,"insurance":true,"realEstate":true,"commodities":true,"investments":true}',
  'CZK',
  1
);

-- Savings Accounts
INSERT INTO savings_accounts (id, name, balance, currency, interest_rate, has_zone_designation, created_at, updated_at) VALUES (
  'ed231128-d971-4e4f-966d-50f286cce182',
  'Creditas',
  '700000.00',
  'CZK',
  '3.09',
  1,
  1763806758,
  1764932626
);
INSERT INTO savings_accounts (id, name, balance, currency, interest_rate, has_zone_designation, created_at, updated_at) VALUES (
  '59b2886b-5e74-40a0-a423-4912146233bf',
  'Degiro',
  '5950.00',
  'EUR',
  '0.00',
  0,
  1764932759,
  1764932759
);
INSERT INTO savings_accounts (id, name, balance, currency, interest_rate, has_zone_designation, created_at, updated_at) VALUES (
  'c8f34b25-2507-4014-87c8-fb3b0815de0d',
  'Portu',
  '1853405.00',
  'CZK',
  '3.20',
  0,
  1763806758,
  1764932836
);
INSERT INTO savings_accounts (id, name, balance, currency, interest_rate, has_zone_designation, created_at, updated_at) VALUES (
  'ed13ad5c-665c-490a-90d6-d682111357c4',
  'FIO - CZK',
  '15998.00',
  'CZK',
  '0.00',
  0,
  1765194734,
  1765194734
);
INSERT INTO savings_accounts (id, name, balance, currency, interest_rate, has_zone_designation, created_at, updated_at) VALUES (
  '999d4905-d07f-4a66-915f-b2e40deb81fc',
  'FIO USD',
  '7032.00',
  'USD',
  '0.00',
  0,
  1764932700,
  1765481160
);

-- Savings Account Zones
INSERT INTO savings_account_zones (id, savings_account_id, from_amount, to_amount, interest_rate, created_at) VALUES (
  'ab8eb200-6dac-42eb-a611-feff7d8931ad',
  'ed231128-d971-4e4f-966d-50f286cce182',
  '0.00',
  '500000.00',
  '3.20',
  1764932626
);
INSERT INTO savings_account_zones (id, savings_account_id, from_amount, to_amount, interest_rate, created_at) VALUES (
  '766ff5f9-d4ea-4abb-8ae0-75c0cf028ccc',
  'ed231128-d971-4e4f-966d-50f286cce182',
  '500000.00',
  NULL,
  '2.80',
  1764932626
);

-- Loans
INSERT INTO loans (id, name, principal, currency, interest_rate, interest_rate_validity_date, monthly_payment, start_date, end_date, created_at, updated_at) VALUES (
  'dea11d72-ebab-451d-a4c5-ea33ff2829db',
  'Vysoká - pozemek',
  '1838159.00',
  'CZK',
  '1.44',
  1764892800,
  '6940.00',
  1764529810,
  2605996800,
  1763806758,
  1764932882
);
INSERT INTO loans (id, name, principal, currency, interest_rate, interest_rate_validity_date, monthly_payment, start_date, end_date, created_at, updated_at) VALUES (
  'aa024be0-f90f-4058-a7db-8b6839a97b5b',
  'Vysoká - dům',
  '9063108.00',
  'CZK',
  '1.74',
  1882828800,
  '34371.00',
  1764529810,
  2642803200,
  1763807636,
  1764932916
);

-- Bonds
INSERT INTO bonds (id, name, isin, coupon_value, interest_rate, maturity_date, currency, created_at, updated_at) VALUES (
  '082d6018-ed8b-4113-b1ad-6cc0bf854851',
  'Rohlík',
  '',
  '400000.00',
  '6.00',
  1892419200,
  'CZK',
  1763807784,
  1764506843
);

-- Real Estate
INSERT INTO real_estate (id, name, address, type, purchase_price, purchase_price_currency, market_price, market_price_currency, monthly_rent, monthly_rent_currency, recurring_costs, photos, notes, created_at, updated_at) VALUES (
  '0dfac107-b4be-4eef-a484-e869715ef69d',
  'VnL Dům',
  'Hradecká 597, Vysoká nad Labem',
  'personal',
  '17000000.00',
  'CZK',
  '20000000.00',
  'CZK',
  '0.00',
  'CZK',
  '[{"name":"Pojistka byt - Hnezdenska","amount":105,"frequency":"monthly"},{"name":"Kanalizace","amount":310,"frequency":"monthly"},{"name":"Internet","amount":290,"frequency":"monthly"},{"name":"Voda","amount":740,"frequency":"monthly"},{"name":"Eletřina","amount":1880,"frequency":"monthly"}]',
  '[]',
  '',
  1764421325,
  1764422668
);
INSERT INTO real_estate (id, name, address, type, purchase_price, purchase_price_currency, market_price, market_price_currency, monthly_rent, monthly_rent_currency, recurring_costs, photos, notes, created_at, updated_at) VALUES (
  '912082a4-6bda-413f-b371-8bfefcb2371f',
  'Malšovice Byt',
  'Na Kotli 29, Hradec Králové',
  'investment',
  '1875000.00',
  'CZK',
  '3400000.00',
  'CZK',
  '13000.00',
  'CZK',
  '[]',
  '[]',
  'Toto je byt Lucinečky, známý rovněž pod pojmem hnízdo',
  1764424212,
  1764424832
);

-- Real Estate Loans
INSERT INTO real_estate_loans (real_estate_id, loan_id) VALUES (
  '0dfac107-b4be-4eef-a484-e869715ef69d',
  'aa024be0-f90f-4058-a7db-8b6839a97b5b'
);
INSERT INTO real_estate_loans (real_estate_id, loan_id) VALUES (
  '0dfac107-b4be-4eef-a484-e869715ef69d',
  'dea11d72-ebab-451d-a4c5-ea33ff2829db'
);

-- Stock Investments
INSERT INTO stock_investments (id, ticker, company_name, quantity, average_price) VALUES (
  '1bebb4e6-bfb7-44cb-a15d-704034625fef',
  'BRK-B',
  'Berkshire Hathaway Inc. New',
  '28.0000',
  '10048.16'
);
INSERT INTO stock_investments (id, ticker, company_name, quantity, average_price) VALUES (
  '2d14150e-ef10-4175-a682-13a73b74bda3',
  'IEF',
  'iShares 7-10 Year Treasury Bond',
  '147.0000',
  '2172.12'
);
INSERT INTO stock_investments (id, ticker, company_name, quantity, average_price) VALUES (
  '1585845f-c332-430f-b4b3-412507b174ea',
  'PM',
  'Philip Morris International Inc',
  '45.0000',
  '2125.75'
);
INSERT INTO stock_investments (id, ticker, company_name, quantity, average_price) VALUES (
  '1db29419-cac1-41a9-9775-f91368c0fc1d',
  'VOO',
  'Vanguard S&P500 ETF',
  '31.0000',
  '10862.70'
);
INSERT INTO stock_investments (id, ticker, company_name, quantity, average_price) VALUES (
  '1e17cff6-0e65-407a-bc90-4b4b7e2ca739',
  'BLK',
  'BlackRock, Inc.',
  '6.0000',
  '19165.82'
);
INSERT INTO stock_investments (id, ticker, company_name, quantity, average_price) VALUES (
  'b2284e5a-b564-4401-a91a-085d50c8c973',
  'IOO',
  'iShares Global 100 ETF',
  '47.0000',
  '1996.09'
);
INSERT INTO stock_investments (id, ticker, company_name, quantity, average_price) VALUES (
  '63128f9f-6c27-4d54-94dd-62e5597444a8',
  'GOOG',
  'Alphabet Inc.',
  '90.0000',
  '2645.26'
);
INSERT INTO stock_investments (id, ticker, company_name, quantity, average_price) VALUES (
  '0ad34200-eb35-4996-9ed0-8d3928461d0d',
  'AOA',
  'iShares Core 80/20 Aggressive A',
  '168.0000',
  '1761.05'
);
INSERT INTO stock_investments (id, ticker, company_name, quantity, average_price) VALUES (
  'e8507486-f426-421c-aaf4-d08f1cdac617',
  'TTWO',
  'Take-Two Interactive Software, ',
  '8.0000',
  '3864.00'
);
INSERT INTO stock_investments (id, ticker, company_name, quantity, average_price) VALUES (
  '61e2f1ed-faa9-4bc9-889e-a05f0441a3a9',
  'BTI',
  'British American Tobacco  Indus',
  '79.0000',
  '770.50'
);
INSERT INTO stock_investments (id, ticker, company_name, quantity, average_price) VALUES (
  '62ec7050-1e0b-417b-9a94-2a36b61495c2',
  'NGG',
  'National Grid Transco, PLC Nati',
  '32.0000',
  '1564.00'
);
INSERT INTO stock_investments (id, ticker, company_name, quantity, average_price) VALUES (
  'c639124b-3c95-41db-9ea1-0a899f098a10',
  'KO',
  'Coca-Cola Company (The)',
  '29.0000',
  '1426.00'
);
INSERT INTO stock_investments (id, ticker, company_name, quantity, average_price) VALUES (
  'a2498ec5-839e-4e53-bdad-915de5033a75',
  'CEZ.PR',
  'CEZ',
  '144.0000',
  '1043.00'
);
INSERT INTO stock_investments (id, ticker, company_name, quantity, average_price) VALUES (
  '626d9d0e-ac60-48d8-9dbd-ff78ce3a7ac7',
  'INTC',
  'Intel Corporation',
  '28.0000',
  '1122.17'
);
INSERT INTO stock_investments (id, ticker, company_name, quantity, average_price) VALUES (
  'f4e95743-89ab-4b1d-93cc-a13584890f5c',
  'CSX5.AM',
  'iShares Core EURO STOXX 50 UCIT',
  '29.0000',
  '5071.50'
);
INSERT INTO stock_investments (id, ticker, company_name, quantity, average_price) VALUES (
  '0d8b8b61-0cae-4cc2-b563-f6996fd80ad8',
  'EBS.VI',
  'Erste Group Bank AG',
  '35.0000',
  '1361.25'
);
INSERT INTO stock_investments (id, ticker, company_name, quantity, average_price) VALUES (
  '425d0ab9-c6f4-4723-a495-f2720a22f80a',
  'IEI',
  'iShares 3-7 Year Treasury Bond ',
  '179.0000',
  '2674.67'
);
INSERT INTO stock_investments (id, ticker, company_name, quantity, average_price) VALUES (
  '48e1472b-63de-475e-b600-ce088cadb747',
  'EUNL.DE',
  'iShares Core MSCI World UCITS ETF',
  '130.0000',
  '2167.50'
);
INSERT INTO stock_investments (id, ticker, company_name, quantity, average_price) VALUES (
  '0fa5801f-b3b0-428a-ae1e-26862df747b0',
  'ENGI.PA',
  'ENGIE',
  '463.0000',
  '431.75'
);
INSERT INTO stock_investments (id, ticker, company_name, quantity, average_price) VALUES (
  '263e050e-6118-40ba-be4c-7cb194a8b974',
  'EUNK.DE',
  'iShares Core MSCI Europe UCITS ETF',
  '25.0000',
  '2281.25'
);
INSERT INTO stock_investments (id, ticker, company_name, quantity, average_price) VALUES (
  '47ea6139-e6cf-4f27-acad-b48f2539d0f9',
  'SXR8.DE',
  'iShares Core S&P 500 UCITS ETF',
  '34.0000',
  '10140.00'
);
INSERT INTO stock_investments (id, ticker, company_name, quantity, average_price) VALUES (
  '7480292b-6861-4dc5-a2f8-5458e89ddde4',
  'PSKY',
  'Paramount Skydance Corporation',
  '48.0000',
  '253.92'
);
INSERT INTO stock_investments (id, ticker, company_name, quantity, average_price) VALUES (
  '00d56bfb-da8b-4544-bf17-85e22a4e2aa0',
  'IVV',
  'iShares S&P 500 Index Fund',
  '33.0000',
  '11820.00'
);
INSERT INTO stock_investments (id, ticker, company_name, quantity, average_price) VALUES (
  'dfe41ecc-62ab-4e85-b5d5-29b66c08fd0f',
  'VOW3.DE',
  'VOLKSWAGEN AG',
  '21.0000',
  '2685.71'
);
INSERT INTO stock_investments (id, ticker, company_name, quantity, average_price) VALUES (
  '35f8472a-3bf1-4039-81b9-c7032296bd5e',
  'SRG.MI',
  'SNAM',
  '870.0000',
  '115.25'
);
INSERT INTO stock_investments (id, ticker, company_name, quantity, average_price) VALUES (
  'a207f1be-f21e-440a-8e59-41e753be458f',
  'FLUX.BR',
  'FLUXYS BELGIUM',
  '230.0000',
  '433.75'
);
INSERT INTO stock_investments (id, ticker, company_name, quantity, average_price) VALUES (
  '4afda7db-793e-4af4-8b02-758f2a15b8d0',
  'AAPL',
  'Apple Inc.',
  '36.0000',
  '3546.33'
);
INSERT INTO stock_investments (id, ticker, company_name, quantity, average_price) VALUES (
  '5d533e8a-68a2-4b63-8ad8-efa0ee124c85',
  'TRN.MI',
  'TERNA',
  '506.0000',
  '181.70'
);
INSERT INTO stock_investments (id, ticker, company_name, quantity, average_price) VALUES (
  '101936eb-f093-4535-ae30-ec20d65cf37f',
  'MSFT',
  'Microsoft Corporation',
  '6.0000',
  '4899.00'
);
INSERT INTO stock_investments (id, ticker, company_name, quantity, average_price) VALUES (
  '042b1b9d-aee7-4c44-b647-2044709c95a2',
  'VYMI',
  'Vanguard International High Div',
  '248.0000',
  '1762.25'
);
INSERT INTO stock_investments (id, ticker, company_name, quantity, average_price) VALUES (
  '75a45bc6-7c8f-48d1-9d61-de0c79acedd0',
  'FORTUM.HE',
  'Fortum Corporation',
  '794.0000',
  '357.88'
);
INSERT INTO stock_investments (id, ticker, company_name, quantity, average_price) VALUES (
  'e2f9b1f0-ac06-4c94-bfe1-1b0245511dad',
  'CRM',
  'Salesforce, Inc.',
  '18.0000',
  '6141.00'
);
INSERT INTO stock_investments (id, ticker, company_name, quantity, average_price) VALUES (
  '6e06e618-c0f1-4e12-b0fa-6decba20a04d',
  'BMW.DE',
  'BAYERISCHE MOTOREN WERKE AG   S',
  '75.0000',
  '2119.00'
);
INSERT INTO stock_investments (id, ticker, company_name, quantity, average_price) VALUES (
  '1412abe3-d604-4654-8947-00a0d2151010',
  'TSM',
  'Taiwan Semiconductor Manufactur',
  '30.0000',
  '2059.44'
);
INSERT INTO stock_investments (id, ticker, company_name, quantity, average_price) VALUES (
  '8f62996d-9c94-47ba-9d1f-630624334870',
  'VWCE.DE',
  'Vanguard FTSE All-World U.ETF R',
  '1.0000',
  '2539.00'
);

-- Investment Transactions
INSERT INTO investment_transactions (id, investment_id, type, ticker, company_name, quantity, price_per_unit, currency, transaction_date, created_at) VALUES (
  'b819eec0-3fe4-49a7-ab0d-89ed44258851',
  '626d9d0e-ac60-48d8-9dbd-ff78ce3a7ac7',
  'buy',
  'INTC',
  'Intel Corporation',
  '28.0000',
  '48.79',
  'USD',
  1597363200,
  1764339585
);
INSERT INTO investment_transactions (id, investment_id, type, ticker, company_name, quantity, price_per_unit, currency, transaction_date, created_at) VALUES (
  'e291dd1b-ace1-4d42-9997-6cc06ab86bdc',
  '101936eb-f093-4535-ae30-ec20d65cf37f',
  'buy',
  'MSFT',
  'Microsoft Corporation',
  '6.0000',
  '213.00',
  'USD',
  1611014400,
  1764342164
);
INSERT INTO investment_transactions (id, investment_id, type, ticker, company_name, quantity, price_per_unit, currency, transaction_date, created_at) VALUES (
  'f1d8dfcd-68b8-4df7-8b3b-e5774be7a05a',
  '4afda7db-793e-4af4-8b02-758f2a15b8d0',
  'buy',
  'AAPL',
  'Apple Inc.',
  '8.0000',
  '170.70',
  'USD',
  1649808000,
  1764403610
);
INSERT INTO investment_transactions (id, investment_id, type, ticker, company_name, quantity, price_per_unit, currency, transaction_date, created_at) VALUES (
  '1c9601a2-2015-4005-8fcc-8a6c023343be',
  '1412abe3-d604-4654-8947-00a0d2151010',
  'buy',
  'TSM',
  'Taiwan Semiconductor Manufactur',
  '13.0000',
  '109.00',
  'USD',
  1620864000,
  1764400277
);
INSERT INTO investment_transactions (id, investment_id, type, ticker, company_name, quantity, price_per_unit, currency, transaction_date, created_at) VALUES (
  '894fad48-a7ac-402f-87b2-4f07670cd32a',
  'e8507486-f426-421c-aaf4-d08f1cdac617',
  'buy',
  'TTWO',
  'Take-Two Interactive Software, ',
  '8.0000',
  '168.00',
  'USD',
  1638144000,
  1764400348
);
INSERT INTO investment_transactions (id, investment_id, type, ticker, company_name, quantity, price_per_unit, currency, transaction_date, created_at) VALUES (
  '791ab93d-6e14-4463-9c61-4b3da8858925',
  '4afda7db-793e-4af4-8b02-758f2a15b8d0',
  'buy',
  'AAPL',
  'Apple Inc.',
  '8.0000',
  '174.79',
  'USD',
  1643760000,
  1764400391
);
INSERT INTO investment_transactions (id, investment_id, type, ticker, company_name, quantity, price_per_unit, currency, transaction_date, created_at) VALUES (
  '8cc25473-4a3f-475d-8bd1-c6e976e743eb',
  'c639124b-3c95-41db-9ea1-0a899f098a10',
  'buy',
  'KO',
  'Coca-Cola Company (The)',
  '29.0000',
  '62.00',
  'USD',
  1690848000,
  1764403874
);
INSERT INTO investment_transactions (id, investment_id, type, ticker, company_name, quantity, price_per_unit, currency, transaction_date, created_at) VALUES (
  'e4d9e241-8fbe-402c-9c7d-100c8bb1560f',
  '61e2f1ed-faa9-4bc9-889e-a05f0441a3a9',
  'buy',
  'BTI',
  'British American Tobacco  Indus',
  '79.0000',
  '33.50',
  'USD',
  1693353600,
  1764403957
);
INSERT INTO investment_transactions (id, investment_id, type, ticker, company_name, quantity, price_per_unit, currency, transaction_date, created_at) VALUES (
  'd02498cb-8dc7-455a-a214-4f35742cf8f6',
  '1585845f-c332-430f-b4b3-412507b174ea',
  'buy',
  'PM',
  'Philip Morris International Inc',
  '21.0000',
  '92.28',
  'USD',
  1703116800,
  1764404016
);
INSERT INTO investment_transactions (id, investment_id, type, ticker, company_name, quantity, price_per_unit, currency, transaction_date, created_at) VALUES (
  '45aa4cf3-9678-488a-8509-b94daa3973bf',
  '62ec7050-1e0b-417b-9a94-2a36b61495c2',
  'buy',
  'NGG',
  'National Grid Transco, PLC Nati',
  '32.0000',
  '68.00',
  'USD',
  1710201600,
  1764405246
);
INSERT INTO investment_transactions (id, investment_id, type, ticker, company_name, quantity, price_per_unit, currency, transaction_date, created_at) VALUES (
  '751041f3-c877-4858-82cb-1f0d6710ddb1',
  '1bebb4e6-bfb7-44cb-a15d-704034625fef',
  'buy',
  'BRK-B',
  'Berkshire Hathaway Inc. New',
  '5.0000',
  '438.87',
  'USD',
  1722384000,
  1764405284
);
INSERT INTO investment_transactions (id, investment_id, type, ticker, company_name, quantity, price_per_unit, currency, transaction_date, created_at) VALUES (
  'ed2d7f43-fc99-47bb-9edf-3c6b32022028',
  '1e17cff6-0e65-407a-bc90-4b4b7e2ca739',
  'buy',
  'BLK',
  'BlackRock, Inc.',
  '2.0000',
  '1017.91',
  'USD',
  1737676800,
  1764406008
);
INSERT INTO investment_transactions (id, investment_id, type, ticker, company_name, quantity, price_per_unit, currency, transaction_date, created_at) VALUES (
  '3aece745-c33b-40c3-b098-7963bdfdc8ef',
  'a2498ec5-839e-4e53-bdad-915de5033a75',
  'buy',
  'CEZ.PR',
  'CEZ',
  '144.0000',
  '1043.00',
  'CZK',
  1741651200,
  1764406071
);
INSERT INTO investment_transactions (id, investment_id, type, ticker, company_name, quantity, price_per_unit, currency, transaction_date, created_at) VALUES (
  'e8729cf1-1506-4c91-8fec-7fd43c0fe920',
  '63128f9f-6c27-4d54-94dd-62e5597444a8',
  'buy',
  'GOOG',
  'Alphabet Inc.',
  '10.0000',
  '153.00',
  'USD',
  1743638400,
  1764406111
);
INSERT INTO investment_transactions (id, investment_id, type, ticker, company_name, quantity, price_per_unit, currency, transaction_date, created_at) VALUES (
  '8a128ea7-d24f-4a78-8e16-ce8f62b0d4d1',
  'e2f9b1f0-ac06-4c94-bfe1-1b0245511dad',
  'buy',
  'CRM',
  'Salesforce, Inc.',
  '18.0000',
  '267.00',
  'USD',
  1751414400,
  1764406146
);
INSERT INTO investment_transactions (id, investment_id, type, ticker, company_name, quantity, price_per_unit, currency, transaction_date, created_at) VALUES (
  'b7b0cb7b-5e1c-4f9b-a37c-8d66c025148c',
  '1db29419-cac1-41a9-9775-f91368c0fc1d',
  'buy',
  'VOO',
  'Vanguard S&P500 ETF',
  '5.0000',
  '569.38',
  'USD',
  1751414400,
  1764406936
);
INSERT INTO investment_transactions (id, investment_id, type, ticker, company_name, quantity, price_per_unit, currency, transaction_date, created_at) VALUES (
  'e70e1f16-b3c2-4d5f-ba14-9d28574ee49e',
  'b2284e5a-b564-4401-a91a-085d50c8c973',
  'buy',
  'IOO',
  'iShares Global 100 ETF',
  '22.0000',
  '83.93',
  'USD',
  1706572800,
  1764408045
);
INSERT INTO investment_transactions (id, investment_id, type, ticker, company_name, quantity, price_per_unit, currency, transaction_date, created_at) VALUES (
  '1e6be3d0-6ad3-4739-adcd-924015e318ca',
  '00d56bfb-da8b-4544-bf17-85e22a4e2aa0',
  'buy',
  'IVV',
  'iShares S&P 500 Index Fund',
  '3.0000',
  '550.57',
  'USD',
  1718841600,
  1764408135
);
INSERT INTO investment_transactions (id, investment_id, type, ticker, company_name, quantity, price_per_unit, currency, transaction_date, created_at) VALUES (
  '6646c77c-c1ac-49ec-bff8-c964174c6c07',
  '0ad34200-eb35-4996-9ed0-8d3928461d0d',
  'buy',
  'AOA',
  'iShares Core 80/20 Aggressive A',
  '33.0000',
  '78.15',
  'USD',
  1732233600,
  1764408726
);
INSERT INTO investment_transactions (id, investment_id, type, ticker, company_name, quantity, price_per_unit, currency, transaction_date, created_at) VALUES (
  'c2473fb6-e4d2-4040-bd44-6c1aab34a463',
  '63128f9f-6c27-4d54-94dd-62e5597444a8',
  'buy',
  'GOOG',
  'Alphabet Inc.',
  '20.0000',
  '115.50',
  'USD',
  1651449600,
  1764403703
);
INSERT INTO investment_transactions (id, investment_id, type, ticker, company_name, quantity, price_per_unit, currency, transaction_date, created_at) VALUES (
  'bd8c7485-2a21-4b0a-9296-f6614831370b',
  '4afda7db-793e-4af4-8b02-758f2a15b8d0',
  'buy',
  'AAPL',
  'Apple Inc.',
  '9.0000',
  '155.65',
  'USD',
  1651449600,
  1764403634
);
INSERT INTO investment_transactions (id, investment_id, type, ticker, company_name, quantity, price_per_unit, currency, transaction_date, created_at) VALUES (
  '33d5c43f-185d-448f-af36-40fb4cfad40b',
  '4afda7db-793e-4af4-8b02-758f2a15b8d0',
  'buy',
  'AAPL',
  'Apple',
  '11.0000',
  '126.00',
  'USD',
  1614643200,
  1764239894
);
INSERT INTO investment_transactions (id, investment_id, type, ticker, company_name, quantity, price_per_unit, currency, transaction_date, created_at) VALUES (
  '09f803ee-527f-4def-af79-cfa669328c1d',
  '00d56bfb-da8b-4544-bf17-85e22a4e2aa0',
  'buy',
  'IVV',
  'iShares S&P 500 Index Fund',
  '3.0000',
  '586.40',
  'USD',
  1729814400,
  1764408677
);
INSERT INTO investment_transactions (id, investment_id, type, ticker, company_name, quantity, price_per_unit, currency, transaction_date, created_at) VALUES (
  'f30cc6cb-aa8a-46b8-8d08-c700a32a1d2e',
  '00d56bfb-da8b-4544-bf17-85e22a4e2aa0',
  'buy',
  'IVV',
  'iShares S&P 500 Index Fund',
  '6.0000',
  '523.80',
  'USD',
  1716249600,
  1764408104
);
INSERT INTO investment_transactions (id, investment_id, type, ticker, company_name, quantity, price_per_unit, currency, transaction_date, created_at) VALUES (
  'f9a5ed42-ee2f-43c6-b36a-d042a1ab1fa4',
  '00d56bfb-da8b-4544-bf17-85e22a4e2aa0',
  'buy',
  'IVV',
  'iShares S&P 500 Index Fund',
  '3.0000',
  '574.60',
  'USD',
  1728000000,
  1764408653
);
INSERT INTO investment_transactions (id, investment_id, type, ticker, company_name, quantity, price_per_unit, currency, transaction_date, created_at) VALUES (
  '7eeca77d-63a4-40b2-b1b6-bd02e34f6ff0',
  '00d56bfb-da8b-4544-bf17-85e22a4e2aa0',
  'buy',
  'IVV',
  'iShares S&P 500 Index Fund',
  '3.0000',
  '534.00',
  'USD',
  1723161600,
  1764408611
);
INSERT INTO investment_transactions (id, investment_id, type, ticker, company_name, quantity, price_per_unit, currency, transaction_date, created_at) VALUES (
  '4a5bbdf7-bf56-40cd-b288-fab8f29fa2ce',
  '0ad34200-eb35-4996-9ed0-8d3928461d0d',
  'buy',
  'AOA',
  'iShares Core 80/20 Aggressive A',
  '28.0000',
  '76.64',
  'USD',
  1725321600,
  1764408630
);
INSERT INTO investment_transactions (id, investment_id, type, ticker, company_name, quantity, price_per_unit, currency, transaction_date, created_at) VALUES (
  '702abdf2-ded5-4cfe-933e-b4dd407473ec',
  '0ad34200-eb35-4996-9ed0-8d3928461d0d',
  'buy',
  'AOA',
  'iShares Core 80/20 Aggressive A',
  '39.0000',
  '75.00',
  'USD',
  1718841600,
  1764408168
);
INSERT INTO investment_transactions (id, investment_id, type, ticker, company_name, quantity, price_per_unit, currency, transaction_date, created_at) VALUES (
  '1271e8e5-57de-4e03-9c39-773f34d18886',
  '0ad34200-eb35-4996-9ed0-8d3928461d0d',
  'buy',
  'AOA',
  'iShares Core 80/20 Aggressive A',
  '25.0000',
  '78.39',
  'USD',
  1731456000,
  1764408702
);
INSERT INTO investment_transactions (id, investment_id, type, ticker, company_name, quantity, price_per_unit, currency, transaction_date, created_at) VALUES (
  'b8be83f4-b6ea-45db-9ea0-9dccd4276005',
  '0ad34200-eb35-4996-9ed0-8d3928461d0d',
  'buy',
  'AOA',
  'iShares Core 80/20 Aggressive A',
  '30.0000',
  '76.00',
  'USD',
  1736812800,
  1764408750
);
INSERT INTO investment_transactions (id, investment_id, type, ticker, company_name, quantity, price_per_unit, currency, transaction_date, created_at) VALUES (
  '6a6bddc4-5971-45d8-84e6-7886635e07f5',
  '1585845f-c332-430f-b4b3-412507b174ea',
  'buy',
  'PM',
  'Philip Morris International Inc',
  '24.0000',
  '92.55',
  'USD',
  1686528000,
  1764403831
);
INSERT INTO investment_transactions (id, investment_id, type, ticker, company_name, quantity, price_per_unit, currency, transaction_date, created_at) VALUES (
  '700c6614-6b60-4928-87bd-9b40195ae594',
  '1db29419-cac1-41a9-9775-f91368c0fc1d',
  'buy',
  'VOO',
  'Vanguard S&P500 ETF',
  '4.0000',
  '617.91',
  'USD',
  1759968000,
  1764408007
);
INSERT INTO investment_transactions (id, investment_id, type, ticker, company_name, quantity, price_per_unit, currency, transaction_date, created_at) VALUES (
  'fd3e82c3-b14c-458c-8eff-94db9a7a8f7f',
  '1db29419-cac1-41a9-9775-f91368c0fc1d',
  'buy',
  'VOO',
  'Vanguard S&P500 ETF',
  '4.0000',
  '593.33',
  'USD',
  1756252800,
  1764407963
);
INSERT INTO investment_transactions (id, investment_id, type, ticker, company_name, quantity, price_per_unit, currency, transaction_date, created_at) VALUES (
  '171e19b5-8aae-4d7e-825d-ec6783aa958b',
  '1db29419-cac1-41a9-9775-f91368c0fc1d',
  'buy',
  'VOO',
  'Vanguard S&P500 ETF',
  '11.0000',
  '356.00',
  'USD',
  1678665600,
  1764406411
);
INSERT INTO investment_transactions (id, investment_id, type, ticker, company_name, quantity, price_per_unit, currency, transaction_date, created_at) VALUES (
  '007718ed-eb91-4633-ab3d-bb9f88ddd0ac',
  '1db29419-cac1-41a9-9775-f91368c0fc1d',
  'buy',
  'VOO',
  'Vanguard S&P500 ETF',
  '3.0000',
  '450.79',
  'USD',
  1706572800,
  1764406786
);
INSERT INTO investment_transactions (id, investment_id, type, ticker, company_name, quantity, price_per_unit, currency, transaction_date, created_at) VALUES (
  '8536177c-ea55-4ae3-b8e9-6101ca353440',
  '1db29419-cac1-41a9-9775-f91368c0fc1d',
  'buy',
  'VOO',
  'Vanguard S&P500 ETF',
  '4.0000',
  '420.20',
  'USD',
  1690761600,
  1764406679
);
INSERT INTO investment_transactions (id, investment_id, type, ticker, company_name, quantity, price_per_unit, currency, transaction_date, created_at) VALUES (
  '5c08aaf5-3ad5-42a6-8770-3070914190f5',
  '1bebb4e6-bfb7-44cb-a15d-704034625fef',
  'buy',
  'BRK-B',
  'Berkshire Hathaway Inc. New',
  '13.0000',
  '496.62',
  'USD',
  1741305600,
  1764406040
);
INSERT INTO investment_transactions (id, investment_id, type, ticker, company_name, quantity, price_per_unit, currency, transaction_date, created_at) VALUES (
  '1cfab3d3-f5de-4a76-842a-1fb6d485b186',
  '1e17cff6-0e65-407a-bc90-4b4b7e2ca739',
  'buy',
  'BLK',
  'BlackRock, Inc.',
  '2.0000',
  '782.98',
  'USD',
  1706572800,
  1764405190
);
INSERT INTO investment_transactions (id, investment_id, type, ticker, company_name, quantity, price_per_unit, currency, transaction_date, created_at) VALUES (
  'fa2f2a29-3896-421c-80a8-643d9b5bf139',
  '1e17cff6-0e65-407a-bc90-4b4b7e2ca739',
  'buy',
  'BLK',
  'BlackRock, Inc.',
  '2.0000',
  '699.00',
  'USD',
  1691539200,
  1764403918
);
INSERT INTO investment_transactions (id, investment_id, type, ticker, company_name, quantity, price_per_unit, currency, transaction_date, created_at) VALUES (
  'c8b08c1c-8928-4246-96a6-2a7fe5c04aad',
  '042b1b9d-aee7-4c44-b647-2044709c95a2',
  'buy',
  'VYMI',
  'Vanguard International High Div',
  '18.0000',
  '71.35',
  'USD',
  1739232000,
  1764408779
);
INSERT INTO investment_transactions (id, investment_id, type, ticker, company_name, quantity, price_per_unit, currency, transaction_date, created_at) VALUES (
  'bcbcb636-d14c-4413-be43-065e4fb00eec',
  '042b1b9d-aee7-4c44-b647-2044709c95a2',
  'buy',
  'VYMI',
  'Vanguard International High Div',
  '41.0000',
  '72.50',
  'USD',
  1739491200,
  1764408800
);
INSERT INTO investment_transactions (id, investment_id, type, ticker, company_name, quantity, price_per_unit, currency, transaction_date, created_at) VALUES (
  '7e0261a3-c330-4899-843e-0d94e996a077',
  'b2284e5a-b564-4401-a91a-085d50c8c973',
  'buy',
  'IOO',
  'iShares Global 100 ETF',
  '25.0000',
  '89.30',
  'USD',
  1712102400,
  1764408075
);
INSERT INTO investment_transactions (id, investment_id, type, ticker, company_name, quantity, price_per_unit, currency, transaction_date, created_at) VALUES (
  'c0a7ffd0-8aaa-4e3a-8899-ad1428a7688b',
  '1412abe3-d604-4654-8947-00a0d2151010',
  'buy',
  'TSM',
  'Taiwan Semiconductor Manufactur',
  '17.0000',
  '74.66',
  'USD',
  1671753600,
  1764403736
);
INSERT INTO investment_transactions (id, investment_id, type, ticker, company_name, quantity, price_per_unit, currency, transaction_date, created_at) VALUES (
  '9457a8e5-09c3-46c8-9747-5557394fd6a8',
  '425d0ab9-c6f4-4723-a495-f2720a22f80a',
  'buy',
  'IEI',
  'iShares 3-7 Year Treasury Bond ',
  '179.0000',
  '116.29',
  'USD',
  1740096000,
  1764408825
);
INSERT INTO investment_transactions (id, investment_id, type, ticker, company_name, quantity, price_per_unit, currency, transaction_date, created_at) VALUES (
  'eb357419-ac83-4dfe-a026-ae5ed3ca0325',
  '042b1b9d-aee7-4c44-b647-2044709c95a2',
  'buy',
  'VYMI',
  'Vanguard International High Div',
  '44.0000',
  '76.39',
  'USD',
  1746144000,
  1764408977
);
INSERT INTO investment_transactions (id, investment_id, type, ticker, company_name, quantity, price_per_unit, currency, transaction_date, created_at) VALUES (
  'f8d6ebee-1c77-4184-9317-4c5803c667ff',
  '2d14150e-ef10-4175-a682-13a73b74bda3',
  'buy',
  'IEF',
  'iShares 7-10 Year Treasury Bond',
  '147.0000',
  '94.44',
  'USD',
  1749772800,
  1764408998
);
INSERT INTO investment_transactions (id, investment_id, type, ticker, company_name, quantity, price_per_unit, currency, transaction_date, created_at) VALUES (
  '8170764c-c805-4390-bd2d-98e944908d86',
  '6e06e618-c0f1-4e12-b0fa-6decba20a04d',
  'buy',
  'BMW.DE',
  'BAYERISCHE MOTOREN WERKE AG   S',
  '75.0000',
  '84.76',
  'EUR',
  1764374400,
  1764410020
);
INSERT INTO investment_transactions (id, investment_id, type, ticker, company_name, quantity, price_per_unit, currency, transaction_date, created_at) VALUES (
  '4b6aa566-631c-471a-aba1-916267090dda',
  '0fa5801f-b3b0-428a-ae1e-26862df747b0',
  'buy',
  'ENGI.PA',
  'ENGIE',
  '463.0000',
  '17.27',
  'EUR',
  1764374400,
  1764410045
);
INSERT INTO investment_transactions (id, investment_id, type, ticker, company_name, quantity, price_per_unit, currency, transaction_date, created_at) VALUES (
  '68744960-9b2e-4570-b346-d8176c76118d',
  '0d8b8b61-0cae-4cc2-b563-f6996fd80ad8',
  'buy',
  'EBS.VI',
  'Erste Group Bank AG',
  '35.0000',
  '54.45',
  'EUR',
  1764374400,
  1764410091
);
INSERT INTO investment_transactions (id, investment_id, type, ticker, company_name, quantity, price_per_unit, currency, transaction_date, created_at) VALUES (
  '95269719-662d-4054-b022-faeb83a54e09',
  'a207f1be-f21e-440a-8e59-41e753be458f',
  'buy',
  'FLUX.BR',
  'FLUXYS BELGIUM',
  '230.0000',
  '17.35',
  'EUR',
  1764374400,
  1764410131
);
INSERT INTO investment_transactions (id, investment_id, type, ticker, company_name, quantity, price_per_unit, currency, transaction_date, created_at) VALUES (
  '22ce7150-6f39-4bdf-ac3e-e535dbcbf121',
  '75a45bc6-7c8f-48d1-9d61-de0c79acedd0',
  'buy',
  'FORTUM.HE',
  'Fortum Corporation',
  '794.0000',
  '15.56',
  'USD',
  1764374400,
  1764410147
);
INSERT INTO investment_transactions (id, investment_id, type, ticker, company_name, quantity, price_per_unit, currency, transaction_date, created_at) VALUES (
  '7feabde1-b71e-446b-8ba0-b15308c19f74',
  '7480292b-6861-4dc5-a2f8-5458e89ddde4',
  'buy',
  'PSKY',
  'Paramount Skydance Corporation',
  '48.0000',
  '11.04',
  'USD',
  1764374400,
  1764410176
);
INSERT INTO investment_transactions (id, investment_id, type, ticker, company_name, quantity, price_per_unit, currency, transaction_date, created_at) VALUES (
  '6a718a3c-c772-429a-81ee-3faf93202d80',
  '35f8472a-3bf1-4039-81b9-c7032296bd5e',
  'buy',
  'SRG.MI',
  'SNAM',
  '870.0000',
  '4.61',
  'EUR',
  1764374400,
  1764410207
);
INSERT INTO investment_transactions (id, investment_id, type, ticker, company_name, quantity, price_per_unit, currency, transaction_date, created_at) VALUES (
  '649f01b4-8bc5-4bc5-8d7b-6fa088463ead',
  '5d533e8a-68a2-4b63-8ad8-efa0ee124c85',
  'buy',
  'TRN.MI',
  'TERNA',
  '506.0000',
  '7.90',
  'USD',
  1764374400,
  1764410253
);
INSERT INTO investment_transactions (id, investment_id, type, ticker, company_name, quantity, price_per_unit, currency, transaction_date, created_at) VALUES (
  '28233ab5-7ec9-4bcc-b50d-9dd0869661eb',
  'dfe41ecc-62ab-4e85-b5d5-29b66c08fd0f',
  'buy',
  'VOW3.DE',
  'VOLKSWAGEN AG',
  '21.0000',
  '116.77',
  'USD',
  1764374400,
  1764410284
);
INSERT INTO investment_transactions (id, investment_id, type, ticker, company_name, quantity, price_per_unit, currency, transaction_date, created_at) VALUES (
  'feaee453-db85-42b3-86a4-ec1898444151',
  'f4e95743-89ab-4b1d-93cc-a13584890f5c',
  'buy',
  'EUEA.AS',
  'iShares Core EURO STOXX 50 UCIT',
  '29.0000',
  '202.86',
  'EUR',
  1764374400,
  1764410384
);
INSERT INTO investment_transactions (id, investment_id, type, ticker, company_name, quantity, price_per_unit, currency, transaction_date, created_at) VALUES (
  'ac29ef85-0d4f-45a6-9678-37abd3e84ff2',
  '263e050e-6118-40ba-be4c-7cb194a8b974',
  'buy',
  'EUNK.DE',
  'iShares Core MSCI Europe UCITS ETF',
  '25.0000',
  '91.25',
  'EUR',
  1764374400,
  1764410432
);
INSERT INTO investment_transactions (id, investment_id, type, ticker, company_name, quantity, price_per_unit, currency, transaction_date, created_at) VALUES (
  'dbff2b29-d508-4422-aebd-a499aa54b962',
  '48e1472b-63de-475e-b600-ce088cadb747',
  'buy',
  'EUNL.DE',
  'iShares Core MSCI World UCITS ETF',
  '130.0000',
  '86.70',
  'EUR',
  1764374400,
  1764410471
);
INSERT INTO investment_transactions (id, investment_id, type, ticker, company_name, quantity, price_per_unit, currency, transaction_date, created_at) VALUES (
  '553a6265-d228-444a-b733-901f8dfa9313',
  '47ea6139-e6cf-4f27-acad-b48f2539d0f9',
  'buy',
  'SXR8.DE',
  'iShares Core S&P 500 UCITS ETF',
  '34.0000',
  '405.60',
  'EUR',
  1764374400,
  1764410505
);
INSERT INTO investment_transactions (id, investment_id, type, ticker, company_name, quantity, price_per_unit, currency, transaction_date, created_at) VALUES (
  '2f651aef-e3f9-4192-b0f2-33d606eb6ecb',
  '8f62996d-9c94-47ba-9d1f-630624334870',
  'buy',
  'VWCE.DE',
  'Vanguard FTSE All-World U.ETF R',
  '1.0000',
  '101.56',
  'EUR',
  1764374400,
  1764410518
);
INSERT INTO investment_transactions (id, investment_id, type, ticker, company_name, quantity, price_per_unit, currency, transaction_date, created_at) VALUES (
  '1ded5bf6-4c4b-4a5a-a20b-a90adc7775b2',
  '63128f9f-6c27-4d54-94dd-62e5597444a8',
  'buy',
  'GOOG',
  'Alphabet Inc.',
  '20.0000',
  '140.95',
  'USD',
  1647907200,
  1764403545
);
INSERT INTO investment_transactions (id, investment_id, type, ticker, company_name, quantity, price_per_unit, currency, transaction_date, created_at) VALUES (
  'a1b13070-7fc2-444f-83e1-5e9c0d8b7420',
  '63128f9f-6c27-4d54-94dd-62e5597444a8',
  'buy',
  'GOOG',
  'Alphabet Inc.',
  '20.0000',
  '130.40',
  'USD',
  1649808000,
  1764403576
);
INSERT INTO investment_transactions (id, investment_id, type, ticker, company_name, quantity, price_per_unit, currency, transaction_date, created_at) VALUES (
  '73ce4ab7-ed21-4c90-bff8-7a7ba7524051',
  '00d56bfb-da8b-4544-bf17-85e22a4e2aa0',
  'buy',
  'IVV',
  'iShares S&P 500 Index Fund',
  '4.0000',
  '638.50',
  'USD',
  1753833600,
  1764409086
);
INSERT INTO investment_transactions (id, investment_id, type, ticker, company_name, quantity, price_per_unit, currency, transaction_date, created_at) VALUES (
  '7421af01-9b15-4a46-b2b1-b2a8c30859af',
  '00d56bfb-da8b-4544-bf17-85e22a4e2aa0',
  'buy',
  'IVV',
  'iShares S&P 500 Index Fund',
  '4.0000',
  '601.40',
  'USD',
  1749772800,
  1764409028
);
INSERT INTO investment_transactions (id, investment_id, type, ticker, company_name, quantity, price_per_unit, currency, transaction_date, created_at) VALUES (
  'c59ae57c-f0f4-471b-b7e5-2aabaed9866b',
  '00d56bfb-da8b-4544-bf17-85e22a4e2aa0',
  'buy',
  'IVV',
  'iShares S&P 500 Index Fund',
  '4.0000',
  '561.00',
  'USD',
  1741651200,
  1764408881
);
INSERT INTO investment_transactions (id, investment_id, type, ticker, company_name, quantity, price_per_unit, currency, transaction_date, created_at) VALUES (
  'edfb4135-6e13-40c1-9eb7-65bfc550605d',
  '042b1b9d-aee7-4c44-b647-2044709c95a2',
  'buy',
  'VYMI',
  'Vanguard International High Div',
  '36.0000',
  '80.29',
  'USD',
  1751414400,
  1764409046
);
INSERT INTO investment_transactions (id, investment_id, type, ticker, company_name, quantity, price_per_unit, currency, transaction_date, created_at) VALUES (
  'd3b60291-4fa9-413a-8d52-4da9bcf36d81',
  '042b1b9d-aee7-4c44-b647-2044709c95a2',
  'buy',
  'VYMI',
  'Vanguard International High Div',
  '57.0000',
  '72.16',
  'USD',
  1740700800,
  1764408856
);
INSERT INTO investment_transactions (id, investment_id, type, ticker, company_name, quantity, price_per_unit, currency, transaction_date, created_at) VALUES (
  '20bbac61-f3e2-42e9-b657-7592194824d7',
  '042b1b9d-aee7-4c44-b647-2044709c95a2',
  'buy',
  'VYMI',
  'Vanguard International High Div',
  '28.0000',
  '84.74',
  'USD',
  1759968000,
  1764409136
);
INSERT INTO investment_transactions (id, investment_id, type, ticker, company_name, quantity, price_per_unit, currency, transaction_date, created_at) VALUES (
  '07115bfe-c8ff-4d26-b8c7-42223c4d68ba',
  '042b1b9d-aee7-4c44-b647-2044709c95a2',
  'buy',
  'VYMI',
  'Vanguard International High Div',
  '24.0000',
  '83.64',
  'USD',
  1756252800,
  1764409115
);
INSERT INTO investment_transactions (id, investment_id, type, ticker, company_name, quantity, price_per_unit, currency, transaction_date, created_at) VALUES (
  '4ef70b66-4966-45d4-b231-10659155f61f',
  '63128f9f-6c27-4d54-94dd-62e5597444a8',
  'buy',
  'GOOG',
  'Alphabet Inc.',
  '20.0000',
  '54.20',
  'USD',
  1526428800,
  1765206884
);
INSERT INTO investment_transactions (id, investment_id, type, ticker, company_name, quantity, price_per_unit, currency, transaction_date, created_at) VALUES (
  'b78fca0c-0cb8-4a0c-9e66-a912ed2a163d',
  '0ad34200-eb35-4996-9ed0-8d3928461d0d',
  'buy',
  'AOA',
  'iShares Core 80/20 Aggressive A',
  '13.0000',
  '74.90',
  'USD',
  1719532800,
  1765207669
);
INSERT INTO investment_transactions (id, investment_id, type, ticker, company_name, quantity, price_per_unit, currency, transaction_date, created_at) VALUES (
  'fdd55366-c7a8-4863-81c8-61ecba0a298a',
  '00d56bfb-da8b-4544-bf17-85e22a4e2aa0',
  'buy',
  'IVV',
  'iShares Core S&P 500 ETF',
  '3.0000',
  '550.00',
  'USD',
  1719532800,
  1765208427
);
INSERT INTO investment_transactions (id, investment_id, type, ticker, company_name, quantity, price_per_unit, currency, transaction_date, created_at) VALUES (
  '2fb1844a-a041-4b2e-b08f-04b0e0908c35',
  '1bebb4e6-bfb7-44cb-a15d-704034625fef',
  'buy',
  'BRK-B',
  'Berkshire Hathaway Inc. New',
  '10.0000',
  '495.70',
  'USD',
  1765411200,
  1765480723
);

-- Stock Prices
INSERT OR REPLACE INTO stock_prices (id, ticker, original_price, currency, price_date, fetched_at) VALUES (
  '36f95677-fc54-4aa2-b542-4594d82da1c1',
  'IEF',
  '96.47',
  'USD',
  1765223109,
  1765223110
);
INSERT OR REPLACE INTO stock_prices (id, ticker, original_price, currency, price_date, fetched_at) VALUES (
  '32a27597-5991-4090-a5d7-5108e3ec5f4f',
  'PM',
  '147.81',
  'USD',
  1765223109,
  1765223110
);
INSERT OR REPLACE INTO stock_prices (id, ticker, original_price, currency, price_date, fetched_at) VALUES (
  '80c41bb6-2a98-4966-a01f-afdd465e4431',
  'VOO',
  '630.48',
  'USD',
  1765223109,
  1765223111
);
INSERT OR REPLACE INTO stock_prices (id, ticker, original_price, currency, price_date, fetched_at) VALUES (
  'fe7a0e04-d235-4d7f-9248-12a65ecbc7c2',
  'BRK-B',
  '504.34',
  'USD',
  1765223109,
  1765223111
);
INSERT OR REPLACE INTO stock_prices (id, ticker, original_price, currency, price_date, fetched_at) VALUES (
  '9d10a794-9d9a-4b18-bdb2-39a342a02e5e',
  'BLK',
  '1072.16',
  'USD',
  1765223109,
  1765223111
);
INSERT OR REPLACE INTO stock_prices (id, ticker, original_price, currency, price_date, fetched_at) VALUES (
  'f0ab6b75-d9dc-4a97-9ff9-b93c7e703cab',
  'IOO',
  '126.73',
  'USD',
  1765223109,
  1765223111
);
INSERT OR REPLACE INTO stock_prices (id, ticker, original_price, currency, price_date, fetched_at) VALUES (
  'a895375c-27f1-4e3d-9287-373b3ca42d10',
  'GOOG',
  '322.09',
  'USD',
  1765223109,
  1765223111
);
INSERT OR REPLACE INTO stock_prices (id, ticker, original_price, currency, price_date, fetched_at) VALUES (
  'a539b1c4-9d86-4864-b544-a91535b70c92',
  'AOA',
  '90.03',
  'USD',
  1765223109,
  1765223111
);
INSERT OR REPLACE INTO stock_prices (id, ticker, original_price, currency, price_date, fetched_at) VALUES (
  '8d3f41a3-ecb1-4763-9b5d-4b6d291fa433',
  'TTWO',
  '247.88',
  'USD',
  1765223109,
  1765223111
);
INSERT OR REPLACE INTO stock_prices (id, ticker, original_price, currency, price_date, fetched_at) VALUES (
  '7eac34cd-cfbd-4dc2-bc29-4fae64ea1b94',
  'BTI',
  '57.01',
  'USD',
  1765223109,
  1765223111
);
INSERT OR REPLACE INTO stock_prices (id, ticker, original_price, currency, price_date, fetched_at) VALUES (
  'a991d029-22c7-40bb-91a9-96be1ca485ea',
  'NGG',
  '75.41',
  'USD',
  1765223109,
  1765223111
);
INSERT OR REPLACE INTO stock_prices (id, ticker, original_price, currency, price_date, fetched_at) VALUES (
  'ddc41b98-9cbe-4d4d-ba36-92edabb0f6fb',
  'KO',
  '70.00',
  'USD',
  1765223109,
  1765223111
);
INSERT OR REPLACE INTO stock_prices (id, ticker, original_price, currency, price_date, fetched_at) VALUES (
  'b131c280-3dbc-4fc3-ba5c-6075cbd1d130',
  'CEZ.PR',
  '1285.00',
  'CZK',
  1765223109,
  1765223111
);
INSERT OR REPLACE INTO stock_prices (id, ticker, original_price, currency, price_date, fetched_at) VALUES (
  '570c04b9-0f4d-4fb3-b70a-d747be49df36',
  'INTC',
  '41.41',
  'USD',
  1765223109,
  1765223111
);
INSERT OR REPLACE INTO stock_prices (id, ticker, original_price, currency, price_date, fetched_at) VALUES (
  '781c6458-0f1d-42e0-97a7-b022511d49bd',
  'EBS.VI',
  '95.75',
  'USD',
  1765223109,
  1765223111
);
INSERT OR REPLACE INTO stock_prices (id, ticker, original_price, currency, price_date, fetched_at) VALUES (
  '9656d87c-ee4d-4a50-bf01-179f79eef455',
  'IEI',
  '119.42',
  'USD',
  1765223109,
  1765223111
);
INSERT OR REPLACE INTO stock_prices (id, ticker, original_price, currency, price_date, fetched_at) VALUES (
  '7fb94bf7-5364-40ea-9f46-9cacc5af8517',
  'EUNL.DE',
  '111.72',
  'EUR',
  1765223109,
  1765223111
);
INSERT OR REPLACE INTO stock_prices (id, ticker, original_price, currency, price_date, fetched_at) VALUES (
  '9460b708-643f-4fde-9b90-40b4ef014940',
  'ENGI.PA',
  '21.41',
  'EUR',
  1765223109,
  1765223111
);
INSERT OR REPLACE INTO stock_prices (id, ticker, original_price, currency, price_date, fetched_at) VALUES (
  '8d5d318f-cf8e-4fac-aa10-7b7e9a2699eb',
  'EUNK.DE',
  '91.84',
  'EUR',
  1765223109,
  1765223111
);
INSERT OR REPLACE INTO stock_prices (id, ticker, original_price, currency, price_date, fetched_at) VALUES (
  'eec5368f-18ab-4ad3-893b-53b6b862a29f',
  'SXR8.DE',
  '632.28',
  'EUR',
  1765223109,
  1765223111
);
INSERT OR REPLACE INTO stock_prices (id, ticker, original_price, currency, price_date, fetched_at) VALUES (
  '3bc8a6d3-3f25-43d5-a60f-efd9d0f4fd51',
  'PSKY',
  '13.37',
  'USD',
  1765223109,
  1765223111
);
INSERT OR REPLACE INTO stock_prices (id, ticker, original_price, currency, price_date, fetched_at) VALUES (
  '434fdaf9-5bca-482f-a2a6-9198a0e29870',
  'IVV',
  '689.11',
  'USD',
  1765223109,
  1765223111
);
INSERT OR REPLACE INTO stock_prices (id, ticker, original_price, currency, price_date, fetched_at) VALUES (
  '0043c327-5972-4f9f-9eaa-3de200cfa75a',
  'VOW3.DE',
  '106.90',
  'EUR',
  1765223109,
  1765223111
);
INSERT OR REPLACE INTO stock_prices (id, ticker, original_price, currency, price_date, fetched_at) VALUES (
  'a64e0f04-6e63-41e4-8805-8e2e58ff4feb',
  'SRG.MI',
  '5.69',
  'USD',
  1765223109,
  1765223111
);
INSERT OR REPLACE INTO stock_prices (id, ticker, original_price, currency, price_date, fetched_at) VALUES (
  '1693320b-68a1-4906-a145-de7906702c81',
  'FLUX.BR',
  '17.65',
  'EUR',
  1765223109,
  1765223111
);
INSERT OR REPLACE INTO stock_prices (id, ticker, original_price, currency, price_date, fetched_at) VALUES (
  '0260c473-76f6-46d3-a826-cb4a9924e7eb',
  'AAPL',
  '278.78',
  'USD',
  1765223109,
  1765223111
);
INSERT OR REPLACE INTO stock_prices (id, ticker, original_price, currency, price_date, fetched_at) VALUES (
  '3bcd53e6-d26c-4667-899b-f7098ef55c21',
  'TRN.MI',
  '8.98',
  'USD',
  1765223109,
  1765223111
);
INSERT OR REPLACE INTO stock_prices (id, ticker, original_price, currency, price_date, fetched_at) VALUES (
  '88135be6-d387-478e-a009-3fb0da0676e1',
  'MSFT',
  '483.16',
  'USD',
  1765223109,
  1765223111
);
INSERT OR REPLACE INTO stock_prices (id, ticker, original_price, currency, price_date, fetched_at) VALUES (
  'e1c5bceb-341a-46d6-912f-c4a8f625f4ec',
  'VYMI',
  '88.46',
  'USD',
  1765223109,
  1765223111
);
INSERT OR REPLACE INTO stock_prices (id, ticker, original_price, currency, price_date, fetched_at) VALUES (
  '73e90177-fe81-4be1-b640-c1bf7cb56ff9',
  'FORTUM.HE',
  '17.50',
  'USD',
  1765223109,
  1765223111
);
INSERT OR REPLACE INTO stock_prices (id, ticker, original_price, currency, price_date, fetched_at) VALUES (
  'addb1300-a0d6-48fd-8d58-253f86f59842',
  'CRM',
  '260.57',
  'USD',
  1765223109,
  1765223111
);
INSERT OR REPLACE INTO stock_prices (id, ticker, original_price, currency, price_date, fetched_at) VALUES (
  'f37f2f8b-5fcf-4438-ad7e-a07a5f7eb8ff',
  'BMW.DE',
  '96.46',
  'EUR',
  1765223109,
  1765223111
);
INSERT OR REPLACE INTO stock_prices (id, ticker, original_price, currency, price_date, fetched_at) VALUES (
  'f6984107-57a3-48c4-9354-5869e981259e',
  'TSM',
  '294.72',
  'USD',
  1765223109,
  1765223111
);
INSERT OR REPLACE INTO stock_prices (id, ticker, original_price, currency, price_date, fetched_at) VALUES (
  '2cc15e15-a57d-43f0-b032-641d82990ff2',
  'VWCE.DE',
  '145.16',
  'EUR',
  1765223109,
  1765223111
);

-- Stock Price Overrides
INSERT INTO stock_price_overrides (id, ticker, price, currency, updated_at) VALUES (
  '874fea90-402d-4017-88c5-b132f717240b',
  'CSX5.AM',
  '218.35',
  'EUR',
  1765220264
);
INSERT INTO stock_price_overrides (id, ticker, price, currency, updated_at) VALUES (
  '8f4ce434-2545-43e7-8412-a77916021a08',
  'GOOG',
  '313.00',
  'USD',
  1765222491
);
INSERT INTO stock_price_overrides (id, ticker, price, currency, updated_at) VALUES (
  '1c9d3068-50db-4d76-a2f8-1d6ebde2b420',
  'AAPL',
  '276.00',
  'USD',
  1765222554
);
INSERT INTO stock_price_overrides (id, ticker, price, currency, updated_at) VALUES (
  'df3cea86-2b7c-4e97-bfbd-4f5e418c1275',
  'BTC',
  '500000.00',
  'CZK',
  1765316103
);

-- Dividend Data
INSERT OR REPLACE INTO dividend_data (id, ticker, yearly_dividend_sum, currency, last_fetched_at, created_at) VALUES (
  '15746d4a-675b-41e6-a92b-4cf7e2a576f4',
  'KO',
  '2.04',
  'USD',
  1765049510,
  1765049510
);
INSERT OR REPLACE INTO dividend_data (id, ticker, yearly_dividend_sum, currency, last_fetched_at, created_at) VALUES (
  '6f4e7f13-c94f-41b8-a66f-159d62105365',
  'AAPL',
  '1.03',
  'USD',
  1765049513,
  1765049513
);
INSERT OR REPLACE INTO dividend_data (id, ticker, yearly_dividend_sum, currency, last_fetched_at, created_at) VALUES (
  '95092898-ee85-47d0-ac3e-39d616eae9b7',
  'MSFT',
  '4.31',
  'USD',
  1765049515,
  1765049515
);
INSERT OR REPLACE INTO dividend_data (id, ticker, yearly_dividend_sum, currency, last_fetched_at, created_at) VALUES (
  '59287ca6-6d0e-4798-9994-f951d891b72f',
  'TSM',
  '3.68',
  'USD',
  1765049518,
  1765049518
);
INSERT OR REPLACE INTO dividend_data (id, ticker, yearly_dividend_sum, currency, last_fetched_at, created_at) VALUES (
  'dd7db20f-1d57-4665-ac33-84046560063f',
  'INTC',
  '0.00',
  'USD',
  1765049519,
  1765049519
);
INSERT OR REPLACE INTO dividend_data (id, ticker, yearly_dividend_sum, currency, last_fetched_at, created_at) VALUES (
  '1b5d0520-59e0-4ae6-9d4a-db0440dbf610',
  'GOOG',
  '0.82',
  'USD',
  1765052926,
  1765052926
);
INSERT OR REPLACE INTO dividend_data (id, ticker, yearly_dividend_sum, currency, last_fetched_at, created_at) VALUES (
  '37d49188-36af-4d06-8044-1797fa5c4202',
  'IEF',
  '3.61',
  'USD',
  1765052926,
  1765052926
);
INSERT OR REPLACE INTO dividend_data (id, ticker, yearly_dividend_sum, currency, last_fetched_at, created_at) VALUES (
  '8636fa98-fae8-4543-91e1-6912b27885eb',
  'AOA',
  '1.83',
  'USD',
  1765052927,
  1765052927
);
INSERT OR REPLACE INTO dividend_data (id, ticker, yearly_dividend_sum, currency, last_fetched_at, created_at) VALUES (
  '36dc4de4-6fa2-4a88-8368-7c8624abdb86',
  'PM',
  '5.52',
  'USD',
  1765052927,
  1765052927
);
INSERT OR REPLACE INTO dividend_data (id, ticker, yearly_dividend_sum, currency, last_fetched_at, created_at) VALUES (
  '8c023f5e-5b59-4dea-9588-807bbb7e02a9',
  'VOO',
  '7.03',
  'USD',
  1765052927,
  1765052927
);
INSERT OR REPLACE INTO dividend_data (id, ticker, yearly_dividend_sum, currency, last_fetched_at, created_at) VALUES (
  '0ffa082c-84ce-4634-b6b4-019b4f9c3b3f',
  'BRK-B',
  '0.00',
  'USD',
  1765052928,
  1765052928
);
INSERT OR REPLACE INTO dividend_data (id, ticker, yearly_dividend_sum, currency, last_fetched_at, created_at) VALUES (
  '3c4b55ef-c951-4f00-9ce6-4c08a762110e',
  'BLK',
  '20.84',
  'USD',
  1765052928,
  1765052928
);
INSERT OR REPLACE INTO dividend_data (id, ticker, yearly_dividend_sum, currency, last_fetched_at, created_at) VALUES (
  'd905e03f-c92a-4c89-93d8-d74d84c02ff1',
  'IOO',
  '1.14',
  'USD',
  1765052929,
  1765052929
);
INSERT OR REPLACE INTO dividend_data (id, ticker, yearly_dividend_sum, currency, last_fetched_at, created_at) VALUES (
  '4f51341d-4e00-4b80-b232-94d11bf8109b',
  'TTWO',
  '0.00',
  'USD',
  1765052929,
  1765052929
);
INSERT OR REPLACE INTO dividend_data (id, ticker, yearly_dividend_sum, currency, last_fetched_at, created_at) VALUES (
  '79a5418c-b6fa-487a-aba1-c08dc431651e',
  'BTI',
  '2.99',
  'USD',
  1765052929,
  1765052930
);
INSERT OR REPLACE INTO dividend_data (id, ticker, yearly_dividend_sum, currency, last_fetched_at, created_at) VALUES (
  'bc11298e-bb06-4d3d-bf19-b3b81edfed01',
  'NGG',
  '3.12',
  'USD',
  1765052930,
  1765052930
);
INSERT OR REPLACE INTO dividend_data (id, ticker, yearly_dividend_sum, currency, last_fetched_at, created_at) VALUES (
  '0f5c03eb-9097-4112-be34-357801df1aa5',
  'CEZ.PR',
  '0.00',
  'USD',
  1765052930,
  1765052930
);
INSERT OR REPLACE INTO dividend_data (id, ticker, yearly_dividend_sum, currency, last_fetched_at, created_at) VALUES (
  'f73ce830-3624-4be5-a6a4-e68f698a4e5d',
  'VOW3.DE',
  '0.00',
  'USD',
  1765052931,
  1765052931
);
INSERT OR REPLACE INTO dividend_data (id, ticker, yearly_dividend_sum, currency, last_fetched_at, created_at) VALUES (
  'd5f72705-1a1e-4460-ae36-cfb3d0a976fb',
  'SRG.MI',
  '0.00',
  'USD',
  1765052931,
  1765052931
);
INSERT OR REPLACE INTO dividend_data (id, ticker, yearly_dividend_sum, currency, last_fetched_at, created_at) VALUES (
  'bdcf2a4f-843c-4a2d-abf7-e94ced77cb22',
  'FLUX.BR',
  '0.00',
  'USD',
  1765052931,
  1765052931
);
INSERT OR REPLACE INTO dividend_data (id, ticker, yearly_dividend_sum, currency, last_fetched_at, created_at) VALUES (
  '7b74e821-27dc-42a4-b27d-1835d8a31f23',
  'IVV',
  '7.75',
  'USD',
  1765052932,
  1765052932
);
INSERT OR REPLACE INTO dividend_data (id, ticker, yearly_dividend_sum, currency, last_fetched_at, created_at) VALUES (
  '255cf92e-0cff-41b6-96e8-1656f748dab9',
  'TRN.MI',
  '0.00',
  'USD',
  1765052933,
  1765052933
);
INSERT OR REPLACE INTO dividend_data (id, ticker, yearly_dividend_sum, currency, last_fetched_at, created_at) VALUES (
  '1794741a-51a6-4b27-bb3f-3024385162a8',
  'VYMI',
  '3.34',
  'USD',
  1765052933,
  1765052933
);
INSERT OR REPLACE INTO dividend_data (id, ticker, yearly_dividend_sum, currency, last_fetched_at, created_at) VALUES (
  'ac18e2a7-2fab-43c0-9774-27f8f3346beb',
  'FORTUM.HE',
  '0.00',
  'USD',
  1765052933,
  1765052933
);
INSERT OR REPLACE INTO dividend_data (id, ticker, yearly_dividend_sum, currency, last_fetched_at, created_at) VALUES (
  'b7f74141-27cc-430e-b919-50f67b91d1f3',
  'CRM',
  '1.66',
  'USD',
  1765052934,
  1765052934
);
INSERT OR REPLACE INTO dividend_data (id, ticker, yearly_dividend_sum, currency, last_fetched_at, created_at) VALUES (
  '107a95e8-6fac-4b14-9638-b4348fc5a7dd',
  'BMW.DE',
  '0.00',
  'USD',
  1765052934,
  1765052934
);
INSERT OR REPLACE INTO dividend_data (id, ticker, yearly_dividend_sum, currency, last_fetched_at, created_at) VALUES (
  '071018b9-f8c8-450f-a05d-a87d4445caa9',
  'VWCE.DE',
  '0.00',
  'USD',
  1765052935,
  1765052935
);
INSERT OR REPLACE INTO dividend_data (id, ticker, yearly_dividend_sum, currency, last_fetched_at, created_at) VALUES (
  '29cab227-0cf5-4704-b72c-eb5e20788abc',
  'EBS.VI',
  '0.00',
  'USD',
  1765052936,
  1765052936
);
INSERT OR REPLACE INTO dividend_data (id, ticker, yearly_dividend_sum, currency, last_fetched_at, created_at) VALUES (
  '1002fc99-3c30-4034-ab51-16a1c13918ad',
  'IEI',
  '4.11',
  'USD',
  1765052936,
  1765052936
);
INSERT OR REPLACE INTO dividend_data (id, ticker, yearly_dividend_sum, currency, last_fetched_at, created_at) VALUES (
  '761e8e97-468a-4dc8-b6e2-00733a747248',
  'EUNL.DE',
  '0.00',
  'USD',
  1765052936,
  1765052936
);
INSERT OR REPLACE INTO dividend_data (id, ticker, yearly_dividend_sum, currency, last_fetched_at, created_at) VALUES (
  'd50eacfb-eb37-4fa7-a7e4-f09891efa84f',
  'ENGI.PA',
  '0.00',
  'USD',
  1765052937,
  1765052937
);
INSERT OR REPLACE INTO dividend_data (id, ticker, yearly_dividend_sum, currency, last_fetched_at, created_at) VALUES (
  '34eec7f8-f0a6-495b-b71c-214fb8bf16df',
  'EUNK.DE',
  '0.00',
  'USD',
  1765052937,
  1765052937
);
INSERT OR REPLACE INTO dividend_data (id, ticker, yearly_dividend_sum, currency, last_fetched_at, created_at) VALUES (
  'daa05afe-a871-4ce9-83cc-98056a272994',
  'SXR8.DE',
  '0.00',
  'USD',
  1765052938,
  1765052938
);
INSERT OR REPLACE INTO dividend_data (id, ticker, yearly_dividend_sum, currency, last_fetched_at, created_at) VALUES (
  'dd8b14bd-6d8b-4b3c-9038-f81121b7ca3e',
  'PSKY',
  '0.05',
  'USD',
  1765052938,
  1765052938
);

-- Dividend Overrides
INSERT INTO dividend_overrides (id, ticker, yearly_dividend_sum, currency, updated_at) VALUES (
  '9fa88503-039c-48d3-86fa-8a8e194f8d71',
  'BMW.DE',
  '4.30',
  'EUR',
  1765315290
);
INSERT INTO dividend_overrides (id, ticker, yearly_dividend_sum, currency, updated_at) VALUES (
  '9619e544-0555-4c83-bceb-54c107549496',
  'CEZ.PR',
  '47.00',
  'CZK',
  1765315355
);
INSERT INTO dividend_overrides (id, ticker, yearly_dividend_sum, currency, updated_at) VALUES (
  'aba496a5-b4dc-4ed5-8496-3146a3120fc4',
  'ENGI.PA',
  '1.43',
  'EUR',
  1765315419
);
INSERT INTO dividend_overrides (id, ticker, yearly_dividend_sum, currency, updated_at) VALUES (
  '299e7a1a-5652-4c25-8c6a-83a3932956c4',
  'FORTUM.HE',
  '1.00',
  'EUR',
  1765315455
);
INSERT INTO dividend_overrides (id, ticker, yearly_dividend_sum, currency, updated_at) VALUES (
  'b5a5c644-5ba4-44c1-b27b-7c8357e37990',
  'EBS.VI',
  '3.00',
  'EUR',
  1765315700
);
INSERT INTO dividend_overrides (id, ticker, yearly_dividend_sum, currency, updated_at) VALUES (
  '649ed5de-38b4-4238-b1ba-e6c19ca70706',
  'FLUX.BR',
  '1.40',
  'EUR',
  1765315802
);
INSERT INTO dividend_overrides (id, ticker, yearly_dividend_sum, currency, updated_at) VALUES (
  '22541231-8eb2-4fc8-a6b9-60f8d70633b1',
  'SRG.MI',
  '0.28',
  'EUR',
  1765315910
);
INSERT INTO dividend_overrides (id, ticker, yearly_dividend_sum, currency, updated_at) VALUES (
  '701607e1-7a24-4e5c-9943-0c3392cf5d63',
  'TRN.MI',
  '0.40',
  'EUR',
  1765315933
);
INSERT INTO dividend_overrides (id, ticker, yearly_dividend_sum, currency, updated_at) VALUES (
  '3ad0fdc9-2f92-4591-8ddc-41037cdf1401',
  'VOW3.DE',
  '6.30',
  'EUR',
  1765316013
);

-- Crypto Investments
INSERT INTO crypto_investments (id, ticker, coingecko_id, name, quantity, average_price) VALUES (
  'abf536dd-b052-42d4-8364-5dd77d927cda',
  'BTC',
  'bitcoin',
  'Bitcoin',
  '0.35851425',
  '1249317.89'
);

-- Crypto Prices
INSERT OR REPLACE INTO crypto_prices (id, symbol, coingecko_id, price, currency, fetched_at) VALUES (
  'f50f85e3-2f31-4515-9e03-0ac0b6111dc6',
  'BTC',
  'bitcoin',
  '92601.00',
  'USD',
  1765352304
);

-- Crypto Transactions
INSERT INTO crypto_transactions (id, investment_id, type, ticker, name, quantity, price_per_unit, currency, transaction_date, created_at) VALUES (
  '2b9a6909-32e5-4dc2-a874-d0ebefbc028e',
  'abf536dd-b052-42d4-8364-5dd77d927cda',
  'buy',
  'BTC',
  'Bitcoin',
  '0.35851425',
  '60000.00',
  'USD',
  1765152000,
  1765220326
);

-- Entity History
INSERT INTO entity_history (id, entity_type, entity_id, value, recorded_at) VALUES (
  '47000a4d-c081-458c-a1ab-0eaa2211a936',
  'savings',
  'c8f34b25-2507-4014-87c8-fb3b0815de0d',
  '1848872.00',
  1763806758
);
INSERT INTO entity_history (id, entity_type, entity_id, value, recorded_at) VALUES (
  '8727f9ce-9b9d-495a-93b8-2d85c994b1a1',
  'savings',
  'ed231128-d971-4e4f-966d-50f286cce182',
  '767935.00',
  1763806758
);
INSERT INTO entity_history (id, entity_type, entity_id, value, recorded_at) VALUES (
  'cfc291c9-a3fb-4a27-b042-8fa19cf874c3',
  'loan',
  'dea11d72-ebab-451d-a4c5-ea33ff2829db',
  '1842888.00',
  1763806758
);
INSERT INTO entity_history (id, entity_type, entity_id, value, recorded_at) VALUES (
  '367fe951-c08f-4b26-84b1-03d350838f57',
  'loan',
  'aa024be0-f90f-4058-a7db-8b6839a97b5b',
  '9084306.00',
  1763807636
);
INSERT INTO entity_history (id, entity_type, entity_id, value, recorded_at) VALUES (
  'c6cf84ef-83a0-4a7a-8adc-d65b7decf939',
  'bond',
  '082d6018-ed8b-4113-b1ad-6cc0bf854851',
  '400000.00',
  1763807784
);
INSERT INTO entity_history (id, entity_type, entity_id, value, recorded_at) VALUES (
  'e74f5f10-8dc5-4ecd-9745-ae5201797543',
  'savings',
  'c8f34b25-2507-4014-87c8-fb3b0815de0d',
  '1948872.00',
  1764431271
);
INSERT INTO entity_history (id, entity_type, entity_id, value, recorded_at) VALUES (
  'ba457d4b-c97e-4677-80de-8ee9ccdfe68c',
  'savings',
  'c8f34b25-2507-4014-87c8-fb3b0815de0d',
  '1848872.00',
  1764431288
);
INSERT INTO entity_history (id, entity_type, entity_id, value, recorded_at) VALUES (
  '4d9bd4d3-0ac0-4cd4-94b9-71e4027bf5a4',
  'savings',
  'ed231128-d971-4e4f-966d-50f286cce182',
  '67935.00',
  1764431469
);
INSERT INTO entity_history (id, entity_type, entity_id, value, recorded_at) VALUES (
  '3fc5a25b-4b26-4049-b8d7-fd98c47a2a4e',
  'savings',
  'ed231128-d971-4e4f-966d-50f286cce182',
  '767935.00',
  1764431851
);
INSERT INTO entity_history (id, entity_type, entity_id, value, recorded_at) VALUES (
  'cc111805-89b7-4025-b563-0d7c76407947',
  'savings',
  'c8f34b25-2507-4014-87c8-fb3b0815de0d',
  '848872.00',
  1764433890
);
INSERT INTO entity_history (id, entity_type, entity_id, value, recorded_at) VALUES (
  'd53ee065-64ba-4de1-8b2e-4aca102e115f',
  'savings',
  'c8f34b25-2507-4014-87c8-fb3b0815de0d',
  '1848872.00',
  1764433904
);
INSERT INTO entity_history (id, entity_type, entity_id, value, recorded_at) VALUES (
  '7c4f46e4-6f06-402a-911f-525aed3fb922',
  'savings',
  'c8f34b25-2507-4014-87c8-fb3b0815de0d',
  '2848872.00',
  1764434073
);
INSERT INTO entity_history (id, entity_type, entity_id, value, recorded_at) VALUES (
  'a73d2ec7-5871-4071-8d5a-969c693a39a8',
  'savings',
  'c8f34b25-2507-4014-87c8-fb3b0815de0d',
  '1848872.00',
  1764434213
);
INSERT INTO entity_history (id, entity_type, entity_id, value, recorded_at) VALUES (
  '4fe92f6f-bfb6-4722-af9d-fb33a5c8893a',
  'savings',
  '80f92eca-7e57-4657-9408-00bba6786f3d',
  '2000000.00',
  1764491500
);
INSERT INTO entity_history (id, entity_type, entity_id, value, recorded_at) VALUES (
  'c7316ee6-7210-444b-95fb-9dd6938efe63',
  'savings',
  '7984f8c8-e529-4179-ac42-3b6a076e271e',
  '5000000.00',
  1764507385
);
INSERT INTO entity_history (id, entity_type, entity_id, value, recorded_at) VALUES (
  'f995edea-fd4e-40a9-9865-831e92d2286e',
  'savings',
  '314bbe23-1e07-474a-a2dc-c4e8b3408115',
  '100000.00',
  1764528131
);
INSERT INTO entity_history (id, entity_type, entity_id, value, recorded_at) VALUES (
  'd1f3c70a-6f42-472b-822e-886289b5ef0e',
  'savings',
  '1c0e7dd5-4a48-46b2-8c6f-966dcf738dc7',
  '100000.00',
  1764528421
);
INSERT INTO entity_history (id, entity_type, entity_id, value, recorded_at) VALUES (
  '9320145c-75fb-4d8b-852b-badad66a35c1',
  'savings',
  '421c06fd-28d7-4ba5-b94c-ed708346ff88',
  '100000.00',
  1764528678
);
INSERT INTO entity_history (id, entity_type, entity_id, value, recorded_at) VALUES (
  '8edd793a-f79c-465a-ab7c-4caa1bf17f90',
  'savings',
  '3285367c-e420-4c5b-afa2-26dd9683d127',
  '100000.00',
  1764529042
);
INSERT INTO entity_history (id, entity_type, entity_id, value, recorded_at) VALUES (
  '0dfe7bfa-058e-4125-ba78-272a16600602',
  'savings',
  '999d4905-d07f-4a66-915f-b2e40deb81fc',
  '11907.00',
  1764932700
);
INSERT INTO entity_history (id, entity_type, entity_id, value, recorded_at) VALUES (
  'd0d5a7f3-5c4b-4ea3-bbd9-593554c4849a',
  'savings',
  '59b2886b-5e74-40a0-a423-4912146233bf',
  '5950.00',
  1764932759
);
INSERT INTO entity_history (id, entity_type, entity_id, value, recorded_at) VALUES (
  '2bfe0bb3-2651-4a06-a639-e811c358db9e',
  'savings',
  'ed13ad5c-665c-490a-90d6-d682111357c4',
  '15998.00',
  1765194734
);

-- Portfolio Metrics History
INSERT INTO portfolio_metrics_history (id, total_savings, total_loans_principal, total_investments, total_crypto, total_bonds, total_real_estate_personal, total_real_estate_investment, recorded_at) VALUES (
  '2f0c97aa-a153-44fd-bbe4-e0d42290976b',
  '2716807.00',
  '10927194.00',
  '5533334.90',
  '0.00',
  '400000.00',
  '20000000.00',
  '3400000.00',
  1764431271
);
INSERT INTO portfolio_metrics_history (id, total_savings, total_loans_principal, total_investments, total_crypto, total_bonds, total_real_estate_personal, total_real_estate_investment, recorded_at) VALUES (
  'f9e303dd-4287-424c-97fd-d3c88462c1ec',
  '2616807.00',
  '10927194.00',
  '5533334.90',
  '0.00',
  '400000.00',
  '20000000.00',
  '3400000.00',
  1764431289
);
INSERT INTO portfolio_metrics_history (id, total_savings, total_loans_principal, total_investments, total_crypto, total_bonds, total_real_estate_personal, total_real_estate_investment, recorded_at) VALUES (
  '63ec250b-fbba-46e2-a2f0-b525fc048313',
  '1916807.00',
  '10927194.00',
  '5533334.90',
  '0.00',
  '400000.00',
  '20000000.00',
  '3400000.00',
  1764431469
);
INSERT INTO portfolio_metrics_history (id, total_savings, total_loans_principal, total_investments, total_crypto, total_bonds, total_real_estate_personal, total_real_estate_investment, recorded_at) VALUES (
  '0c43017d-06e1-45d6-9b65-c90c687927a3',
  '2616807.00',
  '10927194.00',
  '5533334.90',
  '0.00',
  '400000.00',
  '20000000.00',
  '3400000.00',
  1764431851
);
INSERT INTO portfolio_metrics_history (id, total_savings, total_loans_principal, total_investments, total_crypto, total_bonds, total_real_estate_personal, total_real_estate_investment, recorded_at) VALUES (
  '924c29ea-bbb2-4e2a-bd3f-3a0dcb31208b',
  '1616807.00',
  '10927194.00',
  '6591956.94',
  '0.00',
  '400000.00',
  '20000000.00',
  '3400000.00',
  1764433890
);
INSERT INTO portfolio_metrics_history (id, total_savings, total_loans_principal, total_investments, total_crypto, total_bonds, total_real_estate_personal, total_real_estate_investment, recorded_at) VALUES (
  'fc952da9-969e-4979-8a29-dcf085c9fab1',
  '2616807.00',
  '10927194.00',
  '6591956.94',
  '0.00',
  '400000.00',
  '20000000.00',
  '3400000.00',
  1764433904
);
INSERT INTO portfolio_metrics_history (id, total_savings, total_loans_principal, total_investments, total_crypto, total_bonds, total_real_estate_personal, total_real_estate_investment, recorded_at) VALUES (
  '4df42088-5173-43f7-89dc-77405f977260',
  '3616807.00',
  '10927194.00',
  '6591956.94',
  '0.00',
  '400000.00',
  '20000000.00',
  '3400000.00',
  1764434074
);
INSERT INTO portfolio_metrics_history (id, total_savings, total_loans_principal, total_investments, total_crypto, total_bonds, total_real_estate_personal, total_real_estate_investment, recorded_at) VALUES (
  '19412632-25b4-4d0e-a9a5-7d93843a0c70',
  '2616807.00',
  '10927194.00',
  '6591956.94',
  '0.00',
  '400000.00',
  '20000000.00',
  '3400000.00',
  1764434214
);
INSERT INTO portfolio_metrics_history (id, total_savings, total_loans_principal, total_investments, total_crypto, total_bonds, total_real_estate_personal, total_real_estate_investment, recorded_at) VALUES (
  'e69c6ab5-c7ac-4213-9345-247d00989fb0',
  '2616807.00',
  '10927194.00',
  '6591956.94',
  '0.00',
  '400000.00',
  '20000000.00',
  '3400000.00',
  1764489812
);
INSERT INTO portfolio_metrics_history (id, total_savings, total_loans_principal, total_investments, total_crypto, total_bonds, total_real_estate_personal, total_real_estate_investment, recorded_at) VALUES (
  '56ca42df-555d-4a51-b1a9-7af63acef70b',
  '4616807.00',
  '10927194.00',
  '6591956.94',
  '0.00',
  '400000.00',
  '20000000.00',
  '3400000.00',
  1764491501
);
INSERT INTO portfolio_metrics_history (id, total_savings, total_loans_principal, total_investments, total_crypto, total_bonds, total_real_estate_personal, total_real_estate_investment, recorded_at) VALUES (
  '92aeec13-296e-4646-98db-d66fed6c0713',
  '2616807.00',
  '10927194.00',
  '6591956.94',
  '0.00',
  '400000.00',
  '20000000.00',
  '3400000.00',
  1764492106
);
INSERT INTO portfolio_metrics_history (id, total_savings, total_loans_principal, total_investments, total_crypto, total_bonds, total_real_estate_personal, total_real_estate_investment, recorded_at) VALUES (
  '17c8d282-30b2-4ef7-9e4c-79228250cd51',
  '2616807.00',
  '10927194.00',
  '6591956.94',
  '0.00',
  '400000.00',
  '20000000.00',
  '3400000.00',
  1764506619
);
INSERT INTO portfolio_metrics_history (id, total_savings, total_loans_principal, total_investments, total_crypto, total_bonds, total_real_estate_personal, total_real_estate_investment, recorded_at) VALUES (
  'be72c357-6842-41c3-a05f-1687c4196387',
  '2616807.00',
  '10927194.00',
  '6591956.94',
  '0.00',
  '5400000.00',
  '20000000.00',
  '3400000.00',
  1764506640
);
INSERT INTO portfolio_metrics_history (id, total_savings, total_loans_principal, total_investments, total_crypto, total_bonds, total_real_estate_personal, total_real_estate_investment, recorded_at) VALUES (
  'faa71f18-ed36-4765-878f-1ce64de00fe8',
  '2616807.00',
  '10927194.00',
  '6591956.94',
  '0.00',
  '400000.00',
  '20000000.00',
  '3400000.00',
  1764506649
);
INSERT INTO portfolio_metrics_history (id, total_savings, total_loans_principal, total_investments, total_crypto, total_bonds, total_real_estate_personal, total_real_estate_investment, recorded_at) VALUES (
  '7e408835-e553-46c3-9554-13187cc58f16',
  '2616807.00',
  '10927194.00',
  '6591956.94',
  '0.00',
  '400000.00',
  '20000000.00',
  '3400000.00',
  1764506844
);
INSERT INTO portfolio_metrics_history (id, total_savings, total_loans_principal, total_investments, total_crypto, total_bonds, total_real_estate_personal, total_real_estate_investment, recorded_at) VALUES (
  '8e844118-43e1-4eb4-9d9f-812d74db9be5',
  '2616807.00',
  '10927194.00',
  '6591956.94',
  '0.00',
  '400000.00',
  '20000000.00',
  '3400000.00',
  1764507107
);
INSERT INTO portfolio_metrics_history (id, total_savings, total_loans_principal, total_investments, total_crypto, total_bonds, total_real_estate_personal, total_real_estate_investment, recorded_at) VALUES (
  'fd1b166f-aab6-4c76-8672-132a43390ab3',
  '7616807.00',
  '10927194.00',
  '6591956.94',
  '0.00',
  '400000.00',
  '20000000.00',
  '3400000.00',
  1764507386
);
INSERT INTO portfolio_metrics_history (id, total_savings, total_loans_principal, total_investments, total_crypto, total_bonds, total_real_estate_personal, total_real_estate_investment, recorded_at) VALUES (
  '9f47caa5-5fb9-45b1-9576-5b7eb62216c7',
  '2616807.00',
  '10927194.00',
  '6591956.94',
  '0.00',
  '400000.00',
  '20000000.00',
  '3400000.00',
  1764507392
);
INSERT INTO portfolio_metrics_history (id, total_savings, total_loans_principal, total_investments, total_crypto, total_bonds, total_real_estate_personal, total_real_estate_investment, recorded_at) VALUES (
  '07242236-9ca2-47db-8701-73adf399162b',
  '2616807.00',
  '10927194.00',
  '6591956.94',
  '0.00',
  '400000.00',
  '20000000.00',
  '3400000.00',
  1764507682
);
INSERT INTO portfolio_metrics_history (id, total_savings, total_loans_principal, total_investments, total_crypto, total_bonds, total_real_estate_personal, total_real_estate_investment, recorded_at) VALUES (
  '99015382-7d89-4bf1-84f9-d8ba438a6b38',
  '2616807.00',
  '10927194.00',
  '6591956.94',
  '0.00',
  '400000.00',
  '20000000.00',
  '3400000.00',
  1764509827
);
INSERT INTO portfolio_metrics_history (id, total_savings, total_loans_principal, total_investments, total_crypto, total_bonds, total_real_estate_personal, total_real_estate_investment, recorded_at) VALUES (
  'dc0358ad-d55a-4dfc-8542-2c98a9bb71fc',
  '2616807.00',
  '10927194.00',
  '6591956.94',
  '0.00',
  '400000.00',
  '20000000.00',
  '3400000.00',
  1764509857
);
INSERT INTO portfolio_metrics_history (id, total_savings, total_loans_principal, total_investments, total_crypto, total_bonds, total_real_estate_personal, total_real_estate_investment, recorded_at) VALUES (
  'f0d9f5f5-0030-4857-8710-1f4f8ff91a9a',
  '2616807.00',
  '10927194.00',
  '6591954.70',
  '0.00',
  '400000.00',
  '20000000.00',
  '3400000.00',
  1764528658
);
INSERT INTO portfolio_metrics_history (id, total_savings, total_loans_principal, total_investments, total_crypto, total_bonds, total_real_estate_personal, total_real_estate_investment, recorded_at) VALUES (
  'd7d3d2bb-42a5-47ec-b83e-6a5671bee785',
  '4707158.03',
  '10927194.00',
  '6591954.70',
  '0.00',
  '400000.00',
  '20000000.00',
  '3400000.00',
  1764528679
);
INSERT INTO portfolio_metrics_history (id, total_savings, total_loans_principal, total_investments, total_crypto, total_bonds, total_real_estate_personal, total_real_estate_investment, recorded_at) VALUES (
  'ccdb3923-0257-4172-8fab-06cdbef13b97',
  '2616807.00',
  '10927194.00',
  '6591954.70',
  '0.00',
  '400000.00',
  '20000000.00',
  '3400000.00',
  1764529011
);
INSERT INTO portfolio_metrics_history (id, total_savings, total_loans_principal, total_investments, total_crypto, total_bonds, total_real_estate_personal, total_real_estate_investment, recorded_at) VALUES (
  'a7f4ab37-1c5e-4b00-870f-a1dbe8fe71a3',
  '4707158.03',
  '10927194.00',
  '6591954.70',
  '0.00',
  '400000.00',
  '20000000.00',
  '3400000.00',
  1764529043
);
INSERT INTO portfolio_metrics_history (id, total_savings, total_loans_principal, total_investments, total_crypto, total_bonds, total_real_estate_personal, total_real_estate_investment, recorded_at) VALUES (
  '93c19e08-b2f7-4ff2-aab7-25790467c37d',
  '2616807.00',
  '10927194.00',
  '6591954.70',
  '0.00',
  '400000.00',
  '20000000.00',
  '3400000.00',
  1764529199
);
INSERT INTO portfolio_metrics_history (id, total_savings, total_loans_principal, total_investments, total_crypto, total_bonds, total_real_estate_personal, total_real_estate_investment, recorded_at) VALUES (
  '8a4344a1-eeac-48dc-8057-913c451fb6fb',
  '2616807.00',
  '10927194.00',
  '6591954.70',
  '0.00',
  '400000.00',
  '20000000.00',
  '3400000.00',
  1764530207
);
INSERT INTO portfolio_metrics_history (id, total_savings, total_loans_principal, total_investments, total_crypto, total_bonds, total_real_estate_personal, total_real_estate_investment, recorded_at) VALUES (
  'd38837d8-a132-438a-a9b8-a2b17ccfdfc5',
  '2616807.00',
  '13017545.03',
  '6591954.70',
  '0.00',
  '400000.00',
  '20000000.00',
  '3400000.00',
  1764530261
);
INSERT INTO portfolio_metrics_history (id, total_savings, total_loans_principal, total_investments, total_crypto, total_bonds, total_real_estate_personal, total_real_estate_investment, recorded_at) VALUES (
  '2bfa8228-e846-45e9-b903-455382811991',
  '2616807.00',
  '13017545.03',
  '6591954.70',
  '0.00',
  '400000.00',
  '20000000.00',
  '3400000.00',
  1764530273
);
INSERT INTO portfolio_metrics_history (id, total_savings, total_loans_principal, total_investments, total_crypto, total_bonds, total_real_estate_personal, total_real_estate_investment, recorded_at) VALUES (
  '2070a543-de5e-43e0-b0d8-522d0e1f01f5',
  '2616807.00',
  '10927194.00',
  '6591954.70',
  '0.00',
  '400000.00',
  '20000000.00',
  '3400000.00',
  1764530304
);
INSERT INTO portfolio_metrics_history (id, total_savings, total_loans_principal, total_investments, total_crypto, total_bonds, total_real_estate_personal, total_real_estate_investment, recorded_at) VALUES (
  'f48ac971-80df-43b7-865b-7467b4bc3a36',
  '2616807.00',
  '13017545.03',
  '6591954.70',
  '0.00',
  '400000.00',
  '20000000.00',
  '3400000.00',
  1764570573
);
INSERT INTO portfolio_metrics_history (id, total_savings, total_loans_principal, total_investments, total_crypto, total_bonds, total_real_estate_personal, total_real_estate_investment, recorded_at) VALUES (
  '0e1b97bf-64bf-449e-b3a2-c96f55d50861',
  '2616807.00',
  '13017545.03',
  '6591954.70',
  '0.00',
  '400000.00',
  '20000000.00',
  '3400000.00',
  1764570612
);
INSERT INTO portfolio_metrics_history (id, total_savings, total_loans_principal, total_investments, total_crypto, total_bonds, total_real_estate_personal, total_real_estate_investment, recorded_at) VALUES (
  'c6a809a4-adac-41a8-b2be-0d800312c142',
  '2616807.00',
  '10927194.00',
  '6591954.70',
  '0.00',
  '400000.00',
  '20000000.00',
  '3400000.00',
  1764570971
);
INSERT INTO portfolio_metrics_history (id, total_savings, total_loans_principal, total_investments, total_crypto, total_bonds, total_real_estate_personal, total_real_estate_investment, recorded_at) VALUES (
  '59dc6967-6675-46f1-b0ed-3e2a45868239',
  '2548872.00',
  '10927194.00',
  '6545746.79',
  '0.00',
  '400000.00',
  '20000000.00',
  '3400000.00',
  1764932582
);
INSERT INTO portfolio_metrics_history (id, total_savings, total_loans_principal, total_investments, total_crypto, total_bonds, total_real_estate_personal, total_real_estate_investment, recorded_at) VALUES (
  '989d2969-d9a5-40e0-a1e4-37759036332c',
  '2548872.00',
  '10927194.00',
  '6545746.79',
  '0.00',
  '400000.00',
  '20000000.00',
  '3400000.00',
  1764932625
);
INSERT INTO portfolio_metrics_history (id, total_savings, total_loans_principal, total_investments, total_crypto, total_bonds, total_real_estate_personal, total_real_estate_investment, recorded_at) VALUES (
  'fd56246f-d6e2-4840-b996-36dd8283a768',
  '2795432.43',
  '10927194.00',
  '6545746.79',
  '0.00',
  '400000.00',
  '20000000.00',
  '3400000.00',
  1764932701
);
INSERT INTO portfolio_metrics_history (id, total_savings, total_loans_principal, total_investments, total_crypto, total_bonds, total_real_estate_personal, total_real_estate_investment, recorded_at) VALUES (
  '4aebbd7f-6009-4959-b488-7bdf509eb118',
  '2939166.58',
  '10927194.00',
  '6545746.79',
  '0.00',
  '400000.00',
  '20000000.00',
  '3400000.00',
  1764932759
);
INSERT INTO portfolio_metrics_history (id, total_savings, total_loans_principal, total_investments, total_crypto, total_bonds, total_real_estate_personal, total_real_estate_investment, recorded_at) VALUES (
  '62d24cb2-3132-4abe-8d60-97024c60ebde',
  '2943699.58',
  '10927194.00',
  '6545746.79',
  '0.00',
  '400000.00',
  '20000000.00',
  '3400000.00',
  1764932837
);
INSERT INTO portfolio_metrics_history (id, total_savings, total_loans_principal, total_investments, total_crypto, total_bonds, total_real_estate_personal, total_real_estate_investment, recorded_at) VALUES (
  '5697aa78-46fe-4d17-83ac-32461ef25a5b',
  '2943699.58',
  '10922465.00',
  '6545746.79',
  '0.00',
  '400000.00',
  '20000000.00',
  '3400000.00',
  1764932883
);
INSERT INTO portfolio_metrics_history (id, total_savings, total_loans_principal, total_investments, total_crypto, total_bonds, total_real_estate_personal, total_real_estate_investment, recorded_at) VALUES (
  '5995c7a9-3383-4fa6-abf8-311bc4ffcf66',
  '2943699.58',
  '10901267.00',
  '6545746.79',
  '0.00',
  '400000.00',
  '20000000.00',
  '3400000.00',
  1764932898
);
INSERT INTO portfolio_metrics_history (id, total_savings, total_loans_principal, total_investments, total_crypto, total_bonds, total_real_estate_personal, total_real_estate_investment, recorded_at) VALUES (
  '79edf6ac-6f2d-4f94-9b39-ac784395dd11',
  '2943699.58',
  '10901267.00',
  '6545746.79',
  '0.00',
  '400000.00',
  '20000000.00',
  '3400000.00',
  1764932917
);
INSERT INTO portfolio_metrics_history (id, total_savings, total_loans_principal, total_investments, total_crypto, total_bonds, total_real_estate_personal, total_real_estate_investment, recorded_at) VALUES (
  'bbf20872-0935-40eb-a8c8-12a023ea284d',
  '2960999.49',
  '10901267.00',
  '6576832.06',
  '0.00',
  '400000.00',
  '20000000.00',
  '3400000.00',
  1765194735
);
INSERT INTO portfolio_metrics_history (id, total_savings, total_loans_principal, total_investments, total_crypto, total_bonds, total_real_estate_personal, total_real_estate_investment, recorded_at) VALUES (
  '8366d9ec-4ba4-4643-9393-063534feb3d9',
  '2962253.86',
  '10901267.00',
  '6805970.93',
  '0.00',
  '400000.00',
  '20000000.00',
  '3400000.00',
  1765362768
);
INSERT INTO portfolio_metrics_history (id, total_savings, total_loans_principal, total_investments, total_crypto, total_bonds, total_real_estate_personal, total_real_estate_investment, recorded_at) VALUES (
  'ab8e2672-d0da-4fc3-b1ad-4664ad3e5f57',
  '2858906.43',
  '10901267.00',
  '6862149.37',
  '0.00',
  '400000.00',
  '20000000.00',
  '3400000.00',
  1765481162
);
