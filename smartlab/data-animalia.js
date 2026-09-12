/* ============================================================
   ANIMAL KINGDOM — taxonomic data core
   NCERT Class XI, Unit 2, Chapter 4. Every character and every
   example genus below is the one the syllabus actually names.
   Shared by all Animal Kingdom labs.
   ============================================================ */
window.ANIMALIA = (function () {
  'use strict';

  /* Characters used by the classification key and the comparison matrix.
     `order` is the sequence in which a real dichotomous key applies them. */
  const CHARACTERS = [
    { key: 'organisation', label: 'Level of organisation', short: 'Organisation',
      values: ['cellular', 'tissue', 'organ', 'organ-system'],
      labels: { cellular: 'Cellular', tissue: 'Tissue', organ: 'Organ', 'organ-system': 'Organ-system' } },
    { key: 'symmetry', label: 'Body symmetry', short: 'Symmetry',
      values: ['asymmetrical', 'radial', 'bilateral'],
      labels: { asymmetrical: 'Asymmetrical', radial: 'Radial', bilateral: 'Bilateral' } },
    { key: 'layers', label: 'Germ layers', short: 'Germ layers',
      values: ['none', 'diploblastic', 'triploblastic'],
      labels: { none: 'None', diploblastic: 'Diploblastic', triploblastic: 'Triploblastic' } },
    { key: 'coelom', label: 'Body cavity', short: 'Coelom',
      values: ['none', 'acoelomate', 'pseudocoelomate', 'coelomate'],
      labels: { none: 'None', acoelomate: 'Acoelomate', pseudocoelomate: 'Pseudocoelomate', coelomate: 'Coelomate' } },
    { key: 'segmented', label: 'Segmentation (metamerism)', short: 'Segmented',
      values: [false, true], labels: { false: 'Absent', true: 'Present' } },
    { key: 'notochord', label: 'Notochord', short: 'Notochord',
      values: [false, true], labels: { false: 'Absent', true: 'Present' } }
  ];

  /* ---------------- the eleven phyla ---------------- */
  const PHYLA = [
    {
      id: 'porifera', name: 'Porifera', common: 'Sponges', hue: '#E8A33D',
      organisation: 'cellular', symmetry: 'asymmetrical', layers: 'none',
      coelom: 'none', segmented: false, notochord: false,
      habitat: 'Mostly marine, a few freshwater', sexes: 'Hermaphrodite (monoecious)',
      fertilisation: 'Internal', development: 'Indirect, larval stage',
      digestion: 'Intracellular', circulatory: 'Absent', respiration: 'Body surface (diffusion)',
      excretion: 'Body surface (diffusion)', nervous: 'Absent', skeleton: 'Spicules or spongin fibres',
      unique: ['Water transport / canal system', 'Choanocytes (collar cells) line the spongocoel',
               'Water enters by ostia, leaves by the osculum', 'Great powers of regeneration'],
      examples: [
        { g: 'Sycon', n: 'Scypha' }, { g: 'Spongilla', n: 'freshwater sponge' },
        { g: 'Euplectella', n: "Venus' flower basket" }
      ],
      shape: 'vase'
    },
    {
      id: 'coelenterata', name: 'Coelenterata', alt: 'Cnidaria', common: 'Cnidarians', hue: '#5AA9FF',
      organisation: 'tissue', symmetry: 'radial', layers: 'diploblastic',
      coelom: 'none', segmented: false, notochord: false,
      habitat: 'Aquatic, mostly marine, sessile or free-swimming',
      sexes: 'Mostly hermaphrodite or dioecious by species',
      fertilisation: 'External', development: 'Indirect (planula larva) in many',
      digestion: 'Extracellular and intracellular, in the gastrovascular cavity',
      circulatory: 'Absent', respiration: 'Body surface', excretion: 'Body surface',
      nervous: 'Diffuse nerve net', skeleton: 'Calcium carbonate in corals',
      unique: ['Cnidoblasts bearing nematocysts — for anchorage, defence and capturing prey',
               'Gastrovascular cavity with a single opening (hypostome)',
               'Two body forms: polyp and medusa', 'Metagenesis — alternation of the two forms'],
      examples: [
        { g: 'Physalia', n: 'Portuguese man-of-war' }, { g: 'Adamsia', n: 'sea anemone' },
        { g: 'Pennatula', n: 'sea pen' }, { g: 'Gorgonia', n: 'sea fan' },
        { g: 'Meandrina', n: 'brain coral' }, { g: 'Hydra', n: '' }, { g: 'Aurelia', n: 'jelly fish' }
      ],
      shape: 'medusa'
    },
    {
      id: 'ctenophora', name: 'Ctenophora', common: 'Comb jellies / sea walnuts', hue: '#8B7BE8',
      organisation: 'tissue', symmetry: 'radial', layers: 'diploblastic',
      coelom: 'none', segmented: false, notochord: false,
      habitat: 'Exclusively marine', sexes: 'Hermaphrodite',
      fertilisation: 'External', development: 'Indirect',
      digestion: 'Extracellular and intracellular', circulatory: 'Absent',
      respiration: 'Body surface', excretion: 'Body surface', nervous: 'Nerve net',
      skeleton: 'Absent',
      unique: ['Eight external rows of ciliated comb plates, used for locomotion',
               'Bioluminescence is well marked', 'Only sexual reproduction — no asexual reproduction',
               'Colloblasts (adhesive cells) capture prey, not nematocysts'],
      examples: [{ g: 'Pleurobrachia', n: '' }, { g: 'Ctenoplana', n: '' }],
      shape: 'ctenophore'
    },
    {
      id: 'platyhelminthes', name: 'Platyhelminthes', common: 'Flatworms', hue: '#E8685B',
      organisation: 'organ', symmetry: 'bilateral', layers: 'triploblastic',
      coelom: 'acoelomate', segmented: false, notochord: false,
      habitat: 'Mostly endoparasites in animals including humans',
      sexes: 'Hermaphrodite', fertilisation: 'Internal', development: 'Indirect, many larval stages',
      digestion: 'Incomplete gut (single opening) or absent in tapeworms',
      circulatory: 'Absent', respiration: 'Body surface',
      excretion: 'Flame cells (protonephridia) — excretion and osmoregulation',
      nervous: 'Ladder-like, with a brain and longitudinal nerve cords', skeleton: 'Absent',
      unique: ['Dorso-ventrally flattened body — hence flatworms',
               'Hooks and suckers in parasitic forms', 'Flame cells for excretion and osmoregulation',
               'Planaria shows very high regeneration capacity'],
      examples: [
        { g: 'Taenia', n: 'tapeworm' }, { g: 'Fasciola', n: 'liver fluke' }, { g: 'Planaria', n: '' }
      ],
      shape: 'flatworm'
    },
    {
      id: 'aschelminthes', name: 'Aschelminthes', alt: 'Nematoda', common: 'Roundworms', hue: '#D9B44A',
      organisation: 'organ-system', symmetry: 'bilateral', layers: 'triploblastic',
      coelom: 'pseudocoelomate', segmented: false, notochord: false,
      habitat: 'Free-living, aquatic and terrestrial, or parasitic in plants and animals',
      sexes: 'Dioecious — sexes separate, with marked sexual dimorphism (females longer)',
      fertilisation: 'Internal', development: 'Direct or indirect',
      digestion: 'Complete alimentary canal with a muscular pharynx',
      circulatory: 'Absent', respiration: 'Body surface',
      excretion: 'Excretory pore through an excretory tube',
      nervous: 'Nerve ring with nerve cords', skeleton: 'Hydrostatic (pseudocoelomic fluid)',
      unique: ['First phylum with a complete digestive tract — mouth and anus',
               'Body cavity is a pseudocoelom, not lined by mesoderm',
               'Sexual dimorphism is clear: females are longer than males',
               'Only longitudinal muscles — hence the characteristic thrashing movement'],
      examples: [
        { g: 'Ascaris', n: 'round worm' }, { g: 'Wuchereria', n: 'filaria worm' },
        { g: 'Ancylostoma', n: 'hookworm' }
      ],
      shape: 'roundworm'
    },
    {
      id: 'annelida', name: 'Annelida', common: 'Segmented worms', hue: '#E07A5F',
      organisation: 'organ-system', symmetry: 'bilateral', layers: 'triploblastic',
      coelom: 'coelomate', segmented: true, notochord: false,
      habitat: 'Aquatic (marine and freshwater) or terrestrial, free-living and sometimes parasitic',
      sexes: 'Nereis is dioecious; earthworms and leeches are monoecious',
      fertilisation: 'External in Nereis, internal in earthworm',
      development: 'Direct in earthworm, indirect in Nereis',
      digestion: 'Complete alimentary canal', circulatory: 'Closed',
      respiration: 'Body surface, or gills (parapodia in Nereis)',
      excretion: 'Nephridia', nervous: 'Paired ganglia connected by a ventral nerve cord',
      skeleton: 'Hydrostatic (coelomic fluid)',
      unique: ['First phylum with a true coelom, lined by mesoderm',
               'Metameric segmentation — the body is divided into repeated segments',
               'Longitudinal and circular muscles allow locomotion',
               'Closed circulatory system', 'Nephridia for excretion and osmoregulation'],
      examples: [
        { g: 'Nereis', n: 'marine, dioecious' }, { g: 'Pheretima', n: 'earthworm' },
        { g: 'Hirudinaria', n: 'blood-sucking leech' }
      ],
      shape: 'annelid'
    },
    {
      id: 'arthropoda', name: 'Arthropoda', common: 'Insects, crustaceans, arachnids', hue: '#C08A3E',
      organisation: 'organ-system', symmetry: 'bilateral', layers: 'triploblastic',
      coelom: 'coelomate', segmented: true, notochord: false,
      habitat: 'Everywhere — the largest phylum, including two-thirds of all named animal species',
      sexes: 'Mostly dioecious', fertilisation: 'Usually internal',
      development: 'Direct or indirect (metamorphosis)',
      digestion: 'Complete alimentary canal', circulatory: 'Open',
      respiration: 'Gills, book gills, book lungs or tracheal system',
      excretion: 'Malpighian tubules', nervous: 'Brain and ventral nerve cord with ganglia',
      skeleton: 'Chitinous exoskeleton',
      unique: ['Largest phylum of Animalia', 'Chitinous exoskeleton, shed by moulting',
               'Jointed appendages — the name means "jointed feet"',
               'Body divided into head, thorax and abdomen (tagmata)',
               'Sensory organs: antennae, compound eyes, statocysts'],
      examples: [
        { g: 'Apis', n: 'honey bee' }, { g: 'Bombyx', n: 'silkworm' }, { g: 'Laccifer', n: 'lac insect' },
        { g: 'Anopheles', n: 'mosquito' }, { g: 'Culex', n: 'mosquito' }, { g: 'Aedes', n: 'mosquito' },
        { g: 'Locusta', n: 'locust' }, { g: 'Limulus', n: 'king crab — a living fossil' }
      ],
      shape: 'arthropod'
    },
    {
      id: 'mollusca', name: 'Mollusca', common: 'Snails, bivalves, cephalopods', hue: '#B07CC6',
      organisation: 'organ-system', symmetry: 'bilateral', layers: 'triploblastic',
      coelom: 'coelomate', segmented: false, notochord: false,
      habitat: 'Terrestrial or aquatic — the second largest phylum',
      sexes: 'Dioecious', fertilisation: 'Internal or external by group',
      development: 'Indirect, with a larval stage',
      digestion: 'Complete, with a rasping radula', circulatory: 'Open',
      respiration: 'Feather-like gills (ctenidia) in the mantle cavity',
      excretion: 'Kidney (metanephridia)', nervous: 'Paired ganglia with connectives',
      skeleton: 'Calcareous shell (external, internal or absent)',
      unique: ['Second largest phylum of Animalia',
               'Soft unsegmented body covered by a calcareous shell',
               'Body: head, muscular foot and visceral hump covered by the mantle',
               'Radula — a file-like rasping organ for feeding',
               'The space between the hump and the mantle is the mantle cavity, containing the gills'],
      examples: [
        { g: 'Pila', n: 'apple snail' }, { g: 'Pinctada', n: 'pearl oyster' },
        { g: 'Sepia', n: 'cuttlefish' }, { g: 'Loligo', n: 'squid' }, { g: 'Octopus', n: 'devil fish' },
        { g: 'Aplysia', n: 'sea hare' }, { g: 'Dentalium', n: 'tusk shell' },
        { g: 'Chaetopleura', n: 'chiton' }
      ],
      shape: 'mollusc'
    },
    {
      id: 'echinodermata', name: 'Echinodermata', common: 'Starfish, urchins, sea cucumbers', hue: '#E0913A',
      organisation: 'organ-system', symmetry: 'radial', layers: 'triploblastic',
      coelom: 'coelomate', segmented: false, notochord: false,
      habitat: 'Exclusively marine', sexes: 'Dioecious', fertilisation: 'External',
      development: 'Indirect, with a free-swimming bilateral larva',
      digestion: 'Complete — mouth on the lower (ventral) side, anus on the upper side',
      circulatory: 'Open (haemal system)', respiration: 'Tube feet, papulae, and the water vascular system',
      excretion: 'No excretory system',
      nervous: 'Nerve ring with radial nerves', skeleton: 'Endoskeleton of calcareous ossicles',
      unique: ['Adults are radially symmetrical but the larvae are bilaterally symmetrical',
               'Water vascular system — used for locomotion, capture of food and respiration',
               'Endoskeleton of calcareous ossicles — hence "spiny-skinned"',
               'Excretory system is completely absent',
               'Coelom is enterocoelous — it forms from pouches of the embryonic gut'],
      examples: [
        { g: 'Asterias', n: 'star fish' }, { g: 'Echinus', n: 'sea urchin' },
        { g: 'Antedon', n: 'sea lily' }, { g: 'Cucumaria', n: 'sea cucumber' },
        { g: 'Ophiura', n: 'brittle star' }
      ],
      shape: 'starfish'
    },
    {
      id: 'hemichordata', name: 'Hemichordata', common: 'Acorn worms', hue: '#7FBF9B',
      organisation: 'organ-system', symmetry: 'bilateral', layers: 'triploblastic',
      coelom: 'coelomate', segmented: false, notochord: false,
      habitat: 'Marine, worm-like, solitary or colonial and usually burrowing',
      sexes: 'Dioecious', fertilisation: 'External', development: 'Indirect',
      digestion: 'Complete alimentary canal', circulatory: 'Open',
      respiration: 'Gills', excretion: 'Proboscis gland',
      nervous: 'Dorsal and ventral nerve cords', skeleton: 'Absent',
      unique: ['Body divided into proboscis, collar and trunk',
               'Formerly placed as a subphylum of Chordata — now a separate phylum',
               'Has a stomochord, NOT a true notochord',
               'Excretion by the proboscis gland'],
      examples: [{ g: 'Balanoglossus', n: '' }, { g: 'Saccoglossus', n: '' }],
      shape: 'acornworm'
    },
    {
      id: 'chordata', name: 'Chordata', common: 'Tunicates, lancelets, vertebrates', hue: '#FF6B9D',
      organisation: 'organ-system', symmetry: 'bilateral', layers: 'triploblastic',
      coelom: 'coelomate', segmented: true, notochord: true,
      habitat: 'Aquatic, terrestrial and aerial — every habitat on Earth',
      sexes: 'Mostly dioecious', fertilisation: 'External or internal',
      development: 'Direct or indirect', digestion: 'Complete alimentary canal',
      circulatory: 'Closed, with a ventral heart', respiration: 'Gills or lungs',
      excretion: 'Kidneys', nervous: 'Dorsal, hollow, single nerve cord',
      skeleton: 'Living endoskeleton',
      unique: ['Notochord — a rod of specialised cells along the back',
               'Dorsal, hollow, single nerve cord',
               'Paired pharyngeal gill slits',
               'Post-anal tail',
               'Closed circulatory system with a ventral heart'],
      examples: [
        { g: 'Branchiostoma', n: 'Amphioxus / lancelet' }, { g: 'Ascidia', n: 'sea squirt' },
        { g: 'Petromyzon', n: 'lamprey' }, { g: 'Columba', n: 'pigeon' }
      ],
      shape: 'chordate'
    }
  ];

  /* ---------------- Chordata: subphyla ---------------- */
  const SUBPHYLA = [
    { id: 'urochordata', name: 'Urochordata', alt: 'Tunicata',
      notochord: 'Present only in the larval tail, lost in the adult',
      note: 'The larva is free-swimming and chordate-like; the adult is sessile and degenerate — retrogressive metamorphosis.',
      examples: [{ g: 'Ascidia', n: '' }, { g: 'Salpa', n: '' }, { g: 'Doliolum', n: '' }] },
    { id: 'cephalochordata', name: 'Cephalochordata',
      notochord: 'Extends from head to tail and persists throughout life',
      note: 'Amphioxus is the classic textbook chordate — every chordate character is present and obvious.',
      examples: [{ g: 'Branchiostoma', n: 'Amphioxus / lancelet' }] },
    { id: 'vertebrata', name: 'Vertebrata',
      notochord: 'Present in the embryo, replaced in the adult by a vertebral column',
      note: 'All vertebrates are chordates, but all chordates are not vertebrates. Vertebrates additionally have a ventral muscular heart with 2–4 chambers, kidneys, and paired appendages.',
      examples: [{ g: 'Petromyzon', n: '' }, { g: 'Rana', n: '' }, { g: 'Columba', n: '' }] }
  ];

  /* ---------------- Vertebrata: the seven classes ---------------- */
  const CLASSES = [
    {
      id: 'cyclostomata', name: 'Cyclostomata', common: 'Jawless fishes', hue: '#7A8FB8',
      jaws: false, skeleton: 'Cartilaginous', scales: 'Absent', pairedFins: 'Absent',
      gillSlits: '6–15 pairs, for respiration', heart: 2, circulation: 'Single', thermo: 'Poikilothermous',
      respiration: 'Gills', fertilisation: 'External', eggs: 'Oviparous', development: 'Indirect',
      unique: ['Sucking and circular mouth without jaws',
               'Ectoparasites on some fishes',
               'Body without scales and paired fins',
               'Cranium and vertebral column are cartilaginous',
               'Migrate to fresh water for spawning, die after spawning; larvae return to the ocean'],
      examples: [{ g: 'Petromyzon', n: 'lamprey' }, { g: 'Myxine', n: 'hagfish' }]
    },
    {
      id: 'chondrichthyes', name: 'Chondrichthyes', common: 'Cartilaginous fishes', hue: '#5E8CA8',
      jaws: true, skeleton: 'Cartilaginous', scales: 'Placoid', pairedFins: 'Present',
      gillSlits: 'Separate, no operculum', heart: 2, circulation: 'Single', thermo: 'Poikilothermous',
      respiration: 'Gills', fertilisation: 'Internal', eggs: 'Many viviparous', development: 'Direct',
      unique: ['Marine, with a cartilaginous endoskeleton',
               'Mouth is located ventrally; notochord persists throughout life',
               'Gill slits are separate and without an operculum',
               'Skin is tough, with minute placoid scales; teeth are modified placoid scales',
               'Air bladder is ABSENT — so they must swim constantly to avoid sinking',
               'Males have claspers; fertilisation is internal',
               'Some (Torpedo) have electric organs, some (Trygon) have poison stings'],
      examples: [
        { g: 'Scoliodon', n: 'dog fish' }, { g: 'Pristis', n: 'saw fish' },
        { g: 'Carcharodon', n: 'great white shark' }, { g: 'Trygon', n: 'sting ray' },
        { g: 'Torpedo', n: 'electric ray' }
      ]
    },
    {
      id: 'osteichthyes', name: 'Osteichthyes', common: 'Bony fishes', hue: '#4E9CC0',
      jaws: true, skeleton: 'Bony', scales: 'Cycloid / ctenoid', pairedFins: 'Present',
      gillSlits: 'Four pairs, covered by an operculum', heart: 2, circulation: 'Single',
      thermo: 'Poikilothermous', respiration: 'Gills', fertilisation: 'Mostly external',
      eggs: 'Mostly oviparous', development: 'Direct',
      unique: ['Marine and freshwater, with a bony endoskeleton',
               'Mouth is mostly terminal',
               'Four pairs of gills covered by an operculum on each side',
               'Air bladder is PRESENT — it regulates buoyancy',
               'Skin is covered with cycloid or ctenoid scales'],
      examples: [
        { g: 'Exocoetus', n: 'flying fish' }, { g: 'Hippocampus', n: 'sea horse' },
        { g: 'Labeo', n: 'rohu' }, { g: 'Catla', n: 'katla' }, { g: 'Clarias', n: 'magur' },
        { g: 'Betta', n: 'fighting fish' }, { g: 'Pterophyllum', n: 'angel fish' }
      ]
    },
    {
      id: 'amphibia', name: 'Amphibia', common: 'Amphibians', hue: '#6FAE6F',
      jaws: true, skeleton: 'Bony', scales: 'Absent — skin moist', pairedFins: 'Two pairs of limbs',
      gillSlits: 'Larval gills; adult lungs and skin', heart: 3, circulation: 'Double (incomplete)',
      thermo: 'Poikilothermous', respiration: 'Gills, lungs and skin', fertilisation: 'External',
      eggs: 'Oviparous', development: 'Indirect (metamorphosis)',
      unique: ['Live in both aquatic and terrestrial habitats',
               'Skin is moist and without scales',
               'Eyes have eyelids; a tympanum represents the ear',
               'Alimentary canal, urinary and reproductive tracts open into a common CLOACA',
               'Three-chambered heart — two atria and one ventricle'],
      examples: [
        { g: 'Bufo', n: 'toad' }, { g: 'Rana', n: 'frog' }, { g: 'Hyla', n: 'tree frog' },
        { g: 'Salamandra', n: 'salamander' }, { g: 'Ichthyophis', n: 'limbless amphibian' }
      ]
    },
    {
      id: 'reptilia', name: 'Reptilia', common: 'Reptiles', hue: '#9BA84E',
      jaws: true, skeleton: 'Bony', scales: 'Dry, cornified epidermal scales or scutes',
      pairedFins: 'Two pairs of limbs (absent in snakes)',
      gillSlits: 'Absent', heart: 3, circulation: 'Double (incomplete; crocodile 4-chambered)',
      thermo: 'Poikilothermous', respiration: 'Lungs', fertilisation: 'Internal',
      eggs: 'Oviparous', development: 'Direct',
      unique: ['Creeping or crawling mode of locomotion — the name means "to creep"',
               'Body covered by dry, cornified skin with epidermal scales or scutes',
               'No external ear openings — the tympanum represents the ear',
               'Three-chambered heart, EXCEPT the crocodile which has four chambers',
               'Snakes and lizards shed their scales as a skin cast',
               'Eggs are covered with a hard shell and laid on land'],
      examples: [
        { g: 'Chelone', n: 'turtle' }, { g: 'Testudo', n: 'tortoise' }, { g: 'Chameleon', n: 'tree lizard' },
        { g: 'Calotes', n: 'garden lizard' }, { g: 'Crocodilus', n: 'crocodile' },
        { g: 'Alligator', n: '' }, { g: 'Hemidactylus', n: 'wall lizard' },
        { g: 'Naja', n: 'cobra' }, { g: 'Bangarus', n: 'krait' }, { g: 'Vipera', n: 'viper' }
      ]
    },
    {
      id: 'aves', name: 'Aves', common: 'Birds', hue: '#E8B64C',
      jaws: true, skeleton: 'Fully ossified; long bones hollow with air cavities (pneumatic)',
      scales: 'Feathers; scales on hind limbs', pairedFins: 'Forelimbs modified into wings',
      gillSlits: 'Absent', heart: 4, circulation: 'Double (complete)', thermo: 'Homeothermous',
      respiration: 'Lungs with air sacs', fertilisation: 'Internal', eggs: 'Oviparous',
      development: 'Direct',
      unique: ['Presence of FEATHERS — the defining character',
               'Forelimbs are modified into wings',
               'Beak is present; teeth are absent',
               'Skin is dry without glands, except the oil gland at the base of the tail',
               'Long bones are hollow with air cavities (pneumatic) — an adaptation for flight',
               'Digestive tract has additional chambers: the crop and the gizzard',
               'Four-chambered heart; warm-blooded (homeothermous)',
               'Lungs have air sacs that supplement respiration'],
      examples: [
        { g: 'Corvus', n: 'crow' }, { g: 'Columba', n: 'pigeon' }, { g: 'Psittacula', n: 'parrot' },
        { g: 'Struthio', n: 'ostrich' }, { g: 'Pavo', n: 'peacock' },
        { g: 'Aptenodytes', n: 'penguin' }, { g: 'Neophron', n: 'vulture' }
      ]
    },
    {
      id: 'mammalia', name: 'Mammalia', common: 'Mammals', hue: '#C4785E',
      jaws: true, skeleton: 'Bony', scales: 'Hair', pairedFins: 'Two pairs of limbs',
      gillSlits: 'Absent', heart: 4, circulation: 'Double (complete)', thermo: 'Homeothermous',
      respiration: 'Lungs', fertilisation: 'Internal', eggs: 'Mostly viviparous',
      development: 'Direct',
      unique: ['MAMMARY GLANDS that produce milk to nourish the young — the defining character',
               'Body covered with hair',
               'External ears or pinnae are present',
               'Different types of teeth (heterodont), set in sockets in the jaw (thecodont)',
               'Four-chambered heart; warm-blooded (homeothermous)',
               'Mostly viviparous, with direct development'],
      examples: [
        { g: 'Ornithorhynchus', n: 'platypus — egg-laying mammal' },
        { g: 'Macropus', n: 'kangaroo' }, { g: 'Pteropus', n: 'flying fox' },
        { g: 'Camelus', n: 'camel' }, { g: 'Macaca', n: 'monkey' }, { g: 'Rattus', n: 'rat' },
        { g: 'Canis', n: 'dog' }, { g: 'Felis', n: 'cat' }, { g: 'Elephas', n: 'elephant' },
        { g: 'Equus', n: 'horse' }, { g: 'Delphinus', n: 'common dolphin' },
        { g: 'Balaenoptera', n: 'blue whale' }, { g: 'Panthera tigris', n: 'tiger' },
        { g: 'Panthera leo', n: 'lion' }
      ]
    }
  ];

  /* Flat specimen list for identification drills — genus → where it belongs */
  const SPECIMENS = [];
  PHYLA.forEach(p => p.examples.forEach(e => SPECIMENS.push({
    genus: e.g, common: e.n, phylum: p.id, phylumName: p.name, hue: p.hue, rank: 'phylum'
  })));
  CLASSES.forEach(c => c.examples.forEach(e => SPECIMENS.push({
    genus: e.g, common: e.n, phylum: 'chordata', klass: c.id, klassName: c.name,
    phylumName: 'Chordata', hue: c.hue, rank: 'class'
  })));

  return { CHARACTERS, PHYLA, SUBPHYLA, CLASSES, SPECIMENS };
})();
