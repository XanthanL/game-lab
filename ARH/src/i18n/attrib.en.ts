// 他者视角（帽子间）英文资源：id → [{ from, label }]。
// from 取自 ideologies.ts 的 nameEn；label 为中文网络蔑称的英文对应。
// Appendix A in Result.ts uses this when lang === 'en'.
export interface AttribEn { from: string; label: string; }

export const ATTRIB_EN: Record<string, AttribEn[]> = {
  ml: [
    { from: "Neoliberalism", label: "ultra-leftist, Old Fart" },
    { from: "Trotskyism", label: "revisionist, bureaucrat" },
    { from: "Anarchism", label: "red bureaucrat, authoritarian leftist" },
    { from: "Social Democracy", label: "dogmatic leftist, slogan-shouter" },
    { from: "Libertarianism", label: "robber, equality-obsessive" },
  ],
  socdem: [
    { from: "Marxism-Leninism", label: "scab, reformist" },
    { from: "Neoliberalism", label: "welfare party, big-government" },
    { from: "Libertarianism", label: "SJW" },
    { from: "Anarchism", label: "parliamentary fetishist, house pet" },
    { from: "Democratic Socialism", label: "lukewarm, compromiser" },
  ],
  demsoc: [
    { from: "Marxism-Leninism", label: "opportunist, dilettante" },
    { from: "Neoliberalism", label: "utopian dreamer" },
    { from: "Social Democracy", label: "fence-sitter, peacemaker" },
    { from: "Libertarianism", label: "equalizer" },
  ],
  trotskyism: [
    { from: "Stalinism", label: "Trot, splitter" },
    { from: "Neoliberalism", label: "professional revolutionary" },
    { from: "Marxism-Leninism", label: "heretic, permanent opposition" },
    { from: "Anarchism", label: "coup-peddler" },
  ],
  ancom: [
    { from: "Marxism-Leninism", label: "petty-bourgeois malaise, utopian" },
    { from: "Objectivism", label: "utopian believer" },
    { from: "Social Democracy", label: "reform fraud, system dog" },
    { from: "Leninism", label: "centralist red" },
  ],
  progressivism: [
    { from: "Social Conservatism", label: "progressivist, sanctimonious do-gooder" },
    { from: "Reactionaryism", label: "social engineer" },
    { from: "Classical Liberalism", label: "nanny state, too-many-rules" },
    { from: "Marxism-Leninism", label: "petty-bourgeois, fake left" },
  ],
  wokeism: [
    { from: "Social Conservatism", label: "SJW, woke crowd" },
    { from: "Classical Liberalism", label: "PC police" },
    { from: "Social Democracy", label: "culture warrior, debater-bot" },
    { from: "Nationalism", label: "reverse nationalist" },
  ],
  marxfem: [
    { from: "Social Conservatism", label: "feminazi, ultra-leftist" },
    { from: "Libertarianism", label: "man-hater, gender police" },
    { from: "Social Conservatism", label: "separatist" },
  ],
  ecosocialism: [
    { from: "Neoliberalism", label: "eco-leftist, red-green" },
    { from: "Social Democracy", label: "greenwasher, fake eco" },
    { from: "Marxism-Leninism", label: "eco-utopian" },
  ],
  leninism: [
    { from: "Anarchism", label: "vanguard, centralist" },
    { from: "Social Democracy", label: "coup maniac, indoctrinator" },
    { from: "Democratic Socialism", label: "conspiracy clique" },
  ],
  left_populism: [
    { from: "Neoliberalism", label: "populist, wealth-hating mob" },
    { from: "Technocracy", label: "anti-intellectual populist, amateur hour" },
    { from: "Globalism", label: "autarky cultist" },
  ],
  intersectional_fem: [
    { from: "Social Conservatism", label: "feminazi, identity-politics peddler" },
    { from: "Libertarianism", label: "label police, buff-stacker" },
    { from: "Marxist Feminism", label: "splitter left, clique" },
  ],
  nationalism: [
    { from: "Globalism", label: "nationalist, Little Pink" },
    { from: "Anarchism", label: "statist" },
    { from: "Globalism", label: "narrow nationalist, xenophobe" },
    { from: "Social Conservatism", label: "patriotism-for-profit" },
  ],
  fascism: [
    { from: "Classical Liberalism", label: "fascist, dictator" },
    { from: "Marxism-Leninism", label: "reactionary, capitalist lapdog" },
    { from: "Social Democracy", label: "brown-shirt thug, stormtrooper" },
    { from: "Anarchism", label: "order cancer, regulation freak" },
  ],
  stalinism: [
    { from: "Trotskyism", label: "bureaucrat, executioner" },
    { from: "Classical Liberalism", label: "totalitarian, Dear-Leader cultist" },
    { from: "Democratic Socialism", label: "purge fan, gulag fanboy" },
    { from: "Anarchism", label: "iron-fist, purge addict" },
  ],
  authoritarianism: [
    { from: "Libertarianism", label: "authoritarian, docile subject" },
    { from: "Classical Liberalism", label: "servant mindset, kneeler" },
    { from: "Social Democracy", label: "order cancer" },
  ],
  nazism: [
    { from: "Classical Liberalism", label: "Nazi, war criminal" },
    { from: "Globalism", label: "enemy of humanity" },
    { from: "Social Democracy", label: "genocidaire, tumor" },
    { from: "Marxism-Leninism", label: "root of all evil" },
  ],
  ethnonationalism: [
    { from: "Multiculturalism", label: "racist, bloodline theorist" },
    { from: "Globalism", label: "bloodline Nazi, pureblood fetishist" },
    { from: "Multiculturalism", label: "exclusion maniac" },
  ],
  rightwingpopulism: [
    { from: "Globalism", label: "redneck, populist" },
    { from: "Technocracy", label: "anti-intellectual populist, amateur hour" },
    { from: "Social Democracy", label: "elite-hater, anti-intellect" },
  ],
  technocracy: [
    { from: "Anarchism", label: "industrial clique, technocrat" },
    { from: "Democratic Socialism", label: "expert-rule, oligarch" },
    { from: "Anarchism", label: "machine fetishist" },
  ],
  populism: [
    { from: "Technocracy", label: "populist, demagogue" },
    { from: "Globalism", label: "demagogue, amateur hour" },
    { from: "Technocracy", label: "populist opportunist" },
  ],
  totalitarianism: [
    { from: "Libertarianism", label: "totalitarian, Big Brother" },
    { from: "Social Democracy", label: "surveillance freak, panopticon" },
    { from: "Classical Liberalism", label: "enslaver" },
  ],
  neolib: [
    { from: "Democratic Socialism", label: "neoliberal, capitalist mouthpiece" },
    { from: "Nationalism", label: "comprador" },
    { from: "Democratic Socialism", label: "market fundamentalist, privatization maniac" },
    { from: "Nationalism", label: "WTO believer, globalization dog" },
  ],
  libertarianism: [
    { from: "Social Democracy", label: "laissez-faire zealot, man-child" },
    { from: "Authoritarianism", label: "unruly rabble" },
    { from: "Social Democracy", label: "big-gov lapdog, tax slave" },
    { from: "Marxism-Leninism", label: "anarchist dreamer" },
  ],
  objectivism: [
    { from: "Religious Socialism", label: "refined egoist" },
    { from: "Social Conservatism", label: "money-worshipper" },
    { from: "Social Democracy", label: "refined egoist, selfish" },
    { from: "Religious Socialism", label: "money-worship cult leader" },
  ],
  soccons: [
    { from: "Progressivism", label: "conservative, moralist" },
    { from: "Progressivism", label: "foot-binding cloth, old morality" },
    { from: "Libertarianism", label: "morality police" },
  ],
  ultra_capitalism: [
    { from: "Eco-Socialism", label: "capitalist, bloodsucker" },
    { from: "Social Democracy", label: "blood bun, exploitation machine" },
    { from: "Eco-Socialism", label: "earth-drainer" },
  ],
  monarchism: [
    { from: "Classical Liberalism", label: "royalist, diehard old guard" },
    { from: "Democratic Socialism", label: "restoration maniac, crown dreamer" },
    { from: "Classical Liberalism", label: "feudal relic" },
  ],
  social_darwinism: [
    { from: "Religious Socialism", label: "social Darwinist, rat-race king" },
    { from: "Social Democracy", label: "cold-blooded, survival-of-fittest freak" },
    { from: "Religious Socialism", label: "jungle-law believer" },
  ],
  classic_lib: [
    { from: "Nationalism", label: "fifth columnist, liberal pundit" },
    { from: "Marxism-Leninism", label: "liberal, western slave" },
    { from: "Social Conservatism", label: "moral nihilist, rootless" },
  ],
  ancap: [
    { from: "Marxism-Leninism", label: "capitalist fundamentalist, crypto bro" },
    { from: "Authoritarianism", label: "anarchic troublemaker" },
    { from: "Social Democracy", label: "anarcho-capitalist, crypto shaman" },
    { from: "Authoritarianism", label: "privatization fundamentalist" },
  ],
  anarchism: [
    { from: "Authoritarianism", label: "anarchist, punk" },
    { from: "Social Democracy", label: "destructive left, smash-shop gang" },
    { from: "Authoritarianism", label: "chaos source" },
  ],
  transhumanism: [
    { from: "Social Conservatism", label: "digital heretic, cyborg" },
    { from: "Deep Ecology", label: "tech-arrogant" },
    { from: "Social Conservatism", label: "cyber freak, modification maniac" },
    { from: "Deep Ecology", label: "body traitor" },
  ],
  globalism: [
    { from: "Nationalism", label: "citizen of the world, banana" },
    { from: "Nationalism", label: "borderless, world government" },
    { from: "Social Conservatism", label: "citizen of the world, rootless" },
  ],
  deepecology: [
    { from: "Ultra-Capitalism", label: "eco-charlatan, anti-human" },
    { from: "Neo-Luddism", label: "tech disciple, Musk fanboy" },
    { from: "Ultra-Capitalism", label: "anti-human, Thanos" },
    { from: "Techno-Optimism", label: "Luddite charlatan" },
  ],
  georgism: [
    { from: "Objectivism", label: "single-tax believer" },
    { from: "Neoliberalism", label: "land-tax madman, single-tax demon" },
    { from: "Objectivism", label: "soft wealth-robber" },
  ],
  multiculturalism: [
    { from: "Ethno-Nationalism", label: "SJW, sanctimonious do-gooder" },
    { from: "Ethno-Nationalism", label: "cultural relativist, mush" },
    { from: "Social Conservatism", label: "principless inclusion" },
  ],
  effective_accelerationism: [
    { from: "AI Decelerationism", label: "accelerationist, gambler" },
    { from: "Left Accelerationism", label: "capitalist passenger" },
    { from: "Degrowth", label: "gambler, doomsday accelerator" },
    { from: "Left Accelerationism", label: "capitalist free-rider" },
  ],
  ai_decelerationism: [
    { from: "Effective Accelerationism (e/acc)", label: "decelerationist, doomsayer" },
    { from: "Techno-Optimism", label: "regulation lobbyist" },
    { from: "Effective Accelerationism (e/acc)", label: "brake party, fear-monger" },
    { from: "Techno-Optimism", label: "Luddite hypocrisy" },
  ],
  national_conservatism: [
    { from: "Neoliberalism", label: "suit-wearing populist, new right" },
    { from: "Globalism", label: "tariff believer" },
    { from: "Globalism", label: "tariff madman, protectionist" },
    { from: "Social Democracy", label: "new-con, suit hawk" },
  ],
  degrowth: [
    { from: "Techno-Optimism", label: "ascetic monk, anti-growth" },
    { from: "Ultra-Capitalism", label: "economic suicide" },
    { from: "Ultra-Capitalism", label: "anti-growth, ascetic" },
    { from: "Techno-Optimism", label: "techno-phobe" },
  ],
  abundance_agenda: [
    { from: "Degrowth", label: "bulldozer, YIMBY" },
    { from: "Mainstream Environmentalism", label: "developer lobbyist" },
    { from: "Degrowth", label: "bulldozer, growth addict" },
    { from: "Mainstream Environmentalism", label: "fake eco, developer" },
  ],
  nazbol: [
    { from: "Marxism-Leninism", label: "red-brown, opportunist" },
    { from: "Classical Liberalism", label: "frankenstein" },
    { from: "Marxism-Leninism", label: "red-brown frankenstein, opportunist" },
    { from: "Classical Liberalism", label: "both-sides freak" },
  ],
  theocracy: [
    { from: "Classical Liberalism", label: "charlatan, fundamentalist" },
    { from: "Anarchism", label: "religious police" },
    { from: "Classical Liberalism", label: "church-state, burning-fan" },
    { from: "Anarchism", label: "theo police" },
  ],
  anarcho_syndicalism: [
    { from: "Authoritarianism", label: "syndicalist, strike partisan" },
    { from: "Authoritarianism", label: "union bureaucrat, strike theater" },
    { from: "Marxism-Leninism", label: "reform utopia" },
  ],
  state_socialism: [
    { from: "Anarchism", label: "planning-bureau bureaucrat, big-government" },
    { from: "Libertarianism", label: "planned-economy freak, big-gov" },
    { from: "Anarchism", label: "bureaucratic socialism" },
  ],
  anarcho_mutualism: [
    { from: "Marxism-Leninism", label: "small producer, Proudhonist" },
    { from: "Neoliberalism", label: "small producer, utopia" },
    { from: "Marxism-Leninism", label: "Proudhon parrot" },
  ],
  religious_socialism: [
    { from: "Objectivism", label: "revolutionary priest, red believer" },
    { from: "Objectivism", label: "god-left, red priest" },
    { from: "Classical Liberalism", label: "theo-socialist" },
  ],
  de_leonism: [
    { from: "Neoliberalism", label: "dogmatist" },
    { from: "Neoliberalism", label: "union bureaucrat, dogmatist" },
    { from: "Marxism-Leninism", label: "syndicalist utopia" },
  ],
  social_liberalism: [
    { from: "Marxism-Leninism", label: "reformist, SJW" },
    { from: "Marxism-Leninism", label: "pink left, SJW" },
    { from: "Neoliberalism", label: "centrist, mush" },
  ],
  left_accelerationism: [
    { from: "Neo-Luddism", label: "acceleration master, cyber-left" },
    { from: "Neo-Luddism", label: "cyber-left, acceleration master" },
    { from: "Democratic Socialism", label: "left tech nerd" },
  ],
  civicnationalism: [
    { from: "Ethno-Nationalism", label: "moderate, constitutionalist" },
    { from: "Ethno-Nationalism", label: "soft nation, constitution fetishist" },
    { from: "Globalism", label: "mild exclusionist" },
  ],
  ecofascism: [
    { from: "Mainstream Environmentalism", label: "eco-fascist, Thanos believer" },
    { from: "Mainstream Environmentalism", label: "eco-Nazi, Thanos" },
    { from: "Social Democracy", label: "green-brown frankenstein" },
  ],
  state_capitalism: [
    { from: "Libertarianism", label: "crony capital, SOE bureaucrat" },
    { from: "Libertarianism", label: "crony capital, red-cap" },
    { from: "Social Democracy", label: "SOE bureaucrat" },
  ],
  theocratic_socialism: [
    { from: "Marxism-Leninism", label: "charlatan, frankenstein" },
    { from: "Marxism-Leninism", label: "theo-left, frankenstein" },
    { from: "Classical Liberalism", label: "church-state mutant" },
  ],
  global_totalitarianism: [
    { from: "Libertarianism", label: "Big Brother, new world order" },
    { from: "Libertarianism", label: "world government, new order" },
    { from: "Nationalism", label: "global iron curtain" },
  ],
  authoritarian_capitalism: [
    { from: "Social Democracy", label: "authoritarian comprador, sweatshop foreman" },
    { from: "Social Democracy", label: "authoritarian comprador, sweatshop" },
    { from: "Libertarianism", label: "state-capital freak" },
  ],
  anarchoegoism: [
    { from: "Social Conservatism", label: "nihilist, egoist freak" },
    { from: "Social Conservatism", label: "nihilist freak, ego maniac" },
    { from: "Marxism-Leninism", label: "anarcho-individual" },
  ],
  effectivealtruism: [
    { from: "Religious Socialism", label: "spreadsheet charity, utilitarian" },
    { from: "Religious Socialism", label: "spreadsheet charity, utilitarian" },
    { from: "Social Conservatism", label: "cold-blooded algorithm" },
  ],
  anarchoprimitivism: [
    { from: "Techno-Optimism", label: "caveman, Luddite" },
    { from: "Techno-Optimism", label: "caveman, Luddite" },
    { from: "Ultra-Capitalism", label: "anti-civilization" },
  ],
  thirdway: [
    { from: "Democratic Socialism", label: "fence-sitter, establishment" },
    { from: "Democratic Socialism", label: "fence-sitter, establishment" },
    { from: "Neoliberalism", label: "middle arbitrageur" },
  ],
  environmentalism: [
    { from: "Deep Ecology", label: "performative environmentalist, shallow green" },
    { from: "Deep Ecology", label: "shallow green, performative eco" },
    { from: "Ultra-Capitalism", label: "greenwash" },
  ],
  cyberlibertarianism: [
    { from: "Authoritarianism", label: "crypto bro, digital nomad" },
    { from: "Authoritarianism", label: "crypto anarchist, digital nomad" },
    { from: "Social Democracy", label: "crypto liberal" },
  ],
  market_anarchism: [
    { from: "Marxism-Leninism", label: "market utopian" },
    { from: "Marxism-Leninism", label: "market utopia, private-property left" },
    { from: "Authoritarianism", label: "anarcho-market" },
  ],
  religious_anarchism: [
    { from: "Authoritarianism", label: "reclusive believer" },
    { from: "Authoritarianism", label: "reclusive believer, mountain man" },
    { from: "Scientism", label: "superstitious anarchist" },
  ],
  social_libertarianism: [
    { from: "Objectivism", label: "UBI-pusher, UBI believer" },
    { from: "Objectivism", label: "UBI-pusher, UBI believer" },
    { from: "Social Conservatism", label: "progressive liberal" },
  ],
  christian_democracy: [
    { from: "Progressivism", label: "church establishment" },
    { from: "Progressivism", label: "church establishment, cross faction" },
    { from: "Marxism-Leninism", label: "mild theo" },
  ],
  distributism: [
    { from: "Neoliberalism", label: "peasant utopian" },
    { from: "Neoliberalism", label: "peasant utopia, workshop fetishist" },
    { from: "Social Democracy", label: "anti-scale" },
  ],
  moderate_conservatism: [
    { from: "Progressivism", label: "nice guy, conservative" },
    { from: "Progressivism", label: "nice guy, peacemaker" },
    { from: "Reactionaryism", label: "mild old guard" },
  ],
  neo_conservatism: [
    { from: "Left-Wing Populism", label: "war monger, hawk" },
    { from: "Left-Wing Populism", label: "war hawk, neo-con" },
    { from: "Social Democracy", label: "interventionist" },
  ],
  darkenlightenment: [
    { from: "Classical Liberalism", label: "neo-reactionary, restorationist" },
    { from: "Classical Liberalism", label: "neo-reactionary, restoration" },
    { from: "Progressivism", label: "tech-feudal fetishist" },
  ],
  radfem: [
    { from: "Social Conservatism", label: "radical feminazi, 6B4T" },
    { from: "Social Conservatism", label: "radical feminazi, man-cutter" },
    { from: "Marxist Feminism", label: "separatist" },
  ],
  reactionary: [
    { from: "Progressivism", label: "reactionary, diehard old guard" },
    { from: "Progressivism", label: "reactionary, restorationist" },
    { from: "Social Democracy", label: "old-order fetishist" },
  ],
  liberalfeminism: [
    { from: "Marxist Feminism", label: "western feminist, socialite feminist" },
    { from: "Marxist Feminism", label: "white feminism, socialite" },
    { from: "Social Conservatism", label: "bourgeois feminism" },
  ],
  neoluddism: [
    { from: "Techno-Optimism", label: "Luddite, log-off cult" },
    { from: "Techno-Optimism", label: "Luddite, log-off cult" },
    { from: "Ultra-Capitalism", label: "anti-machine" },
  ],
  hidden_centrist: [
    { from: "Ideology Overdose", label: "false-neutral poseur, balance-keeper" },
    { from: "Left-Wing Populism", label: "fence-sitter" },
    { from: "Left-Wing Populism", label: "fence-sitter, mush" },
    { from: "Online Left", label: "peaceful apolitical, neutral actor" },
  ],
  hidden_maniac: [
    { from: "Professional Fence-Sitter", label: "overdosed zealot, entertainment source" },
    { from: "Social Democracy", label: "extreme nut, binary thinker" },
    { from: "Little Pink", label: "overdosed pink, battle pink" },
  ],
  continuous_revolution: [
    { from: "Neoliberalism", label: "ultra-leftist, rebel" },
    { from: "Stalinism", label: "adventurism, smash-everything" },
    { from: "Trotskyism", label: "knock-off, populist bureaucrat" },
    { from: "Social Democracy", label: "adventurist, smash party" },
    { from: "Democratic Socialism", label: "permanent-revolution madman" },
  ],
  mysticism: [
    { from: "Scientism", label: "charlatan, shaman" },
    { from: "Dialectical Materialism", label: "idealist, hocus-pocus" },
    { from: "Progressivism", label: "mystic escapist, recluse" },
    { from: "Classical Liberalism", label: "anti-reason mystic" },
  ],
  new_age: [
    { from: "Scientism", label: "pseudoscience, IQ tax" },
    { from: "Dialectical Materialism", label: "spiritual opium, leek" },
    { from: "Social Conservatism", label: "spirituality fraud" },
    { from: "Objectivism", label: "self-help guru" },
  ],
  dialectical_materialism: [
    { from: "Mysticism", label: "vulgar materialist, atheist" },
    { from: "Classical Liberalism", label: "dogmatist, textbook parrot" },
    { from: "Social Conservatism", label: "godless freak, cold-blooded" },
    { from: "Progressivism", label: "historical-determinism maniac" },
  ],
  scientism: [
    { from: "Mysticism", label: "rational fundamentalist, disenchantment zealot" },
    { from: "Traditionalism", label: "modernity enforcer, instrumental reason" },
    { from: "Social Conservatism", label: "scienology, instrumental reason" },
    { from: "Progressivism", label: "tech worship" },
  ],
  traditionalism: [
    { from: "Scientism", label: "occult old guard, necromancer" },
    { from: "Progressivism", label: "reactionary, living fossil" },
    { from: "Democratic Socialism", label: "feudal fetishist" },
    { from: "Classical Liberalism", label: "restoration maniac" },
  ],
  net_troll: [
    { from: "Ideology Overdose", label: "for-the-lulz, spectator" },
    { from: "Professional Fence-Sitter", label: "shit-stirrer, hype-stirrer" },
    { from: "Little Pink", label: "troll-baiter, flame-starter" },
    { from: "Online Left", label: "debate-for-lulz" },
  ],
  net_left: [
    { from: "Online Right", label: "Online Left, keyboard activist" },
    { from: "Neoliberalism", label: "young radical, red-banner army" },
    { from: "Little Pink", label: "left circle, charger" },
    { from: "Nationalism", label: "reverse young radical" },
  ],
  net_right: [
    { from: "Online Left", label: "Online Right, liberal pundit" },
    { from: "Nationalism", label: "western-bootlicker, China-hater" },
    { from: "Social Democracy", label: "right circle, charger" },
    { from: "Globalism", label: "colonized-mind right" },
  ],
  net_pink: [
    { from: "The Colonized Mind", label: "Little Pink, Boxer" },
    { from: "Libertarianism", label: "Wolf Warrior, flag-defender" },
    { from: "Online Left", label: "patriotic charger" },
    { from: "Professional Fence-Sitter", label: "emotional pink, battle pink" },
  ],
  net_base: [
    { from: "The Colonized Mind", label: "peaceful apolitical, the base" },
    { from: "Online Left", label: "silent majority" },
    { from: "Little Pink", label: "stable faction, spectator" },
    { from: "Online Right", label: "silent base" },
  ],
  net_nonbase: [
    { from: "Little Pink", label: "non-base, pundit seedling" },
    { from: "The Base", label: "fence-sitter" },
    { from: "Online Right", label: "swing faction" },
    { from: "The Colonized Mind", label: "marginal" },
  ],
  net_colonized: [
    { from: "Little Pink", label: "colonized mind, western-bootlicker" },
    { from: "Nationalism", label: "fifth columnist, spiritual foreign guest" },
    { from: "Online Left", label: "spiritual foreigner" },
    { from: "Professional Fence-Sitter", label: "west-worshipper" },
  ],

  // ============ v1.6 Religious traditions ============
  islamism: [
    { from: "Social Liberalism", label: "fundamentalist, Sharia party" },
    { from: "Libertarianism", label: "theocratic lunatic" },
  ],
  islamic_democracy: [
    { from: "Social Liberalism", label: "Green Party, mild Islamist" },
    { from: "Islamism", label: "soft compromiser" },
  ],
  hindu_nationalism: [
    { from: "Civic Nationalism", label: "civilizational chauvinist, RSS" },
    { from: "Globalism", label: "Hindu Taliban" },
  ],
  buddhism: [
    { from: "Scientism", label: "superstitious, karma party" },
    { from: "Right-Wing Populism", label: "zen slacker, lying-flat monk" },
  ],
  confucianism: [
    { from: "Liberal Feminism", label: "patriarchal, rites-and-rites party" },
    { from: "Anarchism", label: "hierarchy freak, old fossil" },
  ],
};
