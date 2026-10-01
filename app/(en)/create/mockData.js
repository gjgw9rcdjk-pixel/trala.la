// Mock "AI output" for the /create prototype. Four example occasions; any
// free-text idea that isn't an example falls back to the friends set.
// Cards: first 15 fill the deck, the rest are spares used by ↻ (swap).
// Written to the klausimatorius rules: open, concrete, short, no gendered
// LT forms, varied question shapes.

export const MOCK_SETS = [
  {
    id: 'mom60',
    chip: { en: '🎂 Mom’s 60th', lt: '🎂 Mamos 60-metis' },
    prompt: {
      en: 'My mom turns 60. Family dinner, about 12 people, three generations at the table.',
      lt: 'Mamai 60. Šeimos vakarienė, apie 12 žmonių, prie stalo trys kartos.',
    },
    refined: {
      en: 'A warm, funny deck for Mom’s 60th birthday dinner. About 12 family members across three generations, grandkids included. Cards invite stories about her, and a few are for her to answer.',
      lt: 'Šilta ir smagi kaladė mamos 60-mečio vakarienei. Apie 12 šeimos narių, trys kartos, su anūkais. Kortos kviečia pasakoti istorijas apie ją, o į kelias atsako ji pati.',
    },
    name: { en: 'Mom Turns 60', lt: 'Mamai 60' },
    questions: [
      { q: { en: 'Who’s at the table?', lt: 'Kas sėdės prie stalo?' },
        options: [{ en: 'Family only', lt: 'Tik šeima' }, { en: 'Family + her friends', lt: 'Šeima ir jos draugai' }, { en: 'All ages, kids too', lt: 'Visų amžių, ir vaikai' }] },
      { q: { en: 'What mood are you after?', lt: 'Kokios nuotaikos norisi?' },
        options: [{ en: 'Warm & nostalgic', lt: 'Šilta, nostalgiška' }, { en: 'Mostly laughs', lt: 'Daugiausia juoko' }, { en: 'A bit of both', lt: 'Po truputį visko' }] },
      { q: { en: 'Should Mom answer some cards herself?', lt: 'Ar mama pati atsakys į kai kurias kortas?' },
        options: [{ en: 'Yes, a few for her', lt: 'Taip, kelios jai' }, { en: 'No, only about her', lt: 'Ne, tik apie ją' }] },
      { q: { en: 'How deep can it go?', lt: 'Kiek giliai galima?' },
        options: [{ en: 'Keep it light', lt: 'Lengvai' }, { en: 'A couple of tear-jerkers', lt: 'Kelios jautrios' }, { en: 'Go for it', lt: 'Drąsiai' }] },
    ],
    cards: [
      ['What’s the first dish of Mom’s you remember?', 'Kokį pirmą mamos patiekalą prisimeni?'],
      ['Tell us about a time Mom saved the day and nobody noticed.', 'Papasakok apie kartą, kai mama viską išgelbėjo, o niekas to nepastebėjo.'],
      ['Which of Mom’s sayings do you catch yourself using now?', 'Kurią mamos frazę dabar netyčia kartoji ir tu?'],
      ['Mom, at 20, what did you think your life would look like at 60?', 'Mama, kaip dvidešimties įsivaizdavai savo gyvenimą šešiasdešimties?'],
      ['If Mom’s life were a movie, which scene would open it?', 'Jei mamos gyvenimas būtų filmas, kokia scena jis prasidėtų?'],
      ['Name three things Mom is secretly great at.', 'Pavadink tris dalykus, kuriuose mama slapta nepralenkiama.'],
      ['Tell us about a family trip that went wrong and became a favorite story.', 'Papasakok apie šeimos kelionę, kuri nepavyko, bet tapo mėgstamiausia istorija.'],
      ['Which of Mom’s rules did you break most, and did she know?', 'Kurią mamos taisyklę laužei dažniausiai ir ar ji žinojo?'],
      ['Grandkids: what’s the best part of a sleepover at Grandma’s?', 'Anūkai: kas geriausia nakvojant pas močiutę?'],
      ['Mom, which decade of your life would you replay, and why?', 'Mama, kurį savo gyvenimo dešimtmetį išgyventum dar kartą ir kodėl?'],
      ['What did Mom teach you that no school ever did?', 'Ko mama tave išmokė, ko neišmokė jokia mokykla?'],
      ['Tell us about the day you finally understood why Mom did something.', 'Papasakok, kada pagaliau supratai, kodėl mama kažką darė būtent taip.'],
      ['Which photo of Mom belongs on the wall tonight?', 'Kuri mamos nuotrauka šįvakar turėtų kabėti ant sienos?'],
      ['If Mom had a superpower, what would it be?', 'Jei mama turėtų supergalią, kokia ji būtų?'],
      ['What’s a small habit of Mom’s you’d recognize anywhere?', 'Kokį mažą mamos įprotį atpažintum bet kur?'],
      ['Mom, who was your best friend at school, and what did you two get up to?', 'Mama, kas buvo tavo geriausia draugė mokykloje ir ką judvi išdarinėjot?'],
      ['What do you wish you’d thanked Mom for sooner?', 'Už ką norėtum mamai padėkoti, nors reikėjo tai padaryti seniai?'],
      ['Finish the sentence: At 60, Mom is still the one who…', 'Užbaik sakinį: Ir šešiasdešimties mama vis dar ta, kuri…'],
    ],
  },
  {
    id: 'firstDate',
    chip: { en: '💑 First date', lt: '💑 Pirmas pasimatymas' },
    prompt: {
      en: 'First date over dinner. We met on an app, want something fun that isn’t a job interview.',
      lt: 'Pirmas pasimatymas per vakarienę. Susipažinome programėlėje, norisi smagiai, ne kaip darbo pokalbyje.',
    },
    refined: {
      en: 'A deck for a first date over dinner, two people who met on an app. Starts light and playful, gets a little deeper by dessert. Nothing too personal, nothing about exes.',
      lt: 'Kaladė pirmam pasimatymui per vakarienę, dviem žmonėms, susipažinusiems programėlėje. Pradžia lengva ir žaisminga, prie deserto šiek tiek giliau. Nieko per daug asmeniško ir nieko apie buvusius.',
    },
    name: { en: 'First Date', lt: 'Pirmas pasimatymas' },
    questions: [
      { q: { en: 'Where are you meeting?', lt: 'Kur susitinkate?' },
        options: [{ en: 'Dinner', lt: 'Vakarienė' }, { en: 'Walk or a bar', lt: 'Pasivaikščiojimas ar baras' }, { en: 'Video call', lt: 'Vaizdo skambutis' }] },
      { q: { en: 'What vibe?', lt: 'Kokia nuotaika?' },
        options: [{ en: 'Keep it light', lt: 'Lengva' }, { en: 'Light, then deeper', lt: 'Lengvai, paskui giliau' }, { en: 'A little flirty', lt: 'Truputį flirto' }] },
      { q: { en: 'How well do you know each other?', lt: 'Kiek vienas kitą pažįstate?' },
        options: [{ en: 'Just a few messages', lt: 'Tik kelios žinutės' }, { en: 'Talked a lot already', lt: 'Jau daug kalbėjomės' }, { en: 'Friends first', lt: 'Iš pradžių draugai' }] },
    ],
    cards: [
      ['What’s the best date you’ve been on that wasn’t a date?', 'Koks buvo geriausias tavo pasimatymas, kuris net nebuvo pasimatymas?'],
      ['Tell me about the last time you laughed so hard you had to leave the room.', 'Papasakok, kada paskutinį kartą juokeisi taip, kad teko išeiti iš kambario.'],
      ['What’s a green flag you notice that most people miss?', 'Kokį gerą ženklą žmoguje pastebi, kai kiti jo nemato?'],
      ['If we skipped dinner and did anything else tonight, what would you pick?', 'Jei praleistume vakarienę ir darytume bet ką kita, ką rinktumeisi?'],
      ['What are you weirdly competitive about?', 'Kur tavyje netikėtai pabunda azartas?'],
      ['Who would you call first to tell about tonight?', 'Kam pirmiausia paskambintum papasakoti apie šį vakarą?'],
      ['Tell me about a place that feels like yours.', 'Papasakok apie vietą, kuri jaučiasi tik tavo.'],
      ['What skill would you love to show off, if anyone ever asked?', 'Kokiu įgūdžiu mielai pasigirtum, jei tik kas paklaustų?'],
      ['What does a perfect lazy Sunday look like for you?', 'Kaip atrodo tavo tobulas tingus sekmadienis?'],
      ['What did you want to be at eight, and how close did you get?', 'Kuo norėjai būti aštuonerių ir kiek arti priėjai?'],
      ['Have you ever said yes to something wild on a whim, and what happened?', 'Ar kada nors spontaniškai sutikai su kažkuo beprotišku? Kas nutiko?'],
      ['Which song takes you straight back to one summer?', 'Kuri daina tave akimirksniu nukelia į vieną vasarą?'],
      ['What would your friends call your most lovable flaw?', 'Kokį tavo trūkumą draugai vadintų mieliausiu?'],
      ['What’s the most “you” thing in your fridge right now?', 'Kas tavo šaldytuve dabar labiausiai „tu“?'],
      ['What have you changed your mind about in the last year?', 'Dėl ko per pastaruosius metus persigalvojai?'],
      ['Tell me about the best meal you’ve shared with a stranger.', 'Papasakok apie geriausią valgį su nepažįstamu žmogumi.'],
      ['What tiny rule do you live by that nobody taught you?', 'Kokios mažos taisyklės laikaisi, nors niekas jos nemokė?'],
      ['Plan a trip together or get lost on one, and why?', 'Kelionę geriau suplanuoti kartu ar joje pasiklysti? Kodėl?'],
    ],
  },
  {
    id: 'team',
    chip: { en: '🏢 Team party', lt: '🏢 Komandos vakarėlis' },
    prompt: {
      en: 'End-of-year team party, about 20 colleagues, the boss is coming too.',
      lt: 'Metų pabaigos komandos vakarėlis, apie 20 kolegų, ateis ir vadovė.',
    },
    refined: {
      en: 'A deck for the end-of-year team party. About 20 colleagues, the manager plays too. Fun first, with a few warm moments about the year. Nothing that ranks people or gets too personal.',
      lt: 'Kaladė metų pabaigos komandos vakarėliui. Apie 20 kolegų, žais ir vadovė. Pirmiausia smagu, su keliomis šiltomis akimirkomis apie metus. Nieko, kas reitinguotų žmones ar būtų per asmeniška.',
    },
    name: { en: 'Team Party 2026', lt: 'Komandos vakarėlis 2026' },
    questions: [
      { q: { en: 'How many people?', lt: 'Kiek žmonių?' },
        options: [{ en: 'Under 10', lt: 'Iki 10' }, { en: '10–30', lt: '10–30' }, { en: '30+', lt: '30+' }] },
      { q: { en: 'Is the manager playing?', lt: 'Ar vadovas žais?' },
        options: [{ en: 'Yes', lt: 'Taip' }, { en: 'No', lt: 'Ne' }] },
      { q: { en: 'What vibe?', lt: 'Kokia nuotaika?' },
        options: [{ en: 'Pure fun', lt: 'Tik smagiai' }, { en: 'Fun + a bit of the year', lt: 'Smagiai ir truputį apie metus' }] },
      { q: { en: 'Where?', lt: 'Kur?' },
        options: [{ en: 'Office', lt: 'Biure' }, { en: 'Restaurant', lt: 'Restorane' }, { en: 'Online', lt: 'Internetu' }] },
    ],
    cards: [
      ['What’s the most useful thing a coworker taught you this year?', 'Kokį naudingiausią dalyką šiemet išmokai iš kolegų?'],
      ['Tell us about a work mistake you can laugh about now.', 'Papasakok apie darbo klaidą, iš kurios dabar gali juoktis.'],
      ['If our team were a band, what would our first album be called?', 'Jei mūsų komanda būtų grupė, kaip vadintųsi mūsų pirmasis albumas?'],
      ['What was your very first job, and what did it teach you about people?', 'Koks buvo tavo pats pirmas darbas ir ko jis išmokė apie žmones?'],
      ['What tiny office ritual would you fight to keep?', 'Kokį mažą biuro ritualą gintum iki paskutinio?'],
      ['Name three things our team does better than anyone.', 'Pavadink tris dalykus, kuriuos mūsų komanda daro geriau už visus.'],
      ['If you swapped jobs with someone here for a week, whose would you pick?', 'Jei savaitei apsikeistum darbais su kuo nors čia, kieno darbą rinktumeisi?'],
      ['What skill do you have that nobody at work knows about?', 'Kokį įgūdį turi, apie kurį darbe niekas nežino?'],
      ['Tell us about the moment this year the team really clicked.', 'Papasakok apie akimirką šiemet, kai komanda tikrai susigrojo.'],
      ['What’s the best advice a boss ever gave you?', 'Koks geriausias patarimas, kurį kada gavai iš vadovo?'],
      ['If we invented a team holiday, what would we celebrate?', 'Jei išgalvotume savo komandos šventę, ką švęstume?'],
      ['What would you tell yourself on your first day here?', 'Ką pasakytum sau pirmą darbo čia dieną?'],
      ['What’s the strangest request you’ve ever gotten at work?', 'Koks keisčiausias prašymas, kurį kada gavai darbe?'],
      ['Finish the sentence: Next year, I’d love our team to finally…', 'Užbaik sakinį: Kitąmet norėčiau, kad mūsų komanda pagaliau…'],
      ['What small win this year are you secretly proud of?', 'Kokia maža šių metų pergale slapta didžiuojiesi?'],
      ['What’s the best thing that ever happened here on a Friday afternoon?', 'Kas geriausio čia yra nutikę penktadienio popietę?'],
      ['Tell us about a time someone on the team quietly had your back.', 'Papasakok, kaip kažkas iš komandos tave kartą tyliai išgelbėjo.'],
      ['If the office got one new rule, what should it be?', 'Jei biure atsirastų viena nauja taisyklė, kokia ji turėtų būti?'],
    ],
  },
  {
    id: 'friends',
    chip: { en: '🏕 Weekend away', lt: '🏕 Draugų savaitgalis' },
    prompt: {
      en: 'Weekend at a cabin with 8 friends. Some we’ve known forever, a couple of new faces.',
      lt: 'Savaitgalis sodyboje su 8 draugais. Vienus pažįstame amžinybę, yra ir naujų veidų.',
    },
    refined: {
      en: 'A deck for a weekend away with friends. About 8 people, old friends plus a few new faces. Mostly laughs around the fire, with a couple of deeper late-night cards.',
      lt: 'Kaladė draugų savaitgaliui. Apie 8 žmonės, seni draugai ir keli nauji veidai. Daugiausia juoko prie laužo ir kelios gilesnės kortos vėlyvam vakarui.',
    },
    name: { en: 'Weekend Away', lt: 'Draugų savaitgalis' },
    questions: [
      { q: { en: 'How many people?', lt: 'Kiek žmonių?' },
        options: [{ en: '3–5', lt: '3–5' }, { en: '6–10', lt: '6–10' }, { en: '10+', lt: '10+' }] },
      { q: { en: 'How long have you known each other?', lt: 'Kiek laiko pažįstate vieni kitus?' },
        options: [{ en: 'Years', lt: 'Metų metus' }, { en: 'Old and new mixed', lt: 'Seni ir nauji' }, { en: 'Just met', lt: 'Ką tik susipažinom' }] },
      { q: { en: 'What vibe?', lt: 'Kokia nuotaika?' },
        options: [{ en: 'Chaos & laughs', lt: 'Chaosas ir juokas' }, { en: 'Campfire talks', lt: 'Pokalbiai prie laužo' }, { en: 'Both', lt: 'Abu' }] },
    ],
    cards: [
      ['Tell us about the worst trip you still love.', 'Papasakok apie blogiausią kelionę, kurią vis tiek myli.'],
      ['Who here would last longest in the woods with no phone?', 'Kas iš mūsų ilgiausiai išgyventų miške be telefono?'],
      ['What do you always pack that nobody else would?', 'Ką visada įsidedi į kuprinę, ko neįsidėtų niekas kitas?'],
      ['What’s the best night this group has had, and how did it start?', 'Koks buvo geriausias šios kompanijos vakaras ir kaip jis prasidėjo?'],
      ['If we opened a business together, what would it be and who’s the boss?', 'Jei kartu atidarytume verslą, koks jis būtų ir kas vadovautų?'],
      ['Tell us how you first met someone in this group.', 'Papasakok, kaip pirmą kartą susipažinai su kuo nors iš šios kompanijos.'],
      ['What tradition should this group start this weekend?', 'Kokią tradiciją ši kompanija turėtų pradėti šį savaitgalį?'],
      ['Name three songs that must play on this trip.', 'Pavadink tris dainas, kurios šį savaitgalį privalo nuskambėti.'],
      ['Have you ever gotten properly lost somewhere, and what happened?', 'Ar kada nors tikrai pasiklydai? Kas nutiko?'],
      ['What would ten-year-old you think of this weekend?', 'Ką apie šį savaitgalį pagalvotų dešimtmetis tu?'],
      ['What’s the best advice someone here gave you and probably forgot?', 'Kokį geriausią patarimą tau davė kas nors iš čia ir tikriausiai jau pamiršo?'],
      ['If this weekend had a title so far, what would it be?', 'Jei šis savaitgalis kol kas turėtų pavadinimą, koks jis būtų?'],
      ['What small thing did a friend once do that you still think about?', 'Kokį mažą draugo poelgį vis dar prisimeni?'],
      ['Which of us would you call at 3 a.m., and why?', 'Kam iš mūsų skambintum trečią nakties ir kodėl?'],
      ['Where should we all be together in five years?', 'Kur visi kartu turėtume būti po penkerių metų?'],
      ['What’s the most overrated part of traveling?', 'Kas kelionėse labiausiai pervertinta?'],
      ['Tell us about a meal on a trip you still dream about.', 'Papasakok apie kelionės patiekalą, apie kurį vis dar svajoji.'],
      ['A cabin with no Wi-Fi or a city with no sleep, and why?', 'Namelis be interneto ar miestas be miego? Kodėl?'],
    ],
  },
];

export const DECK_SIZE = 15;

// Pick the set for a free-text idea: an exact example prompt wins,
// anything else gets the friends set with the user's text as the "refined" idea.
export function setForIdea(text) {
  const t = text.trim();
  const hit = MOCK_SETS.find((s) => s.prompt.en === t || s.prompt.lt === t);
  return hit || { ...MOCK_SETS[3], custom: t };
}
