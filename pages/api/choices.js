import { Configuration, OpenAIApi } from "openai";
const fs = require('fs').promises;
const pluralize = require('pluralize');
const jwt = require('jsonwebtoken');

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);
var system = "";
var inputType = "object";
var maxAttributeLengths = {};

export default async function (req, res) {
	var token = req.headers["authorization"].replace("Bearer", "").trim();
	jwt.verify(token, process.env.WARPGATE_SECRET);
	system = req.body.system;
	inputType = req.body.inputType;
	var createdObject = {};
	await Promise.all( req.body.choices.map(async criteria => {
		const attrName = criteria.attributeName;
		if(criteria.fixedSource)
		{
			createdObject[attrName] = await searchChoice(attrName, criteria, req.body.input);
		}
		else
		{
			createdObject[attrName] = await completionChoice(attrName, criteria, req.body.input);
		}
	}));
	
	res.status(200).json({ result: createdObject });
}

async function completionChoice(attrName, criteria, input) {
	const prompt = await generateCompletionPrompt(attrName, criteria, input);
	const singularAttr = pluralize.singular(attrName);
	var tokens = 10;
	var stop = null;
	const subAttrs = baseKeysRemoved(criteria);
	if(subAttrs)
		criteria.number = subAttrs.length;
	if(maxAttributeLengths[attrName] && maxAttributeLengths[attrName] > 0)
	{
		tokens = Math.max(Math.floor(maxAttributeLengths[attrName] * 1.5), tokens);
	}
	if(criteria.number)
	{
		tokens = tokens * criteria.number;
	}
	else
	{
		stop = "\n";
	}
	const response = await openai.createCompletion("text-davinci-001", {
		prompt: prompt,
		temperature: 0.6,
		max_tokens: tokens,
		stop: stop
	});
	console.log(prompt);
	console.log(response.data);
	const singularAttrDelimiter = singularAttr+":";
	const attrValue = response.data.choices[0].text;
	if(subAttrs)
	{
		var createdAttr = {};
		subAttrs.forEach(subAttr =>{
			var regex = new RegExp(subAttr+':(.*)', 'i'); //'i' for ignoreCase
			var match = attrValue.match(regex);
			createdAttr[subAttr] = match ? match[1].trim() : null;
		});
		return createdAttr;
	}
	else if(criteria.number && criteria.number > 1)
	{
		return attrValue.split(singularAttrDelimiter).map(item => item.trim()).slice(0, criteria.number);
	}
	else
	{
		return attrValue.replace(singularAttrDelimiter, '').trim();
	}
}

async function searchChoice(attrName, criteria, input) {
	const documents = await loadExamples(attrName, criteria.filterExamplesBy);
	const query = getBasePrompt(attrName, criteria, input);
	const number = criteria.number ? criteria.number : 1;
	const response = await openai.createSearch("curie", {
	  documents: documents,
	  query: query
	});
	const topResults = response.data.data.sort((a, b) => b.score - a.score).slice(0, number);
	const finalResults = topResults.map(res => documents[res.document]);
	console.log(query);
	console.log(finalResults);
	return finalResults.length===1 ? finalResults[0] : finalResults;
}

async function generateCompletionPrompt(attrName, criteria, input) {
	const singularAttr = pluralize.singular(attrName);
	const examples = await loadExamples(attrName, criteria.filterExamplesBy);
	var result = "";
	if(examples && examples.length>0)
		result = singularAttr+": "+examples.join("\n"+singularAttr+": ")+"\n\n";
	result += getBasePrompt(attrName, criteria, input);
	result += "\n"+singularAttr+":";
	return result;
}

function getBasePrompt(attrName, criteria, input) {
	var result = input + "\n\n";
	result += "What " + (pluralize.isSingular(attrName) ? "is " : "are ");
	result += "this "+inputType+"'s ";
	if(criteria.number && criteria.number > 1)
		result += criteria.number+" ";
	result += attrName+"?\n";
	return result;
}

async function loadExamples(attribute, filterCriteria = null) {
	const pluralAttr = pluralize.plural(attribute);
	const path = "pages/api/systems/"+system+"/"+pluralAttr;
	try {
		const files = await getFiles(path, filterCriteria);
		const examples = files.map(filePath => loadFile(filePath));
		const combinedExamples = (await Promise.all(examples)).flat();
		const exampleLengths = combinedExamples.map(ex => ex.split(/\s/).length);
		maxAttributeLengths[attribute] = Math.max(...exampleLengths);
		return combinedExamples;
	}
	catch(error) {
		console.warn(error);
		return null;
	}
}

async function getFiles(path, filterCriteria = null)
{
	const allFiles = await fs.readdir(path)
	var files = allFiles.filter(file => file.endsWith(".txt")).map(file => path+"/"+file);
	if(filterCriteria && filterCriteria.length > 0)
	{
		var currentCriterion = Array.isArray(filterCriteria[0]) ? (folder => folder >= filterCriteria[0][0] && folder <= filterCriteria[0][1]) : (folder => folder===filterCriteria[0]);
		var moreFiles = await Promise.all(
			(await fs.readdir(path))
			.filter(file => !file.endsWith(".txt"))
			.filter(currentCriterion)
			.map(folder => getFiles(path+"/"+folder, filterCriteria.slice(1))));
		files = files.concat(...moreFiles);
	}
	return files;
}

async function loadFile(filePath, label) {
	const data = await fs.readFile(filePath, "utf8");
	const entries = splitFile(data);
	if(!entries)
		console.log(fileName)
	return entries;
}

function splitFile(fileContent) {
	const minRecords = 3;
	for(var count=5; count > 0; count--)
	{
		var regex = new RegExp("(\r?\n){"+count+"}");
		var entries = fileContent.split(regex).map(line => line.trim()).filter(line => line);
		if(entries.length >= minRecords)
			return entries;
	}
	return null;
}

function baseKeysRemoved(criteria) {
	const baseKeys = ['number', 'fixedSource', 'attributeName', 'filterExamplesBy'];
	const toReturn = Object.keys(criteria).filter(key => !baseKeys.includes(key));
	if(toReturn.length < 1)
		return null;
	else
		return toReturn;
}