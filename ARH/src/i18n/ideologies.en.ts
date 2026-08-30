// 意识形态概要英译：id → { serious_analysis, hat }。
// serious_analysis 用于无深度档案条目的 §01/§06；hat 用于附录A回退标签。
export const IDEOLOGY_EN: Record<string, { serious_analysis: string; hat: string }> = {
  // ===== 左 =====
  ml: { serious_analysis: 'Absolute public ownership established through violent revolution.', hat: 'Unrepentant ultra-left remnant' },
  continuous_revolution: { serious_analysis: 'Believes class struggle persists after seizing power and must be sustained through mass movements to prevent a privileged class from restoring itself.', hat: 'Rebel who treats every order as a target' },
  trotskyism: { serious_analysis: 'Advocates permanent world revolution and opposes bureaucracy.', hat: 'Perpetual-motion wrecking ball' },
  ancom: { serious_analysis: 'A voluntary, decentralized society based on free communes and distribution by need.', hat: 'Utopian cultist living in a dream' },
  socdem: { serious_analysis: 'Welfarism within the capitalist framework.', hat: 'Spineless scab kept by the bourgeoisie' },
  marxfem: { serious_analysis: 'Women’s liberation achieved through class struggle.', hat: 'Class trouble-maker who destabilizes the family' },
  demsoc: { serious_analysis: 'Democratizing the relations of production into public ownership.', hat: 'Dreamer who wants roses in a cesspit' },
  ecosocialism: { serious_analysis: 'An ecological planned economy that abolishes the logic of accumulation.', hat: 'Red-washed green freak stitching contradictions' },
  progressivism: { serious_analysis: 'Constantly perfecting society through rational engineering.', hat: 'Self-righteous universalist heresy' },
  intersectional_fem: { serious_analysis: 'Attends to oppression woven from multiple intersecting identities.', hat: 'Stacking-buff menace who manufactures gender civil war' },
  wokeism: { serious_analysis: 'Achieving equality through cultural deconstruction.', hat: 'Degenerate seedling that deconstructs civilization' },
  radfem: { serious_analysis: 'Thoroughly dismantle the patriarchal system and culture.', hat: 'Gender Nazi who sees the opposite sex as cancer' },
  anarcho_syndicalism: { serious_analysis: 'Unions directly take over and manage production.', hat: 'Union tumor that paralyzes production' },
  leninism: { serious_analysis: 'A highly disciplined theory of seizing power.', hat: 'Precision gear on the seizure machine' },
  state_socialism: { serious_analysis: 'State monopolizes resources and allocates them administratively.', hat: 'Zombie bureaucrat who plans everything' },
  anarcho_mutualism: { serious_analysis: 'A voluntary exchange order based on labor.', hat: 'Parasitic bug in the cracks of capital' },
  religious_socialism: { serious_analysis: 'A fusion of religious ethics and class analysis.', hat: 'Fake believer waving a red flag' },
  de_leonism: { serious_analysis: 'A fusion of Marxism and syndicalist management.', hat: 'Doctrinaire fundamentalist' },
  social_liberalism: { serious_analysis: 'Mild interventionism within the existing system.', hat: 'Reformist who paints lipstick on the guillotine' },

  // ===== 兔 =====
  nationalism: { serious_analysis: 'Treats national strength as the highest identity.', hat: 'Brain-dead fuel boiling with blind fervor' },
  authoritarianism: { serious_analysis: 'Highly concentrated power that takes order as its premise.', hat: 'Submissive slave who licks the iron fist' },
  stalinism: { serious_analysis: 'A totalitarian system and a strong-state industrial practice.', hat: 'Purge-obsessed despot of the dictatorship' },
  fascism: { serious_analysis: 'Rejects liberty and pursues total mobilization and expansion.', hat: 'Irrational butcher of violence' },
  totalitarianism: { serious_analysis: 'Expands power to utterly erase private life.', hat: 'Loyal hound at Big Brother’s feet' },
  rightwingpopulism: { serious_analysis: 'Nativism and anti-elite mobilization.', hat: 'Wall-building crawler defending "common sense"' },
  technocracy: { serious_analysis: 'Managed by experts on the basis of reason and data.', hat: 'Heartless digitized foreman' },
  reactionary: { serious_analysis: 'Denies modernity and returns to tradition.', hat: 'Diehard who wants to crawl back to feudalism' },
  civicnationalism: { serious_analysis: 'Inclusive identity based on political principles.', hat: 'Mild flag-guarding establishment fence-sitter' },
  ethnonationalism: { serious_analysis: 'A theory that sovereignty follows racial boundaries.', hat: 'Primitive monkey obsessing over bloodlines' },
  ecofascism: { serious_analysis: 'Combines environmentalism with racism.', hat: 'Genocidal eco-tyrant' },
  nazism: { serious_analysis: 'Extreme racist fascism.', hat: 'Racial butcher who ends civilization' },
  state_capitalism: { serious_analysis: 'State intervenes in the market to control core resources.', hat: 'GDP fuel left over from the elite’s carve-up' },
  theocratic_socialism: { serious_analysis: 'A fusion of wealth redistribution and religious dogma.', hat: 'Freak stitching scripture to the planning sheet' },
  global_totalitarianism: { serious_analysis: 'Eliminates all sovereign liberty.', hat: 'Global parasite that locks history' },
  authoritarian_capitalism: { serious_analysis: 'A market model that guarantees political control.', hat: 'Black-hearted foreman who buys off slaves’ liberty' },

  // ===== 神 =====
  classic_lib: { serious_analysis: 'A deconstructionist creed where individual rights trump all.', hat: 'Collaborator-mentor who kneels to the colonizers' },
  ancap: { serious_analysis: 'Abolish the state; hand its functions to the market.', hat: 'Money-worshipping lord who values life like grass' },
  globalism: { serious_analysis: 'Dissolves borders in pursuit of global consensus.', hat: 'Traitorous mouthpiece who forgets their roots' },
  anarchism: { serious_analysis: 'Pursues total individual freedom and anti-rule.', hat: 'Nihilist worm that smashes order' },
  anarchoegoism: { serious_analysis: 'Deconstructs collective concepts; only desire is real.', hat: 'Nihilist worm who deconstructs everything' },
  'techno-optimism': { serious_analysis: 'Pursues extreme scientific governance and iteration.', hat: 'Progress seedling of crude techno-determinism' },
  transhumanism: { serious_analysis: 'An evolution that thoroughly breaks natural limits.', hat: 'Electronic heretic who would abandon the ancestors' },
  deepecology: { serious_analysis: 'Denies human priority and seeks primal balance.', hat: 'Typical charlatan who sees humanity as a tumor' },
  neoluddism: { serious_analysis: 'Advocates downgrading technology to preserve dignity.', hat: 'Historical garbage who would smash the future' },
  effectivealtruism: { serious_analysis: 'An elite stance where pure reason replaces emotion.', hat: 'Machine that calculates humanity with Excel' },
  anarchoprimitivism: { serious_analysis: 'Holds that foraging life is the source of freedom.', hat: 'Cyber-savage who wants to chew dirt in a cave' },
  populism: { serious_analysis: 'The political logic of anti-elitism.', hat: 'Opportunistic stirring crawler' },
  multiculturalism: { serious_analysis: 'Recognizes the distinct identity of each group.', hat: 'Self-destructive mouthpiece who welcomes wolves in' },
  thirdway: { serious_analysis: 'Seeks the market balance between intervention and liberty.', hat: 'Bottomless centrist eel' },
  environmentalism: { serious_analysis: 'Mild ecological repair within the framework.', hat: 'Stage actor performing in an air-conditioned room' },
  cyberlibertarianism: { serious_analysis: 'Builds a borderless ideal cryptographic society.', hat: 'Digital bandit hiding behind algorithms' },
  market_anarchism: { serious_analysis: 'A decentralized, non-exploitative market order.', hat: 'Oddball who imagines the market yields equality' },
  religious_anarchism: { serious_analysis: 'Rejects all unjust secular government.', hat: 'Fanatic who answers to no master but the divine' },
  social_libertarianism: { serious_analysis: 'Replaces bureaucracy with a basic income.', hat: 'Digital beggar who buys liberty with dole' },

  // ===== 右 =====
  neolib: { serious_analysis: 'Deregulation and competition as the governing core.', hat: 'Vampire bat of capital’s globalization' },
  objectivism: { serious_analysis: 'Rational self-interest as the highest virtue.', hat: 'Rational beast selfish to the bone' },
  soccons: { serious_analysis: 'Upholds traditional religion and moral custom.', hat: 'Moralist guarding moldy bound feet' },
  libertarianism: { serious_analysis: 'Shrinks the state, keeps absolute property rights.', hat: 'Atomized rascal who wants rights but no face' },
  liberalfeminism: { serious_analysis: 'Legal equality within the framework, with a middle-class tint.', hat: 'Parasite of privilege detached from the masses' },
  christian_democracy: { serious_analysis: 'A market theory joining religious morality and democracy.', hat: 'Establishment fence-sitter cloaked in religion' },
  distributism: { serious_analysis: 'Lets everyone own the means of production.', hat: 'Old dreamer who wants to farm in the Middle Ages' },
  moderate_conservatism: { serious_analysis: 'Minimal evolution within the existing system.', hat: 'Good-for-nothing who brakes civilization’s fall' },
  neo_conservatism: { serious_analysis: 'Establishes international order through military hard power.', hat: 'War profiteer who exports democracy with missiles' },
  ultra_capitalism: { serious_analysis: 'Extreme capital expansion that sees the non-market as an obstacle.', hat: 'Profit-devourer who harvests even the air' },
  darkenlightenment: { serious_analysis: 'Wholly rejects the Enlightenment and returns to formal hierarchy; treats the state as a corporate entity in pursuit of ultimate performance and tech acceleration.', hat: 'Cyber-monarch who would lock up civilization' },
  monarchism: { serious_analysis: 'Advocates the legitimate rule of hereditary monarchy.', hat: 'Queue-wearing philosopher begging for a true dragon' },

  // ===== v1.1 =====
  left_accelerationism: { serious_analysis: 'Uses tech acceleration to traverse and collapse capitalism.', hat: 'Madman who rides capital’s fast horse toward public ownership' },
  left_populism: { serious_analysis: 'Economic radicalism pitting the people against the elite.', hat: 'Rich-hating mad dog who bites at the sight of elites' },
  social_darwinism: { serious_analysis: 'Applies natural selection to social competition.', hat: 'Beast with jungle law tattooed on its forehead' },
  georgism: { serious_analysis: 'A single-tax doctrine returning land value to the public.', hat: 'Single-tax charlatan fixated on land rent' },

  // ===== v1.2 =====
  effective_accelerationism: { serious_analysis: 'Holds that tech-capital acceleration is unstoppable and broadly good, opposing all precautionary regulation.', hat: 'Cyber-priest sacrificing humanity to the god of thermodynamics' },
  ai_decelerationism: { serious_analysis: 'Holds runaway AI is an existential risk and advocates a global pause or strict control of frontier research.', hat: 'Doomsday cultist trembling with apocalyptic prophecy' },
  national_conservatism: { serious_analysis: 'A new-right current that corrects free-market orthodoxy with national tradition and state intervention.', hat: 'Academy freak stitching a suit onto populism' },
  degrowth: { serious_analysis: 'Voluntarily shrinks the material output of rich nations back within planetary boundaries.', hat: 'Ascetic who tightens everyone’s belt' },
  abundance_agenda: { serious_analysis: 'Achieves progressive goals through supply expansion and state-building capacity.', hat: 'Bulldozer liberal who finds the EIA too slow' },
  nazbol: { serious_analysis: 'A hybrid ideology of public economy and extreme nationalism.', hat: 'Freak who welds the hammer-and-sickle onto the imperial eagle' },
  theocracy: { serious_analysis: 'State power exercised directly by religious authority under divine law.', hat: 'Living fossil who takes scripture as constitution' },

  // ===== v1.4 神秘主义系 =====
  mysticism: { serious_analysis: 'Holds that transcendent, mysterious forces stand above verifiable material laws, and that the ultimate truth of the world is grasped through intuition, revelation, and ritual.', hat: 'Spirit-medium charlatan who takes mysticism for truth' },
  new_age: { serious_analysis: 'Fuses personal spiritual experience with Eastern mysticism and self-actualization discourse, believing that thought and vibrational frequency can directly affect reality.', hat: 'Leek who mistakes mind-body-spirit consumption for practice' },
  dialectical_materialism: { serious_analysis: 'Premised on the primacy of matter, it explains the development of nature, society, and thought through contradiction, quantitative-qualitative change, and negation of the negation.', hat: 'Textbook repeater who opens with "matter is primary"' },
  scientism: { serious_analysis: 'Holds that the natural-scientific method is the only path to all truth, rejecting value judgments and metaphysical claims that cannot be empirically verified.', hat: 'Rational fundamentalist who takes the verifiable as the only faith' },
  traditionalism: { serious_analysis: 'Believes a single primordial sacred wisdom lies behind all traditions, sees modern secularization as a degenerate stage of the cosmic cycle, and advocates returning to a hierarchical sacred order.', hat: 'Occult diehard who summons the golden age' },

  // ===== v1.6 宗教类型扩充 =====
  islamism: { serious_analysis: 'Seeks to bring public and private life fully under Islamic law, rejecting the secular nation-state’s separation of religion and state.', hat: 'Theocrat who takes scripture for a constitution' },
  islamic_democracy: { serious_analysis: 'A third way that operates democratic elections while embedding Islamic values and ethics.', hat: 'Moderate caught between faith and ballot' },
  hindu_nationalism: { serious_analysis: 'Grounds India’s national identity in Hindu civilization and asserts the dominant role of the majority religious community.', hat: 'Civilizational chauvinist who defines the nation by faith' },
  buddhism: { serious_analysis: 'An ethics of dependent origination, compassion, and non-violence that distances itself from nationalism and leans toward eco-centrism.', hat: 'World-renouncer who preaches release yet wants to save the world' },
  confucianism: { serious_analysis: 'A politics of ren, rites, and proper relations whose legitimacy rests on virtuous governance and moral education.', hat: 'Old master who preaches humane rule yet defends hierarchy' },

  // ===== 隐藏结局 =====
  hidden_centrist: {
    serious_analysis: 'You chose neutral on more than a third of the propositions. Either you truly reached a delicate balance after reading widely, or you simply hid yourself from the system. This archive refuses to assign coordinates to fence-sitters. Retake the test — this time with some sincerity.',
    hat: 'Master of the end-weighing art with no stance at all',
  },
  hidden_maniac: {
    serious_analysis: 'You picked the most extreme option on almost every proposition, but these extremes contradict one another — you simultaneously and strongly support mutually contradictory positions, and your coordinates cancel out back to the origin. This is not conviction; it is a stress response. Real believers are self-consistent; you are more like someone who wants to fire a shot at everything they see. Log off, drink water.',
    hat: 'Pure saint of ideology at maximum concentration',
  },
  net_troll: {
    serious_analysis: 'Your answers show classic "for the lulz" traits: positions swing back and forth across dimensions, extremes and wobbles coexist, coherence is low but short of maniac. You may not sincerely hold any side — you just enjoy jumping in to stir the pot and escalate the drama. The system cannot issue coordinates to a spectator, because you never intended to stand.',
    hat: 'Troublemaking onlooker who only wants to watch the show',
  },
  net_left: {
    serious_analysis: 'Your economic stance clearly leans public and redistributive; culturally you lean progressive. In Chinese online discourse this combination is called "net-left" — not a specific school but a debating label: anti-capital, talks exploitation, hypersensitive to the word "capitalist." In its most direct form, which book you actually read no longer matters.',
    hat: 'Keyboard warrior who says "exploitation" and "capitalist" on sight',
  },
  net_right: {
    serious_analysis: 'Your economy leans market, your power axis leans individual liberty. Chinese online discourse calls this "net-right": believes in free markets, opposes over-regulation, often tied to libertarian and public-intellectual labels. It is a debating identity, not a strict party program — at full purity, stance precedes argument.',
    hat: 'Public-intellectual disciple who takes the free market as scripture',
  },
  net_pink: {
    serious_analysis: 'You stand highly consistently on the side of the state across the identity and order axes. You may not have read any theory, but once national dignity is involved your fighting spirit spikes instantly. This is not a complete ideology but a network emotional posture: loyal, flammable, prioritizing stance over factual discussion. At full purity it overrides every specific claim.',
    hat: 'Keyboard flag-guard who asks about stance before anything',
  },
  net_base: {
    serious_analysis: 'You identify with the mainstream and trust order, but without the fanaticism of the "little pinks." You are the silent majority every regime wants to hold firmly: no stirring, wants stability, naturally fond of grand narratives. Your coordinates sit close to the system; in online debate you are defaulted as one of us.',
    hat: 'Silent majority who enjoys the quiet life',
  },
  net_nonbase: {
    serious_analysis: 'You lean global and individual-liberty, keeping distance from local grand narratives but far from the "colonized mind" extreme. In the base/non-base split you are placed in the latter: not a reliable mobilization target, yet hardly an enemy — a middle ground that could leak away or be won over at any time.',
    hat: 'Onlooker physically present but mentally absent',
  },
  net_colonized: {
    serious_analysis: 'You tilt entirely outward on the identity axis, compounded by a strong preference for market and individual liberty. To critics this combination is derided as the "colonized mind" — spiritually recognizing foreign order as master. This is among the most aggressive labels in Chinese online discourse; this report only records the existence of that discourse and how well your coordinates fit it, passing no value judgment.',
    hat: 'Quasi-reserve of the mentally emigrated who leads the way',
  },
};
