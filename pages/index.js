import Head from "next/head";
import { useState } from "react";
import styles from "./index.module.css";

const choicesUri = process.env.NEXT_PUBLIC_BASE_PATH+"/api/choices";
const systemsUri = process.env.NEXT_PUBLIC_BASE_PATH+"/api/systems/";
const authUri = process.env.NEXT_PUBLIC_BASE_PATH+"/api/auth";
console.log(choicesUri+" "+systemsUri+" "+authUri);

export default function Home() {
  const [accessCode, setAccessCode] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [accessError, setAccessError] = useState("");
  
  function MainBody(state) {
	  const [input, setInput] = useState("");
	  const [result, setResult] = useState();
	  const [system, setSystem] = useState("dnd_5e");
	  const [power, setPower] = useState(5);
  
	  async function onSubmit(event) {
		setResult("Processing...");
		event.preventDefault();
		var inputType = "character"; //fix this later
		var response = await fetch(systemsUri+system+"/character", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"Authorization": "Bearer "+accessToken
			},
			body: JSON.stringify({power: power/100.0})
		});
		var data = await response.json();
		var character = data.character;
		var choices = data.choices;
		while (choices && choices.length > 0)
		{
			response = await fetch(choicesUri, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"Authorization": "Bearer "+accessToken
				},
				body: JSON.stringify({ choices: choices, system: system, input: input, inputType: inputType })
			})
			data = await response.json();
			Object.keys(data.result).forEach(attr => {
				if(!character[attr])
					character[attr] = data.result[attr];
			});
			response = await fetch(systemsUri+system+"/character", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"Authorization": "Bearer "+accessToken
				},
				body: JSON.stringify({ character: character, power: power/100.0 })
			});
			data = await response.json();
			character = data.character;
			choices = data.choices;
		}
		
		var tempResult = [];
		if(character)
		{
			Object.keys(character).forEach(attribute => {
				tempResult.push(<h4>{attribute}</h4>);
				if(typeof character[attribute] != 'object')
				{
					tempResult.push(<p>{character[attribute]}</p>)
				}
				else if(character[attribute] && character[attribute].length)
				{
					character[attribute].forEach(attrValue => {
						tempResult.push(<p>{attrValue}</p>);
					});
				}
				else if(character[attribute])
				{
					Object.keys(character[attribute]).forEach(subAttr => {
						tempResult.push(<p>{subAttr}: {character[attribute][subAttr]}</p>);
					})
				}
				else
				{
					tempResult.push(<p>null</p>);
				}
			});
			//tempResult += "\nJSON:\n"+JSON.stringify(data.resultObj);
		}
		setResult(tempResult);
		//setInput("");
	  }
	  
	  return (<div>
			  <Head>
				<title>WaRPGaTe Translator</title>
			  </Head>

			  <main className={styles.main}>
				<div className={styles.leftSide}>
					<h3>WaRPGaTe Translator</h3>
					<form onSubmit={onSubmit}>
						<div style={{"flexDirection": "row"}}>
							Destination System:
							<select name="systemSelect" id="systemSelect" value={system} onChange={e => setSystem(e.target.value)}>
							   <option value="dnd_5e">D&amp;D 5e</option>
							   <option value="fate_core">Fate Core</option>
							</select>
						</div>
						<div style={{"flexDirection": "row"}}>
							Thing to Convert:
							<select name="typeSelect" id="typeSelect">
							   <option value="character">Character</option>
							</select>
						</div>
						<div style={{"flexDirection": "row"}}>
							Power:
							<input type="range" id="powerSelect" min="1" max="100" value={power} onChange={e => setPower(e.target.value)} />
						</div>
						<textarea
							rows="5"
							cols="60"
							name="inputArea"
							placeholder="Enter something to translate"
							value={input}
							onChange={(e) => setInput(e.target.value)}
						/>
						<input type="submit" value="Parse content" />
					</form>
				</div>
				<div className={styles.result}>{result}</div>
			  </main>
			  </div>
			);
  }
  
  async function authenticate(event) {
	  event.preventDefault();
	  console.log(process.env.BASE_PATH+"/api/auth");
	  var response = await fetch(authUri, {
			method: "POST",
			headers: {
				"Content-Type": "application/json"
			},
			body: JSON.stringify({ accessCode: accessCode })
		});
	  if(response.status === 200)
	  {
		  var data = await response.json();
		  setAccessToken(data.token);
	  }
	  else
	  {
		  setAccessError(await response.text());
		  setAccessToken(null);
	  }
  }
	  
  return (<div>
		{!accessToken ? (<div>
			Enter access code to continue
			<form onSubmit={authenticate}>
				<input type="text" id="accessCodeBox" value={accessCode} onChange={e => setAccessCode(e.target.value)} />
				<input type="submit" value="Submit" />
			</form>
			<div style={{"color":"red"}}>
				{accessError}
			</div>
		</div>)
		: (<MainBody />)
		}
	</div>);
}
