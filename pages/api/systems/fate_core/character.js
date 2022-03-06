const fs = require('fs').promises;
const pluralize = require('pluralize');

export default async function (req, res) {
	var response = null;
	if(req.body && req.body.character)
	{
		response = processCharacter(req.body.character, req.body.power);
	}
	else
	{
		response = await newCharacter(req.body.power);
	}
	res.status(200).json(response);
}

async function newCharacter()
{
	const schema = await loadSchema("fate_core");
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
	character.refresh = 3 + Math.floor(power * 5);
	character.stress = "3 boxes";
	var skills = {};
	var regex = new RegExp(/(.*):.*\+(\d)/);
	character.skills.map(skill => {
		var match = skill.match(regex);
		if(match)
			skills[match[1]] = parseInt(match[2]);
	});
	var skillsByPreference = Object.keys(skills).sort((a,b) => skills[b] - skills[a]);
	var skillsByLevel = getSkillsByLevel(skillsByPreference, power);
	var maxSkill = Math.max(...(Object.keys(skillsByLevel).filter(sk => skillsByLevel[sk])));
	for(var lvl=1; lvl<=maxSkill; lvl++)
	{
		for(var i=0; i<skillsByLevel[lvl]; i++)
		{
			skills[skillsByPreference.pop()] = lvl;
		}
	}
	
	character.skills = Object.keys(skills).map(skill => skill+": "+skillRatings[skills[skill]]);
	
	return {character: character, choices: []};
}

function getSkillsByLevel(skills, power) {
	var numSkillsByLevel = {0: 0};
	var skillsToSlot = skills.length;
	var totalSkillPoints = 20 + Math.floor(power * 15);
	var maxSkill = 2 + Math.floor(totalSkillPoints/10);
	while(skillsToSlot > 0 && totalSkillPoints > 0)
	{
		var columnHeight = maxSkill;
		var skillPointsSpent = 0;
		for(; columnHeight>0; columnHeight--)
		{
			skillPointsSpent = (columnHeight + 1) * (columnHeight/2.0);
			if(columnHeight > skillsToSlot || skillPointsSpent > totalSkillPoints - (skillsToSlot - columnHeight))
				continue;
			else
				break;
		}
		for(var i=columnHeight; i>0; i--)
		{
			if(numSkillsByLevel[i])
				numSkillsByLevel[i]++;
			else
				numSkillsByLevel[i] = 1;
		}
		skillsToSlot -= columnHeight;
		totalSkillPoints -= skillPointsSpent;
	}
	return numSkillsByLevel;
}
/*
function getSkillsByLevel(skills, power) {
	var maxSkill = Object.values(skills).sort((a,b)=>b-a)[0];
	var numSkillsByLevel = {0: 0};
	for(var i=1; i<=maxSkill; i++)
	{
		numSkillsByLevel[i] = Object.keys(skills).filter(sk => skills[sk]===i).length;
	}
	var valid = false;
	while(!valid)
	{
		valid = true;
		for(var i=maxSkill; i>1; i--)
		{
			if(numSkillsByLevel[i] > numSkillsByLevel[i-1])
			{
				valid = false;
				numSkillsByLevel[i]--;
				numSkillsByLevel[i-1]++;
			}
		}
		if(!valid)
			continue;
	
		var totalSkillPoints = Object.keys(numSkillsByLevel).map(lvl => lvl * numSkillsByLevel[lvl]).reduce((prev, curr) => prev + curr);
		var expectedSkillPoints = 20 + Math.floor(power * 15);
		while(totalSkillPoints != expectedSkillPoints)
		{
			var motion = false;
			if(totalSkillPoints > expectedSkillPoints)
			{
				for(var demoteRank = maxSkill; demoteRank>1 && !motion; demoteRank--)
				{
					if(numSkillsByLevel[demoteRank] > (numSkillsByLevel[demoteRank+1] ? numSkillsByLevel[demoteRank+1] : 0)
						|| numSkillsByLevel[demoteRank] > numSkillsByLevel[demoteRank-1])
					{
						numSkillsByLevel[demoteRank]--;
						numSkillsByLevel[demoteRank-1]++;
						if(numSkillsByLevel[maxSkill]===0)
							maxSkill--;
						motion = true;
					}
				}
			}
			if(totalSkillPoints < expectedSkillPoints)
			{
				for(var promoteRank = 1; promoteRank<=maxSkill && !motion; promoteRank++)
				{
					if(numSkillsByLevel[promoteRank] > 1 && numSkillsByLevel[promoteRank] > (numSkillsByLevel[promoteRank+1] ? numSkillsByLevel[promoteRank+1] : 0))
					{
						if(maxSkill+1 - promoteRank <= expectedSkillPoints - totalSkillPoints)
						{
							numSkillsByLevel[promoteRank]--;
							numSkillsByLevel[maxSkill+1] = 1;
							maxSkill++;
							motion = true;
						}
					}
				}
			}
			if(!motion)
				break;
			else
				valid = false;
			totalSkillPoints = Object.keys(numSkillsByLevel).map(lvl => lvl * numSkillsByLevel[lvl]).reduce((prev, curr) => prev + curr);
			console.log("total: "+totalSkillPoints+" expected: "+expectedSkillPoints);
			console.log(numSkillsByLevel);
		}
	}
	return numSkillsByLevel;
}
*/

const skillRatings = [
	"Mediocre (+0)",
	"Average (+1)",
	"Fair (+2)",
	"Good (+3)",
	"Great (+4)",
	"Superb (+5)",
	"Fantastic (+6)",
	"Epic (+7)",
	"Legendary (+8)"
];