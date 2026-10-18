-- Initial Responsible Offices and Categories. Coordinators edit these in the app afterwards.
-- Sources: docs/research/civic-reporting-platforms.md (Citizen's Charter 2022, RA 9968, DPWH, LGC s.17).

insert into public.responsible_offices
  (short_name, name_en, name_fil, scope, channel, letter_addressee, letter_attention, email, phone, address)
values
  (
    'CEO',
    'City Engineer''s Office',
    'Tanggapan ng Inhinyero ng Lungsod',
    'citywide',
    'Request letter addressed to the City Mayor, filed at the Office of the Mayor (Citizen''s Charter: road clearing, de-clogging, lighting repair).',
    E'The Honorable City Mayor\nCity Government of Cabanatuan\nCity Hall, Cabanatuan City, Nueva Ecija',
    'City Engineer''s Office (Construction & Maintenance / Electrical Division)',
    'cabanatuan.lgu@gmail.com',
    '0919-081-3694',
    'City Hall, Cabanatuan City'
  ),
  (
    'CENRO',
    'City Environment and Natural Resources Office',
    'Tanggapan ng Kapaligiran at Likas na Yaman ng Lungsod',
    'citywide',
    'Complaint letter addressed to the City Mayor (Citizen''s Charter: CCENRO complaints are lodged through the Office of the City Mayor).',
    E'The Honorable City Mayor\nCity Government of Cabanatuan\nCity Hall, Cabanatuan City, Nueva Ecija',
    'City ENRO, Solid Waste Management Division',
    'cabanatuan.lgu@gmail.com',
    '0919-081-4509',
    'City Hall, Cabanatuan City'
  ),
  (
    'CELCOR',
    'Cabanatuan Electric Corporation',
    'Cabanatuan Electric Corporation',
    'citywide',
    'Letter to CELCOR customer service (franchise holder for electric distribution in the city, RA 9968).',
    E'Cabanatuan Electric Corporation (CELCOR)\nMaharlika Highway, Brgy. Bitas\nCabanatuan City, Nueva Ecija',
    'Engineering / Line Maintenance',
    null,
    null,
    'Maharlika Highway, Brgy. Bitas, Cabanatuan City (verify)'
  ),
  (
    'DPWH-NE2',
    'DPWH Nueva Ecija 2nd District Engineering Office',
    'DPWH Nueva Ecija 2nd District Engineering Office',
    'citywide',
    'Letter to the District Engineer (national roads and bridges).',
    E'The District Engineer\nDPWH Nueva Ecija 2nd District Engineering Office\nBrgy. San Isidro, Cabanatuan City, Nueva Ecija',
    null,
    null,
    '(044) 311-8476',
    'Brgy. San Isidro, Cabanatuan City'
  ),
  (
    'BARANGAY',
    'Barangay Hall',
    'Barangay Hall',
    'per_barangay',
    'Letter to the Punong Barangay of the Report''s barangay (barangay roads, biodegradable waste collection).',
    E'The Punong Barangay\nBarangay {barangay}\nCabanatuan City, Nueva Ecija',
    null,
    null,
    null,
    null
  );

insert into public.categories
  (slug, name_en, name_fil, description_en, description_fil, icon, urgent_notice_en, urgent_notice_fil, default_office_id, sort_order)
values
  (
    'roads-potholes',
    'Roads & Potholes',
    'Kalsada at Lubak',
    'Potholes, broken pavement, road obstructions.',
    'Lubak, sirang kalsada, harang sa daan.',
    'construction',
    null, null,
    (select id from public.responsible_offices where short_name = 'CEO'),
    10
  ),
  (
    'poles-wires',
    'Poles & Wires',
    'Poste at Kable',
    'Leaning or misaligned poles, sagging or tangled wires.',
    'Nakatagilid o hindi tuwid na poste, nakalaylay o gusot na kable.',
    'utility-pole',
    'Live, sparking or fallen wire? Do not wait for this report. Stay away and call CDRRMO at 0908-881-1010 or CELCOR right now.',
    'May kuryente, nagliliyab o nahulog na kable? Huwag nang hintayin ang sumbong na ito. Lumayo at tumawag agad sa CDRRMO (0908-881-1010) o CELCOR.',
    (select id from public.responsible_offices where short_name = 'CELCOR'),
    20
  ),
  (
    'streetlights',
    'Streetlights',
    'Ilaw sa Kalye',
    'Streetlights that are off, flickering, or damaged.',
    'Ilaw sa kalye na patay, patay-sindi, o sira.',
    'lightbulb',
    null, null,
    (select id from public.responsible_offices where short_name = 'CEO'),
    30
  ),
  (
    'drainage-flooding',
    'Drainage & Flooding',
    'Kanal at Baha',
    'Clogged canals, open manholes, recurring floods.',
    'Barado na kanal, bukas na manhole, madalas na pagbaha.',
    'waves',
    'Flooding with people in danger? Call CDRRMO at 0908-881-1010 now.',
    'May baha at may taong nanganganib? Tumawag agad sa CDRRMO (0908-881-1010).',
    (select id from public.responsible_offices where short_name = 'CEO'),
    40
  ),
  (
    'garbage',
    'Garbage',
    'Basura',
    'Uncollected garbage, illegal dumping, open burning.',
    'Hindi nakolektang basura, iligal na tapunan, pagsusunog ng basura.',
    'trash-2',
    null, null,
    (select id from public.responsible_offices where short_name = 'BARANGAY'),
    50
  );

insert into public.category_questions (category_id, prompt_en, prompt_fil, kind, choices, required, sort_order)
values
  (
    (select id from public.categories where slug = 'roads-potholes'),
    'How big is it?', 'Gaano kalaki?', 'choice',
    '[{"value":"small","label_en":"Smaller than a plate","label_fil":"Mas maliit sa plato"},
      {"value":"medium","label_en":"About a tire","label_fil":"Kasinlaki ng gulong"},
      {"value":"large","label_en":"Bigger than a tire","label_fil":"Mas malaki sa gulong"}]'::jsonb,
    true, 10
  ),
  (
    (select id from public.categories where slug = 'roads-potholes'),
    'Is it on a national highway (e.g. Maharlika Highway)?', 'Nasa national highway ba (hal. Maharlika Highway)?', 'choice',
    '[{"value":"yes","label_en":"Yes","label_fil":"Oo"},
      {"value":"no","label_en":"No","label_fil":"Hindi"},
      {"value":"unsure","label_en":"Not sure","label_fil":"Hindi sigurado"}]'::jsonb,
    false, 20
  ),
  (
    (select id from public.categories where slug = 'poles-wires'),
    'What kind of pole?', 'Anong klaseng poste?', 'choice',
    '[{"value":"electric","label_en":"Electric (CELCOR)","label_fil":"Kuryente (CELCOR)"},
      {"value":"telecom","label_en":"Telecom / internet / cable TV","label_fil":"Telepono / internet / cable TV"},
      {"value":"unsure","label_en":"Not sure","label_fil":"Hindi sigurado"}]'::jsonb,
    true, 10
  ),
  (
    (select id from public.categories where slug = 'poles-wires'),
    'Are wires hanging low or dangling?', 'May nakalaylay o mababang kable ba?', 'yes_no',
    '[]'::jsonb, true, 20
  ),
  (
    (select id from public.categories where slug = 'poles-wires'),
    'Pole number, if visible', 'Numero ng poste, kung makikita', 'text',
    '[]'::jsonb, false, 30
  ),
  (
    (select id from public.categories where slug = 'streetlights'),
    'What is wrong with the light?', 'Ano ang problema sa ilaw?', 'choice',
    '[{"value":"off","label_en":"Off at night","label_fil":"Patay sa gabi"},
      {"value":"flickering","label_en":"Flickering","label_fil":"Patay-sindi"},
      {"value":"on_daytime","label_en":"On during the day","label_fil":"Nakabukas sa araw"},
      {"value":"damaged","label_en":"Damaged or hanging","label_fil":"Sira o nakabitin"}]'::jsonb,
    true, 10
  ),
  (
    (select id from public.categories where slug = 'drainage-flooding'),
    'What is the problem?', 'Ano ang problema?', 'choice',
    '[{"value":"clogged","label_en":"Clogged canal","label_fil":"Barado na kanal"},
      {"value":"open_manhole","label_en":"Open or broken manhole","label_fil":"Bukas o sirang manhole"},
      {"value":"flooding","label_en":"Floods after rain","label_fil":"Bumabaha pag umuulan"}]'::jsonb,
    true, 10
  ),
  (
    (select id from public.categories where slug = 'garbage'),
    'What is the problem?', 'Ano ang problema?', 'choice',
    '[{"value":"uncollected","label_en":"Not collected","label_fil":"Hindi nakolekta"},
      {"value":"dumping","label_en":"Illegal dumping","label_fil":"Iligal na tapunan"},
      {"value":"burning","label_en":"Open burning","label_fil":"Pagsusunog ng basura"}]'::jsonb,
    true, 10
  ),
  (
    (select id from public.categories where slug = 'garbage'),
    'How many days has it been there?', 'Ilang araw na itong nandiyan?', 'choice',
    '[{"value":"1-2","label_en":"1–2 days","label_fil":"1–2 araw"},
      {"value":"3-7","label_en":"3–7 days","label_fil":"3–7 araw"},
      {"value":"7+","label_en":"More than a week","label_fil":"Higit isang linggo"}]'::jsonb,
    false, 20
  );
