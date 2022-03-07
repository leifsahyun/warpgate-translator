const fs = require('fs').promises;
const pluralize = require('pluralize');
const jwt = require('jsonwebtoken');

export default async function (req, res) {
	var token = req.headers["authorization"].replace("Bearer", "").trim();
	jwt.verify(token, process.env.WARPGATE_SECRET);
	var response = null;
	if(req.body && req.body.character)
	{
		response = processCharacter(req.body.character, req.body.power);
	}
	else
	{
		response = await newCharacter();
	}
	res.status(200).json(response);
}

async function newCharacter()
{
	const schema = await loadSchema("dnd_5e");
	const charBase = schema["character"];
	var character = {};
	var choices = [];
	Object.keys(charBase).forEach(attribute => {
		if(!charBase[attribute].requirements)
		{
			character[attribute] = null;
			var criteria = charBase[attribute];
			criteria.attributeName = attribute;
			choices.push(criteria);
		}
	});
	return {character: character, choices: choices};
}

async function loadSchema(system) {
	const data = await fs.readFile("pages/api/systems/"+system+"/schema.json", "utf-8");
	return JSON.parse(data);
}

function processCharacter(character, power) {
	if(!character.level)
	{
		character.level = Math.floor(power * 20);
		if(character.stats)
		{
			var abilityIncreases = Math.floor(character.level/4) * 2;
			while(abilityIncreases>0)
			{
				var maxStat = Object.keys(character.stats).filter(stat => character.stats[stat]<20).sort((a,b)=>character.stats[b]-character.stats[a])[0];
				character.stats[maxStat]++;
				abilityIncreases--;
			}
		}
	}
	character.proficiency = Math.floor((character.level-1)/4)+2;
		
	var choices = [];
	if(character.class)
	{
		const charClass = character.class.toLowerCase();
		character.savingThrows = savingThrows[charClass];
		character.skills.splice(numSkills[charClass]);
		character.subclass = subclasses[charClass];
		if(character.stats.constitution)
		{
			const conBonus = getStatBonus(character.stats.constitution);
			character.hp = hpPerLevel[charClass] + Math.floor((hpPerLevel[charClass] + 1) * (character.level - 1) / 2) + conBonus * character.level;
		}
		if (!character.spells && spellsAvailable[charClass])
		{
			var spellSlots = spellsAvailable[charClass](character);
			var maxSpellLevel = Math.floor((character.level+1)/2);
			if(charClass == 'paladin' || charClass == 'ranger')
				maxSpellLevel = Math.floor((character.level-1)/4)+1;
			choices.push({
				filterExamplesBy: [charClass, [1, maxSpellLevel]],
				attributeName: 'spells',
				fixedSource: true,
				number: spellSlots
			});
		}
		if(!character.features)
		{
			character.features = [];
			for(var i=0; i<character.level; i++)
			{
				var variableFeatures = {};
				classFeatures[charClass][i].forEach(feature => {
					if(typeof feature === 'string')
					{
						character.features.push(feature);
					}
					else
					{
						var name = Object.keys(feature)[0];
						variableFeatures[name] = feature[name];
					}
				});
				Object.keys(variableFeatures).forEach(name => {
					character.features.push(name+": "+variableFeatures[name]);
				})
			}
		}
		if(!character.equipment)
		{
			choices.push({
				filterExamplesBy: [charClass, character.level],
				attributeName: 'equipment'
			});
		}
	}
	return {character: character, choices: choices};
}

function getStatBonus(stat)
{
	var statInt = parseInt(stat);
	return Math.floor((statInt-10)/2);
}

const subclasses = {
	barbarian: 'Path of the Berserker',
	bard: 'College of Lore',
	cleric: 'Life Domain',
	druid: 'Circle of the Land',
	fighter: 'Champion',
	monk: 'Way of the Open Hand',
	paladin: 'Oath of Devotion',
	ranger: 'Hunter',
	rogue: 'Thief',
	sorcerer: 'Draconic Bloodline',
	warlock: 'The Fiend',
	wizard: 'School of Evocation'
};

const numSkills = {
	barbarian: 4,
	bard: 5,
	cleric: 4,
	druid: 4,
	fighter: 4,
	monk: 4,
	paladin: 4,
	ranger: 5,
	rogue: 6,
	sorcerer: 4,
	warlock: 4,
	wizard: 4
};

const hpPerLevel = {
	barbarian: 12,
	bard: 8,
	cleric: 8,
	druid: 8,
	fighter: 10,
	monk: 8,
	paladin: 10,
	ranger: 10,
	rogue: 10,
	sorcerer: 6,
	warlock: 8,
	wizard: 6
};

const spellsAvailable = {
	bard: character => character.level+3, 
	cleric: character => character.level+getStatBonus(character.stats.wisdom),
	druid: character => character.level+getStatBonus(character.stats.wisdom),
	sorcerer: character => character.level+1,
	warlock: character => character.level+1,
	wizard: character => character.level+getStatBonus(character.stats.intelligence),
	paladin: character => Math.floor(character.level/2)+getStatBonus(character.stats.charisma),
	ranger: character => Math.ceiling(character.level/2.0)+1
};

const savingThrows = {
	barbarian: ['Strength', 'Constitution'],
	bard: ['Dexterity', 'Charisma'],
	cleric: ['Wisdom', 'Charisma'],
	druid: ['Intelligence', 'Wisdom'],
	fighter: ['Strength', 'Constitution'],
	monk: ['Strength', 'Dexterity'],
	paladin: ['Wisdom', 'Charisma'],
	ranger: ['Strength', 'Dexterity'],
	rogue: ['Dexterity', 'Intelligence'],
	sorcerer: ['Constitution', 'Charisma'],
	warlock: ['Charisma', 'Wisdom'],
	wizard: ['Intelligence', 'Wisdom']
};

const classFeatures = {
	barbarian: [
		[{Rage: '2/rest, +2 damage'}, 'Unarmored Defense'],
		['Reckless Attack', 'Danger Sense'],
		[{Rage: '3/rest, +2 damage'}, 'Frenzy'],
		[],
		['Extra Attack', 'Fast Movement'],
		[{Rage: '4/rest, +2 damage'}, 'Mindless Rage'],
		['Feral Instinct'],
		[],
		[{Rage: '4/rest, +3 damage'}, {'Brutal Critical': '1 die'}],
		['Intimidating Presence'],
		['Relentless Rage'],
		[{Rage: '5/rest, +3 damage'}],
		[{'Brutal Critical': '2 dice'}],
		['Retaliation'],
		['Persistent Rage'],
		[{Rage: '5/rest, +4 damage'}],
		[{'Brutal Critical': '3 dice'}, {Rage: '6/rest, +4 damage'}],
		['Indomitable Might'],
		[],
		['Primal Champion', {Rage: 'Unlimited, +4 damage'}]
	],
	bard: [
		['Spellcasting', {'Bardic Inspiration': 'd6'}],
		['Jack of All Trades', {'Song of Rest': 'd6'}],
		['Expertise', 'Bonus Proficiencies', 'Cutting Words'],
		[],
		['Font of Inspiration', {'Bardic Inspiration': 'd8'}],
		['Countercharm', {'Magical Secrets': '2 spells'}],
		[],
		[],
		[{'Song of Rest': 'd8'}],
		[{'Bardic Inspiration': 'd10'}, 'Additional Expertise', {'Magical Secrets': '4 spells'}],
		[],
		[],
		[{'Song of Rest': 'd10'}],
		[{'Magical Secrets': '6 spells'}, 'Peerless Skill'],
		[{'Bardic Inspiration': 'd12'}],
		[],
		[{'Song of Rest': 'd12'}],
		[{'Magical Secrets': '8 spells'}],
		[],
		['Superior Inspiration']
	],
	cleric: [
		['Spellcasting', 'Divine Domain'],
		[{'Channel Divinity': '1/rest'}, 'Preserve Life'],
		[],
		[],
		[{'Destroy Undead': 'CR 1/2'}],
		[{'Channel Divinity': '2/rest'}, 'Blessed Healer'],
		[],
		[{'Destroy Undead': 'CR 1'}, 'Divine Strike'],
		[],
		['Divine Intervention'],
		[{'Destroy Undead': 'CR 2'}],
		[],
		[],
		[{'Destroy Undead': 'CR 3'}],
		[],
		[],
		[{'Destroy Undead': 'CR 4'}, 'Supreme Healing'],
		[{'Channel Divinity': '3/rest'}],
		[],
		['Divine Intervention Improvement']
	],
	druid: [
		['Spellcasting', 'Druidic'],
		['Wild Shape', 'Bonus Cantrip', 'Natural Recovery'],
		[],
		['Wild Shape Improvement'],
		[],
		["Land's Stride"],
		[],
		['Wild Shape Improvement 2'],
		[],
		["Nature's Ward"],
		[],
		[],
		[],
		["Nature's Sanctuary"],
		[],
		[],
		[],
		['Timeless Body', 'Beast Spells'],
		[],
		['Archdruid']
	],
	fighter: [
		['Fighting Style', 'Second Wind'],
		[{'Action Surge': 'one use'}],
		['Improved Critical'],
		[],
		[{'Extra Attack': '1'}],
		[{'Extra Ability Score Improvements': '1'}],
		['Remarkable Athlete'],
		[],
		[{'Indomitable': 'one use'}],
		['Additional Fighting Style'],
		[{'Extra Attack': '2'}],
		[],
		[{'Indomitable': 'two uses'}],
		[{'Extra Ability Score Improvements': '2'}],
		['Superior Critical'],
		[],
		[{'Action Surge': 'two uses'}, {'Indomitable': 'three uses'}],
		['Survivor'],
		[],
		[{'Extra Attack': '3'}]
	],
	monk: [
		['Unarmored Defense', 'Martial Arts'],
		['Ki', 'Unarmored Movement'],
		['Deflect Missiles', 'Open Hand Technique'],
		['Slow Fall'],
		['Extra Attack', 'Stunning Strike'],
		['Ki-Empowered Strikes', 'Wholeness of Body'],
		['Evasion', 'Stillness of Mind'],
		[],
		['Unarmored Movement Improvement'],
		['Purity of Body'],
		['Tranquility'],
		[],
		['Tongue of the Sun and Moon'],
		['Diamond Soul'],
		['Timeless Body'],
		[],
		['Quivering Palm'],
		['Empty Body'],
		[],
		['Perfect Self']
	],
	paladin: [
		['Divine Sense', 'Lay on Hands'],
		['Fighting Style', 'Spellcasting', 'Divine Smite'],
		['Divine Health', 'Channel Divinity'],
		[],
		['Extra Attack'],
		['Aura of Protection'],
		['Aura of Devotion'],
		[],
		[],
		['Aura of Courage'],
		['Improved Divine Smite'],
		[],
		[],
		['Cleansing Touch'],
		['Purity of Spirit'],
		[],
		[],
		['Aura Improvements'],
		[],
		['Holy Nimbus']
	],
	ranger: [
		['Favored Enemy', 'Natural Explorer'],
		['Fighting Style', 'Spellcasting'],
		["Hunter's Prey", 'Primeval Awareness'],
		[],
		['Extra Attack'],
		['Favored Enemy Improvement', 'Natural Explorer Improvement'],
		['Defensive Tactics'],
		["Land's Stride"],
		[],
		['Natural Explorer Improvement 2', 'Hide in Plain Sight'],
		['Multiattack'],
		[],
		[],
		['Favored Enemy Improvement 2', 'Vanish'],
		["Superior Hunter's Defense"],
		[],
		[],
		['Feral Senses'],
		[],
		['Foe Slayer']
	],
	rogue: [
		['Expertise', {'Sneak Attack': '1d6'}, "Thieves' Cant"],
		['Cunning Action'],
		[{'Sneak Attack': '2d6'}, 'Fast Hands', 'Second-Story Work'],
		[],
		[{'Sneak Attack': '3d6'}, 'Uncanny Dodge'],
		['Expertise 2'],
		[{'Sneak Attack': '4d6'}, 'Evasion'],
		[],
		[{'Sneak Attack': '5d6'}, 'Supreme Sneak'],
		[],
		[{'Sneak Attack': '6d6'}, 'Reliable Talent'],
		[],
		[{'Sneak Attack': '7d6'}, 'Use Magic Device'],
		['Blindsense'],
		[{'Sneak Attack': '8d6'}, 'Slippery Mind'],
		[],
		[{'Sneak Attack': '9d6'}, "Thief's Reflexes"],
		['Elusive'],
		[{'Sneak Attack': '10d6'}],
		['Stroke of Luck']
	],
	sorcerer: [
		['Spellcasting', 'Draconic Resilience'],
		['Font of Magic'],
		['Metamagic'],
		[],
		[],
		['Elemental Affinity'],
		[],
		[],
		[],
		['Metamagic 2'],
		[],
		[],
		[],
		['Dragon Wings'],
		[],
		[],
		['Metamagic 3'],
		['Draconic Presence'],
		[],
		['Sorcerous Restoration']
	],
	warlock: [
		["Dark One's Blessing", 'Pact Magic'],
		['Eldritch Invocations'],
		['Pact Boon'],
		[],
		[],
		["Dark One's Own Luck"],
		[],
		[],
		[],
		['Fiendish Resilience'],
		[],
		[],
		[],
		['Hurl Through Hell'],
		[],
		[],
		[],
		[],
		[],
		['Eldritch Master']
	],
	wizard: [
		['Spellcasting', 'Arcane Recovery'],
		['Evocation Savant', 'Sculpt Spells'],
		[],
		[],
		[],
		['Potent Cantrip'],
		[],
		[],
		[],
		['Empowered Evocation'],
		[],
		[],
		[],
		['Overchannel'],
		[],
		[],
		[],
		['Spell Mastery'],
		[],
		['Signature Spells']
	]
};
